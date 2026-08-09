import swaggerJsdoc from "swagger-jsdoc";

/**
 * OpenAPI documentation for SnapFix / Markly APIs.
 *
 * Most app operations go through Supabase (PostgREST + RPCs) from the browser
 * rather than Next.js route handlers. Paths below mirror those calls so the
 * shapes are discoverable in Swagger UI.
 */
const definition = {
  openapi: "3.0.3",
  info: {
    title: "SnapFix / Markly API",
    version: "1.0.0",
    description:
      "API surface used by the web app: Supabase RPCs and tables for projects, " +
      "public review/feedback, admin plan toggles, plus a Sentry test route.",
  },
  servers: [
    {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://YOUR_PROJECT.supabase.co",
      description: "Supabase PostgREST (RPCs + tables)",
    },
    {
      url: "/",
      description: "This Next.js app",
    },
  ],
  tags: [
    { name: "Projects", description: "Authenticated project creation" },
    { name: "Review", description: "Public review link RPCs" },
    { name: "Admin", description: "Manual plan management" },
    { name: "Monitoring", description: "Error monitoring helpers" },
  ],
  paths: {
    "/rest/v1/rpc/get_review_project": {
      post: {
        tags: ["Review"],
        summary: "Load a public review project by share slug",
        description:
          "Supabase RPC `get_review_project`. Called by the public review page " +
          "(`/review/[slug]`) with `{ p_slug }`. Returns project metadata for the " +
          "annotation UI, or null when the slug is invalid.",
        operationId: "getReviewProject",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["p_slug"],
                properties: {
                  p_slug: {
                    type: "string",
                    description: "Public share slug from the review URL",
                    example: "a8f3c2d1e4b59670",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Project payload, or null if not found",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/ReviewProject" },
                    { type: "null" },
                  ],
                },
              },
            },
          },
          "400": {
            description: "RPC error (invalid args, etc.)",
          },
        },
      },
    },
    "/rest/v1/rpc/submit_feedback": {
      post: {
        tags: ["Review"],
        summary: "Submit annotated feedback for a project",
        description:
          "Supabase RPC `submit_feedback`. After uploading the annotated PNG to " +
          "storage, the review page calls this with the project id, public image " +
          "URL, and comment. Enforces the free-plan feedback cap (10) server-side.",
        operationId: "submitFeedback",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: [
                  "p_project_id",
                  "p_annotated_image_url",
                  "p_comment_text",
                ],
                properties: {
                  p_project_id: { type: "string", format: "uuid" },
                  p_annotated_image_url: {
                    type: "string",
                    format: "uri",
                    description:
                      "Public URL of the annotated screenshot in storage",
                  },
                  p_comment_text: {
                    type: "string",
                    description: "Client comment (may be empty string)",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Success or structured business error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SubmitFeedbackResult",
                },
              },
            },
          },
        },
      },
    },
    "/rest/v1/projects": {
      post: {
        tags: ["Projects"],
        summary: "Create a review project",
        description:
          "Authenticated insert used by the new-project flow " +
          "(`/dashboard/projects/new`). Preceded by a plan check (free users are " +
          "limited to 1 project) and a screenshot upload to the `screenshots` " +
          "storage bucket. Returns the created row's `id`.",
        operationId: "createProject",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: "header",
            name: "Prefer",
            schema: {
              type: "string",
              example: "return=representation",
            },
            description:
              'PostgREST prefer header (app uses `.select("id").single()`)',
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["owner_id", "name", "screenshot_url", "share_slug"],
                properties: {
                  owner_id: { type: "string", format: "uuid" },
                  name: { type: "string", example: "Homepage redesign" },
                  client_name: { type: "string", nullable: true },
                  client_email: {
                    type: "string",
                    format: "email",
                    nullable: true,
                  },
                  screenshot_url: { type: "string", format: "uri" },
                  share_slug: {
                    type: "string",
                    description: "16-char slug used in `/review/{slug}`",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Created project",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                  },
                },
              },
            },
          },
          "401": { description: "Not signed in" },
          "403": {
            description:
              "RLS denied or free-plan limit reached (enforced in UI before insert)",
          },
        },
      },
    },
    "/rest/v1/profiles": {
      patch: {
        tags: ["Admin"],
        summary: "Toggle a user's plan (free ↔ paid)",
        description:
          "Admin plan-toggle action from `/admin`. Updates `profiles.plan` for a " +
          "given user id after looking the user up by email. Requires an " +
          "authenticated session whose email matches `ADMIN_EMAIL`.",
        operationId: "toggleUserPlan",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: "query",
            name: "id",
            required: true,
            schema: { type: "string" },
            description: "PostgREST filter, e.g. `eq.{user-uuid}`",
            example: "eq.11111111-2222-3333-4444-555555555555",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["plan"],
                properties: {
                  plan: {
                    type: "string",
                    enum: ["free", "paid"],
                    description:
                      "Target plan (UI toggles between free and paid)",
                  },
                },
              },
            },
          },
        },
        responses: {
          "204": { description: "Plan updated" },
          "401": { description: "Not authenticated" },
          "403": {
            description: "Not the configured admin user / RLS denied",
          },
        },
      },
    },
    "/api/sentry-test": {
      get: {
        tags: ["Monitoring"],
        summary: "Trigger a test Sentry error",
        description:
          "Next.js route handler that deliberately throws so you can confirm " +
          "events appear in the Sentry dashboard.",
        operationId: "sentryTest",
        responses: {
          "500": {
            description:
              "Always throws — used only for Sentry verification",
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Supabase Auth access token (session)",
      },
    },
    schemas: {
      ReviewProject: {
        type: "object",
        required: [
          "id",
          "name",
          "screenshot_url",
          "share_slug",
          "feedback_count",
          "can_submit",
          "plan",
        ],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          client_name: { type: "string", nullable: true },
          screenshot_url: { type: "string", format: "uri" },
          share_slug: { type: "string" },
          created_at: { type: "string", format: "date-time" },
          feedback_count: { type: "integer" },
          can_submit: {
            type: "boolean",
            description:
              "False when owner is on free plan and feedback_count >= 10",
          },
          plan: { type: "string", enum: ["free", "paid"] },
        },
      },
      SubmitFeedbackResult: {
        oneOf: [
          {
            type: "object",
            required: ["ok", "feedback"],
            properties: {
              ok: { type: "boolean", enum: [true] },
              feedback: {
                type: "object",
                description: "Inserted feedback row",
                properties: {
                  id: { type: "string", format: "uuid" },
                  project_id: { type: "string", format: "uuid" },
                  annotated_image_url: { type: "string", format: "uri" },
                  comment_text: { type: "string" },
                  created_at: { type: "string", format: "date-time" },
                },
              },
            },
          },
          {
            type: "object",
            required: ["ok", "error"],
            properties: {
              ok: { type: "boolean", enum: [false] },
              error: {
                type: "string",
                description:
                  "`upgrade_required`, `Project not found`, or other message",
              },
              message: { type: "string" },
            },
          },
        ],
      },
    },
  },
};

export function getOpenApiSpec() {
  return swaggerJsdoc({
    definition,
    // Keep scanning the sentry-test route for any additional JSDoc annotations
    apis: [`${process.cwd()}/app/api/**/*.ts`],
  });
}

export const openApiSpec = getOpenApiSpec();
