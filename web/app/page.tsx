import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, DM_Sans } from "next/font/google";
import ThemeToggle from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Markly — Client feedback without the chase",
  description:
    "Share a link, clients mark up your work, you see feedback live. Built for freelancers and small agencies.",
};

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-markly-display",
});

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-markly-body",
});

function AnnotationMock() {
  return (
    <div className="markly-mock" aria-hidden>
      <div className="markly-mock-chrome">
        <span className="markly-dot markly-dot-r" />
        <span className="markly-dot markly-dot-y" />
        <span className="markly-dot markly-dot-g" />
        <span className="markly-mock-url">markly.app/review/a8f3c2...</span>
      </div>

      <div className="markly-mock-stage">
        <div className="markly-mock-ui">
          <div className="markly-skel markly-skel-title" />
          <div className="markly-skel markly-skel-line" />
          <div className="markly-skel markly-skel-line-short" />
          <div className="markly-mock-grid">
            <div className="markly-skel markly-skel-tile" />
            <div className="markly-skel markly-skel-tile" />
            <div className="markly-skel markly-skel-tile markly-skel-tile-accent" />
          </div>
          <div className="markly-skel markly-skel-btn" />
        </div>

        <svg
          className="markly-stroke"
          viewBox="0 0 800 500"
          fill="none"
          aria-hidden
        >
          <path
            d="M140 340 C220 300, 280 250, 360 270 C440 290, 500 220, 580 200"
            stroke="var(--markly-accent)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="420"
            strokeDashoffset="420"
          />
        </svg>

        <div className="markly-rect" />

        <div className="markly-chip">
          <span className="markly-chip-label">Client</span>
          <span className="markly-chip-text">
            Make this CTA clearer — and move it up.
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className={`${display.variable} ${body.variable} markly-landing`}>
      <header className="markly-nav">
        <div className="markly-nav-inner">
          <Link href="/" className="markly-wordmark">
            Markly
          </Link>
          <div className="markly-nav-actions">
            <ThemeToggle />
            <Link href="/login" className="markly-btn-ghost">
              Log in
            </Link>
            <Link href="/signup" className="markly-btn-primary">
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <section className="markly-hero">
        <div className="markly-hero-bg" aria-hidden />
        <div className="markly-hero-inner">
          <div className="markly-fade-up">
            <p className="markly-brand">Markly</p>
            <h1 className="markly-headline">
              Stop chasing feedback in WhatsApp screenshots
            </h1>
            <p className="markly-subhead">
              Clients mark up exactly what to change — no signup on their end.
              You see it live on your dashboard.
            </p>
            <div className="markly-cta-row">
              <Link href="/signup" className="markly-btn-primary markly-btn-lg">
                Get started free
              </Link>
              <Link href="/login" className="markly-btn-outline markly-btn-lg">
                Log in
              </Link>
            </div>
          </div>

          <div className="markly-fade-up markly-fade-up-delay">
            <AnnotationMock />
          </div>
        </div>
      </section>

      <section className="markly-section">
        <div className="markly-section-inner">
          <h2 className="markly-h2">How it works</h2>
          <p className="markly-lede">
            Three steps from upload to crystal-clear client notes.
          </p>

          <ol className="markly-steps">
            <li>
              <div className="markly-step-icon" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </div>
              <p className="markly-step-kicker">Step 1</p>
              <h3 className="markly-h3">Create a project</h3>
              <p className="markly-copy">
                Upload a screenshot of your work. Name the project, add the
                client for your notes — done.
              </p>
            </li>
            <li>
              <div className="markly-step-icon" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" strokeLinecap="round" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" strokeLinecap="round" />
                </svg>
              </div>
              <p className="markly-step-kicker">Step 2</p>
              <h3 className="markly-h3">Share the link</h3>
              <p className="markly-copy">
                Send one link. Your client opens it with zero account, zero
                friction — just markup and a comment.
              </p>
            </li>
            <li>
              <div className="markly-step-icon" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="markly-step-kicker">Step 3</p>
              <h3 className="markly-h3">See it live</h3>
              <p className="markly-copy">
                Annotated feedback lands on your dashboard in real time —
                circled, boxed, and written in plain language.
              </p>
            </li>
          </ol>
        </div>
      </section>

      <section className="markly-section markly-section-alt">
        <div className="markly-section-inner">
          <h2 className="markly-h2">Why Markly</h2>
          <p className="markly-lede">
            Built for freelancers and small agencies — not enterprise bug
            trackers bolted onto your workflow.
          </p>

          <div className="markly-why-grid">
            <div>
              <h3 className="markly-h3">Made for solo &amp; small teams</h3>
              <p className="markly-copy">
                Tools like BugHerd and Marker.io lean enterprise. Markly is
                scoped for client deliverables: one link, clear markup, done.
              </p>
            </div>
            <div>
              <h3 className="markly-h3">Zero friction for clients</h3>
              <p className="markly-copy">
                No guest accounts, no browser extensions for them to install.
                Open the link, draw, submit — that&apos;s the whole ask.
              </p>
            </div>
            <div>
              <h3 className="markly-h3">Priced for local freelancers</h3>
              <p className="markly-copy">
                Start free. When you need more projects, upgrade at a rate that
                makes sense for agency and freelance budgets — not USD SaaS
                sticker shock.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="markly-section">
        <div className="markly-section-inner">
          <h2 className="markly-h2">Pricing</h2>
          <p className="markly-lede">Simple plans. No surprises.</p>

          <div className="markly-pricing">
            <div className="markly-price-card">
              <h3 className="markly-h3">Free</h3>
              <p className="markly-price">
                Rs 0<span>/month</span>
              </p>
              <p className="markly-copy markly-price-desc">
                1 active project, 10 feedback submissions — perfect for trying
                it out.
              </p>
              <Link href="/signup" className="markly-btn-outline markly-btn-lg">
                Get started free
              </Link>
            </div>

            <div className="markly-price-card markly-price-card-featured">
              <span className="markly-badge">Most popular</span>
              <h3 className="markly-h3">Paid</h3>
              <p className="markly-price">
                Rs 1,200<span>/month</span>
              </p>
              <p className="markly-copy markly-price-desc">
                Unlimited projects and feedback. Share as many review links as
                your clients need.
              </p>
              <Link href="/upgrade" className="markly-btn-primary markly-btn-lg">
                Get started
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="markly-footer">
        <div className="markly-footer-inner">
          <div>
            <p className="markly-wordmark markly-wordmark-sm">Markly</p>
            <p className="markly-copy">
              Client feedback, marked where it matters.
            </p>
          </div>
          <p className="markly-copyright">
            © {new Date().getFullYear()} Markly
          </p>
        </div>
      </footer>
    </div>
  );
}
