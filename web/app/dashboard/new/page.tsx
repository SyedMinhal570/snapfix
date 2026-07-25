"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import AnnotationCanvas, {
  type AnnotationCanvasHandle,
} from "@/components/annotation-canvas";
import { createClient } from "@/lib/supabase/client";

export default function NewIssuePage() {
  const router = useRouter();
  const canvasRef = useRef<AnnotationCanvasHandle>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Please choose a screenshot.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setLoading(false);
      setError("You must be signed in to create an issue.");
      return;
    }

    const id = crypto.randomUUID();
    const ext = file.name.split(".").pop() ?? "png";
    const originalPath = `${user.id}/${id}.${ext}`;
    const annotatedPath = `${user.id}/${id}-annotated.png`;

    const { error: uploadError } = await supabase.storage
      .from("screenshots")
      .upload(originalPath, file);

    if (uploadError) {
      setLoading(false);
      setError(uploadError.message);
      return;
    }

    const annotatedBlob = await canvasRef.current?.exportPng();
    if (!annotatedBlob) {
      setLoading(false);
      setError("Could not export the annotated screenshot.");
      return;
    }

    const { error: annotatedUploadError } = await supabase.storage
      .from("screenshots")
      .upload(annotatedPath, annotatedBlob, { contentType: "image/png" });

    if (annotatedUploadError) {
      setLoading(false);
      setError(annotatedUploadError.message);
      return;
    }

    const {
      data: { publicUrl: screenshotUrl },
    } = supabase.storage.from("screenshots").getPublicUrl(originalPath);

    const {
      data: { publicUrl: annotatedUrl },
    } = supabase.storage.from("screenshots").getPublicUrl(annotatedPath);

    const { error: insertError } = await supabase.from("issues").insert({
      title,
      description,
      page_url: pageUrl,
      screenshot_url: screenshotUrl,
      annotated_url: annotatedUrl,
      created_by: user.id,
    });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-zinc-900">
        New issue
      </h1>
      <p className="mb-8 text-sm text-zinc-500">
        Report a bug or leave feedback
      </p>

      <form onSubmit={handleSubmit} className="mx-auto max-w-[600px] space-y-5">
        <div>
          <label
            htmlFor="title"
            className="mb-1.5 block text-sm font-medium text-zinc-700"
          >
            Title
          </label>
          <input
            id="title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
          />
        </div>

        <div>
          <label
            htmlFor="description"
            className="mb-1.5 block text-sm font-medium text-zinc-700"
          >
            Description
          </label>
          <textarea
            id="description"
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
          />
        </div>

        <div>
          <label
            htmlFor="page_url"
            className="mb-1.5 block text-sm font-medium text-zinc-700"
          >
            Page URL
          </label>
          <input
            id="page_url"
            type="url"
            required
            placeholder="https://example.com/page"
            value={pageUrl}
            onChange={(e) => setPageUrl(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
          />
        </div>

        <div>
          <label
            htmlFor="screenshot"
            className="mb-1.5 block text-sm font-medium text-zinc-700"
          >
            Screenshot
          </label>
          <input
            id="screenshot"
            type="file"
            accept="image/*"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
          />
        </div>

        {file && <AnnotationCanvas ref={canvasRef} file={file} />}

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? "Submitting…" : "Submit issue"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}
