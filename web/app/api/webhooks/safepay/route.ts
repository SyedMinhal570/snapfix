import { NextResponse } from "next/server";
import {
  extractTrackerToken,
  findUserIdForTracker,
  isSuccessfulPaymentEvent,
  markUserPaid,
  verifySafepayWebhookSignature,
} from "@/lib/safepay";

/**
 * Safepay merchant checkout webhook.
 * Acknowledges with 200 OK after persisting, as documented.
 * Plan is only upgraded after HMAC-SHA512 signature verification succeeds.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-sfpy-signature");

  if (!verifySafepayWebhookSignature(rawBody, signature)) {
    console.error("[safepay] Webhook signature verification failed");
    return new NextResponse("Invalid signature", { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  if (!isSuccessfulPaymentEvent(payload)) {
    return new NextResponse("Ok", { status: 200 });
  }

  const tracker = extractTrackerToken(payload);
  const userId = await findUserIdForTracker(tracker, payload);

  if (!userId) {
    console.error(
      "[safepay] Successful payment webhook has no matching user; tracker=",
      tracker,
    );
    return new NextResponse("Ok", { status: 200 });
  }

  try {
    await markUserPaid(userId);
  } catch (err) {
    console.error("[safepay] Failed to mark user paid:", err);
    return new NextResponse("Upgrade failed", { status: 500 });
  }

  return new NextResponse("Ok", { status: 200 });
}
