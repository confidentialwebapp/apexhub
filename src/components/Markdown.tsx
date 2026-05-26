import ReactMarkdown from "react-markdown";

export function Markdown({ children }: { children: string }) {
  if (!children) return null;
  return (
    <div className="prose-block text-sm text-foreground/90">
      <ReactMarkdown
        components={{
          a: (props) => <a {...props} className="text-accent hover:underline" target="_blank" rel="noreferrer" />,
          ul: (props) => <ul {...props} className="my-2 list-disc space-y-1 pl-5" />,
          ol: (props) => <ol {...props} className="my-2 list-decimal space-y-1 pl-5" />,
          p: (props) => <p {...props} className="my-2" />,
          pre: (props) => <pre {...props} className="code my-3" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
