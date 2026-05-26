"use client";

import { useEffect, useRef } from "react";

const REDOC_SRC = "https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js";

declare global {
  interface Window {
    Redoc?: { init: (spec: string, opts: object, el: HTMLElement) => void };
  }
}

export default function ApiDocsPage() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function render() {
      if (window.Redoc && ref.current) {
        window.Redoc.init(
          "/api/openapi.json",
          {
            scrollYOffset: 56,
            hideDownloadButton: false,
            theme: {
              colors: { primary: { main: "#5b8cff" } },
              typography: { fontFamily: "var(--font-geist-sans), system-ui, sans-serif" },
            },
          },
          ref.current
        );
      }
    }

    if (window.Redoc) {
      render();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${REDOC_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", render);
      return () => existing.removeEventListener("load", render);
    }
    const script = document.createElement("script");
    script.src = REDOC_SRC;
    script.async = true;
    script.onload = render;
    document.body.appendChild(script);
  }, []);

  return (
    <div className="min-h-screen bg-white text-black">
      <div ref={ref} />
    </div>
  );
}
