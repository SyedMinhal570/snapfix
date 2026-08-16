import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  MARKLY_PAID_AMOUNT,
  MARKLY_PAID_CURRENCY,
  SAFEPAY_ENVIRONMENT,
  appBaseUrl,
  createSafepayClient,
  recordSafepayCheckout,
} from "@/lib/safepay";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const login = new URL("/login", appBaseUrl(request));
    return NextResponse.redirect(login, { status: 303 });
  }

  const publicKey = process.env.NEXT_PUBLIC_SAFEPAY_PUBLIC_KEY?.trim();
  if (!publicKey) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_SAFEPAY_PUBLIC_KEY is not configured" },
      { status: 500 },
    );
  }

  const origin = appBaseUrl(request);
  const orderId = `markly_${user.id}_${Date.now()}`;

  try {
    const safepay = createSafepayClient();

    const session = await safepay.payments.session.setup({
      merchant_api_key: publicKey,
      intent: "CYBERSOURCE",
      mode: "payment",
      entry_mode: "raw",
      currency: MARKLY_PAID_CURRENCY,
      amount: MARKLY_PAID_AMOUNT,
      include_fees: false,
      // Safepay only allows predefined metadata keys (docs: order_id).
      metadata: {
        order_id: orderId,
      },
    });

    const trackerToken: unknown =
      session?.data?.tracker?.token ?? session?.tracker?.token;
    if (typeof trackerToken !== "string" || !trackerToken) {
      console.error("[safepay] Unexpected session response");
      return NextResponse.json(
        { error: "Could not start Safepay checkout" },
        { status: 502 },
      );
    }

    await recordSafepayCheckout({
      tracker: trackerToken,
      userId: user.id,
      orderId,
    });

    const passport = await safepay.client.passport.create();
    const tbt: unknown = passport?.data ?? passport;
    if (typeof tbt !== "string" || !tbt) {
      console.error("[safepay] Unexpected passport response");
      return NextResponse.json(
        { error: "Could not start Safepay checkout" },
        { status: 502 },
      );
    }

    const checkoutUrl = safepay.checkout.createCheckoutUrl({
      env: SAFEPAY_ENVIRONMENT,
      tbt,
      tracker: trackerToken,
      source: "hosted",
      order_id: orderId,
      redirect_url: `${origin}/api/safepay/return`,
      cancel_url: `${origin}/upgrade?status=cancelled`,
    });

    return NextResponse.redirect(checkoutUrl, { status: 303 });
  } catch (err) {
    console.error("[safepay] Checkout setup failed:", err);
    const upgrade = new URL("/upgrade", origin);
    upgrade.searchParams.set("status", "error");
    return NextResponse.redirect(upgrade, { status: 303 });
  }
}
