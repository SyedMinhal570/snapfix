import type { Metadata } from "next";
import { openApiSpec } from "@/lib/openapi";
import ApiDocsClient from "./api-docs-client";

export const metadata: Metadata = {
  title: "API Docs — SnapFix",
  description: "OpenAPI documentation for SnapFix / Markly APIs",
};

export default function ApiDocsPage() {
  return (
    <main className="min-h-screen">
      <ApiDocsClient spec={openApiSpec as object} />
    </main>
  );
}
