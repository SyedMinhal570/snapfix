import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Upgrade to Markly Paid",
  description: "Upgrade your Markly account via JazzCash or Easypaisa.",
};

const JAZZCASH_NUMBER = "0323-8851525";
const WHATSAPP_NUMBER = "923238851525";

const waText = encodeURIComponent(
  "Hi, I've paid for Markly Pro. My account email is: ",
);
const waHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`;

export default function UpgradePage() {
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
        Rs 1,200
        <span className="text-lg font-normal text-zinc-500">/month</span>
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Unlimited projects and feedback. Activated manually within 24 hours
        after payment.
      </p>

      <div className="mt-8 space-y-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          How to pay
        </h2>
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          <li>
            Send <strong>Rs 1,200</strong> via JazzCash or Easypaisa to{" "}
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
