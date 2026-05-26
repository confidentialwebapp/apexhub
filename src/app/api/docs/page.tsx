"use client";

import { useEffect, useState } from "react";
import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";

// Scalar renders the OpenAPI spec AND provides an interactive "Test Request"
// console that calls the live API in real time.
export default function ApiDocsPage() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  return (
    <ApiReferenceReact
      configuration={{
        url: "/apispec_v1.yaml",
        theme: "default",
        darkMode: dark,
      }}
    />
  );
}
