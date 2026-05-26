"use client";

import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";

// Scalar renders the OpenAPI spec AND provides an interactive "Test Request"
// console that calls the live API in real time.
export default function ApiDocsPage() {
  return (
    <ApiReferenceReact
      configuration={{
        url: "/apispec_v1.yaml",
        theme: "purple",
        darkMode: true,
      }}
    />
  );
}
