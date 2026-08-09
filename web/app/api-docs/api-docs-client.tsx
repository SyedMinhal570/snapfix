"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function ApiDocsClient({ spec }: { spec: object }) {
  return (
    <div className="swagger-docs min-h-screen bg-white">
      <SwaggerUI spec={spec} docExpansion="list" defaultModelsExpandDepth={1} />
    </div>
  );
}
