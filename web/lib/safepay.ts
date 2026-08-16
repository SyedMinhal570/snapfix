import crypto from "crypto";
import Safepay from "@sfpy/node-core";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Switch SAFEPAY_ENVIRONMENT to "production" when going live
 * (API host follows: sandbox.api.getsafepay.com → api.getsafepay.com).
 */
export const SAFEPAY_ENVIRONMENT: "sandbox" | "production" = "sandbox";

const SAFEPAY_API_HOSTS = {
  sandbox: "https://sandbox.api.getsafepay.com",
  production: "https://api.getsafepay.com",
} as const;

export const SAFEPAY_API_HOST = SAFEPAY_API_HOSTS[SAFEPAY_ENVIRONMENT];

/** Rs 1,200 — Safepay amounts are in the lowest denomination (paisa). */
export const MARKLY_PAID_AMOUNT_RUPEES = 1200;
export const MARKLY_PAID_AMOUNT = MARKLY_PAID_AMOUNT_RUPEES * 100;
export const MARKLY_PAID_CURRENCY = "PKR";

export function createSafepayClient() {
  const secret = process.env.SAFEPAY_SECRET_KEY?.trim();
  if (!secret) {
    throw new Error("SAFEPAY_SECRET_KEY is not configured");
  }

  return new Safepay(secret, {
    authType: "secret",
    host: SAFEPAY_API_HOST,
  });
}

export function appBaseUrl(request: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;

  return "http://localhost:3000";
}

/**
 * Merchant checkout webhooks (X-SFPY-SIGNATURE) are HMAC-SHA512 of the
 * raw request body using the webhook/shared secret. Matches Safepay's
 * official PHP SDK (`hash_hmac('sha512', $payload, $secret)`) and their
 * ASP.NET integration guide. Never parse JSON before verifying.
 */
export function verifySafepayWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = process.env.SAFEPAY_SECRET_KEY?.trim();
  const provided = signatureHeader?.trim();
  if (!secret || !provided) return false;

  const normalized = provided.replace(/^sha512=/i, "").toLowerCase();

  const expected = crypto
    .createHmac("sha512", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(normalized, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Redirect-form signature: HMAC-SHA256 of the tracker with the shared secret. */
export function verifySafepayTrackerSignature(
  tracker: string,
  signature: string,
): boolean {
  const secret = process.env.SAFEPAY_SECRET_KEY?.trim();
  if (!secret || !tracker || !signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(tracker)
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.toLowerCase(), "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function markUserPaid(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ plan: "paid" })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function extractTrackerToken(payload: unknown): string | null {
  const root = asRecord(payload);
  const data = asRecord(root?.data) ?? asRecord(root?.object) ?? root;
  const nested = asRecord(data?.data) ?? asRecord(data?.object) ?? data;

  for (const candidate of [nested?.tracker, data?.tracker, root?.tracker]) {
    if (typeof candidate === "string" && candidate.startsWith("track_")) {
      return candidate;
    }
    const obj = asRecord(candidate);
    if (typeof obj?.token === "string" && obj.token.startsWith("track_")) {
      return obj.token;
    }
  }

  return null;
}

export function extractOrderId(payload: unknown): string | null {
  const root = asRecord(payload);
  const data = asRecord(root?.data) ?? asRecord(root?.object) ?? root;
  const nested = asRecord(data?.data) ?? asRecord(data?.object) ?? data;
  const tracker = asRecord(nested?.tracker) ?? asRecord(data?.tracker);

  for (const bag of [nested, data, root, tracker]) {
    const meta = asRecord(bag?.metadata);
    const raw = meta?.order_id ?? bag?.order_id;
    if (typeof raw === "string" && raw) return raw;
    const obj = asRecord(raw);
    if (typeof obj?.value === "string" && obj.value) return obj.value;
  }

  return null;
}

export function userIdFromOrderId(orderId: string | null): string | null {
  if (!orderId) return null;
  const match = /^markly_([0-9a-f-]{36})_/i.exec(orderId);
  return match?.[1] ?? null;
}

export async function recordSafepayCheckout(params: {
  tracker: string;
  userId: string;
  orderId: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("safepay_checkouts").upsert(
    {
      tracker: params.tracker,
      user_id: params.userId,
      order_id: params.orderId,
    },
    { onConflict: "tracker" },
  );
  if (error) throw new Error(error.message);
}

export async function findUserIdForTracker(
  tracker: string | null,
  payload?: unknown,
): Promise<string | null> {
  const admin = createAdminClient();

  if (tracker) {
    const { data, error } = await admin
      .from("safepay_checkouts")
      .select("user_id")
      .eq("tracker", tracker)
      .maybeSingle();
    if (error) {
      console.error("[safepay] Checkout lookup failed:", error);
    } else if (typeof data?.user_id === "string") {
      return data.user_id;
    }
  }

  return userIdFromOrderId(extractOrderId(payload));
}

export function isSuccessfulPaymentEvent(payload: unknown): boolean {
  const root = asRecord(payload);
  const type = String(root?.type ?? root?.event ?? "").toLowerCase();
  const data = asRecord(root?.data) ?? asRecord(root?.object) ?? root;

  if (
    type === "payment.succeeded" ||
    type === "payment.completed" ||
    type === "payment.captured"
  ) {
    return true;
  }

  if (data?.success === true) return true;

  const tracker = asRecord(data?.tracker) ?? asRecord(root?.tracker);
  if (tracker?.state === "TRACKER_ENDED") return true;

  return false;
}
