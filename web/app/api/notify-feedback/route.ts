import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const FROM_EMAIL = "Markly <onboarding@resend.dev>";
const COMMENT_EXCERPT_LEN = 200;

function appBaseUrl(request: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;

  return "http://localhost:3000";
}

function excerpt(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "(no comment)";
  if (trimmed.length <= COMMENT_EXCERPT_LEN) return trimmed;
  return `${trimmed.slice(0, COMMENT_EXCERPT_LEN).trimEnd()}…`;
}

/**
 * Fire-and-forget email to the project owner after a client submits feedback.
 * Always returns 200 so the public review flow never surfaces mail failures.
 */
export async function POST(request: Request) {
  try {
    let body: { projectId?: string; commentText?: string };
    try {
      body = await request.json();
    } catch {
      console.error("[notify-feedback] Invalid JSON body");
      return NextResponse.json({ ok: true, emailed: false });
    }

    const projectId = body.projectId?.trim();
    const commentText =
      typeof body.commentText === "string" ? body.commentText : "";

    if (!projectId) {
      console.error("[notify-feedback] Missing projectId");
      return NextResponse.json({ ok: true, emailed: false });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      console.error("[notify-feedback] RESEND_API_KEY is not configured");
      return NextResponse.json({ ok: true, emailed: false });
    }

    let admin;
    try {
      admin = createAdminClient();
    } catch (err) {
      console.error("[notify-feedback] Admin client unavailable:", err);
      return NextResponse.json({ ok: true, emailed: false });
    }

    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("id, name, owner_id")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError) {
      console.error("[notify-feedback] Project lookup failed:", projectError);
      return NextResponse.json({ ok: true, emailed: false });
    }

    if (!project) {
      console.error("[notify-feedback] Project not found:", projectId);
      return NextResponse.json({ ok: true, emailed: false });
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("email")
      .eq("id", project.owner_id)
      .maybeSingle();

    if (profileError) {
      console.error("[notify-feedback] Profile lookup failed:", profileError);
      return NextResponse.json({ ok: true, emailed: false });
    }

    const ownerEmail = profile?.email?.trim();
    if (!ownerEmail) {
      console.error(
        "[notify-feedback] No owner email for project:",
        projectId,
      );
      return NextResponse.json({ ok: true, emailed: false });
    }

    const dashboardUrl = `${appBaseUrl(request)}/dashboard/projects/${project.id}`;
    const commentExcerpt = excerpt(commentText);
    const subject = `New feedback on ${project.name}`;
    const text = [
      `You received new feedback on your Markly project "${project.name}".`,
      "",
      "Comment:",
      commentExcerpt,
      "",
      `View the project: ${dashboardUrl}`,
    ].join("\n");

    const html = `
      <p>You received new feedback on your Markly project <strong>${escapeHtml(project.name)}</strong>.</p>
      <p><strong>Comment:</strong></p>
      <p>${escapeHtml(commentExcerpt)}</p>
      <p><a href="${escapeHtml(dashboardUrl)}">View the project</a></p>
    `.trim();

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [ownerEmail],
        subject,
        text,
        html,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(
        "[notify-feedback] Resend error:",
        res.status,
        detail,
      );
      return NextResponse.json({ ok: true, emailed: false });
    }

    return NextResponse.json({ ok: true, emailed: true });
  } catch (err) {
    console.error("[notify-feedback] Unexpected error:", err);
    return NextResponse.json({ ok: true, emailed: false });
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
