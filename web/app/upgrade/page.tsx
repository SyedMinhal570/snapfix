import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MARKLY_PAID_AMOUNT_RUPEES } from "@/lib/safepay";

export const metadata: Metadata = {
  title: "Upgrade to Markly Paid",
  description: "Upgrade your Markly account via Safepay or JazzCash / Easypaisa.",
};

const JAZZCASH_NUMBER = "0323-8851525";
const WHATSAPP_NUMBER = "923238851525";

const waText = encodeURIComponent(
  "Hi, I've paid for Markly Pro. My account email is: ",
);
const waHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`;

type Props = {
  searchParams: Promise<{ status?: string }>;
};

export default async function UpgradePage({ searchParams }: Props) {
  const { status } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  const alreadyPaid = profile?.plan === "paid";

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col justify-center px-4 py-12">
      <Link
        href="/"
        className="mb-8 text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        ← Back
      </Link>

      <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
        Markly Paid
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Rs {MARKLY_PAID_AMOUNT_RUPEES.toLocaleString("en-PK")}
        <span className="text-lg font-normal text-zinc-500">/month</span>
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Unlimited projects and feedback. Pay online with Safepay — your plan
        upgrades automatically after a successful payment.
      </p>

      {status === "cancelled" ? (
        <p
          className="mt-6 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          role="status"
        >
          Payment was cancelled. Your plan was not changed. You can try
          Safepay again or use the manual option below.
        </p>
      ) : null}

      {status === "error" ? (
        <p
          className="mt-6 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
          role="alert"
        >
          We couldn&apos;t start or confirm checkout. Try again, or use JazzCash
          / Easypaisa below.
        </p>
      ) : null}

      <div className="mt-8 space-y-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Pay with Safepay
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Card checkout (sandbox). You&apos;ll be redirected to Safepay to
          complete Rs {MARKLY_PAID_AMOUNT_RUPEES.toLocaleString("en-PK")}.
        </p>

        {alreadyPaid ? (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            You&apos;re already on the Paid plan.{" "}
            <Link href="/dashboard" className="font-semibold underline">
              Go to dashboard
            </Link>
          </p>
        ) : user ? (
          <form action="/api/safepay/checkout" method="POST">
            <button
              type="submit"
              className="flex w-full items-center justify-center rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600"
            >
              Pay with Safepay
            </button>
          </form>
        ) : (
          <Link
            href="/login"
            className="flex w-full items-center justify-center rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600"
          >
            Sign in to pay with Safepay
          </Link>
        )}
      </div>

      <div className="mt-6 space-y-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Manual fallback — JazzCash / Easypaisa
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Use this if Safepay checkout isn&apos;t available. An admin will
          activate Paid after you send the receipt.
        </p>
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          <li>
            Send <strong>Rs {MARKLY_PAID_AMOUNT_RUPEES.toLocaleString("en-PK")}</strong> via JazzCash or Easypaisa to{" "}
            <strong className="whitespace-nowrap">{JAZZCASH_NUMBER}</strong>.
          </li>
          <li>
            Message your account email to{" "}
            <strong className="whitespace-nowrap">{WHATSAPP_NUMBER}</strong> on
            WhatsApp.
          </li>
          <li>Your account will be upgraded within 24 hours.</li>
        </ol>

        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex w-full items-center justify-center rounded-md bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1ebe57]"
        >
          Message on WhatsApp
        </a>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          The message opens pre-filled — just add the email you use for Markly
          after the colon.
        </p>
      </div>

      <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Already paid?{" "}
        <Link
          href="/dashboard"
          className="font-medium text-zinc-900 underline dark:text-zinc-100"
        >
          Go to dashboard
        </Link>
      </p>
    </main>
  );
}
