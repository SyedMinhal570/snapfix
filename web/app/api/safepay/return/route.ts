import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  appBaseUrl,
  createSafepayClient,
  findUserIdForTracker,
  markUserPaid,
  verifySafepayTrackerSignature,
} from "@/lib/safepay";

function dashboardRedirect(
  request: Request,
  status: "success" | "pending" | "cancelled" | "error",
) {
  const url = new URL("/dashboard", appBaseUrl(request));
  url.searchParams.set("upgrade", status);
  return NextResponse.redirect(url, { status: 303 });
}

function trackerEnded(response: unknown): boolean {
  const root = response as Record<string, unknown> | null;
  const data = (root?.data ?? root) as Record<string, unknown> | undefined;
  const tracker = (data?.tracker ?? data) as Record<string, unknown> | undefined;
  return tracker?.state === "TRACKER_ENDED";
}

async function handleReturn(
  request: Request,
  tracker: string | null,
  signature: string | null,
) {
  if (!tracker) {
    return dashboardRedirect(request, "cancelled");
  }

  if (signature && !verifySafepayTrackerSignature(tracker, signature)) {
    console.error("[safepay] Invalid tracker signature on return");
    return dashboardRedirect(request, "error");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return dashboardRedirect(request, "pending");
  }

  try {
    const safepay = createSafepayClient();
    const response = await safepay.reporter.payments.fetch(tracker);
    if (!trackerEnded(response)) {
      return dashboardRedirect(request, "pending");
    }

    const mappedUser = await findUserIdForTracker(tracker, response);
    if (mappedUser && mappedUser !== user.id) {
      console.error("[safepay] Tracker belongs to a different user");
      return dashboardRedirect(request, "error");
    }

    await markUserPaid(user.id);
    return dashboardRedirect(request, "success");
  } catch (err) {
    console.error("[safepay] Return upgrade failed:", err);
    return dashboardRedirect(request, "pending");
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return handleReturn(
    request,
    url.searchParams.get("tracker"),
    url.searchParams.get("sig") ?? url.searchParams.get("signature"),
  );
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let tracker: string | null = null;
  let signature: string | null = null;

  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      tracker =
        typeof body.tracker === "string"
          ? body.tracker
          : typeof body.Tracker === "string"
            ? body.Tracker
            : null;
      signature =
        typeof body.sig === "string"
          ? body.sig
          : typeof body.signature === "string"
            ? body.signature
            : typeof body.Signature === "string"
              ? body.Signature
              : null;
    } else {
      const form = await request.formData();
      tracker =
        (form.get("tracker") ?? form.get("Tracker"))?.toString() ?? null;
      signature =
        (
          form.get("sig") ??
          form.get("signature") ??
          form.get("Signature")
        )?.toString() ?? null;
    }
  } catch {
    const url = new URL(request.url);
    tracker = url.searchParams.get("tracker");
    signature =
      url.searchParams.get("sig") ?? url.searchParams.get("signature");
  }

  return handleReturn(request, tracker, signature);
}
