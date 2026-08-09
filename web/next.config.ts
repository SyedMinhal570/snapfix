import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  // Optional: set SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN to upload source maps
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  silent: !process.env.CI,

  // Skip source map upload unless an auth token is present (local builds stay fast)
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },

  widenClientFileUpload: true,
});
