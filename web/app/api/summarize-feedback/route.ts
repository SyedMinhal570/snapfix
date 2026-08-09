import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase/server";

const SYSTEM_PROMPT =
  "You are helping a freelancer quickly understand client feedback on their work. Summarize the following client comments into a short, actionable bullet list of what needs to change. Be concise and practical, group similar points together.";

export async function POST(request: Request) {
  let body: { projectId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const projectId = body.projectId?.trim();
  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, owner_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json(
      { error: projectError.message },
      { status: 500 },
    );
  }

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.owner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: feedback, error: feedbackError } = await supabase
    .from("feedback")
    .select("comment_text")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (feedbackError) {
    return NextResponse.json(
      { error: feedbackError.message },
      { status: 500 },
    );
  }

  const comments = (feedback ?? [])
    .map((row) => row.comment_text?.trim() ?? "")
    .filter(Boolean);

  if (!comments.length) {
    return NextResponse.json({
      summary: "No feedback yet to summarize",
    });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not configured" },
      { status: 500 },
    );
  }

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: comments.map((c, i) => `${i + 1}. ${c}`).join("\n"),
        },
      ],
      temperature: 0.3,
    });

    const summary = completion.choices[0]?.message?.content?.trim();
    if (!summary) {
      return NextResponse.json(
        { error: "Empty response from Groq" },
        { status: 502 },
      );
    }

    return NextResponse.json({ summary });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Groq request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
