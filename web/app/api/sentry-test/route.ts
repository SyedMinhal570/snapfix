/**
 * @openapi
 * /api/sentry-test:
 *   get:
 *     tags:
 *       - Monitoring
 *     summary: Trigger a test Sentry error
 *     description: >
 *       Deliberately throws an error so you can confirm events appear in the
 *       Sentry dashboard. Safe to ignore in production monitoring.
 *     responses:
 *       500:
 *         description: Always throws — used only for Sentry verification
 */
export async function GET() {
  throw new Error("Sentry test error - safe to ignore");
}
