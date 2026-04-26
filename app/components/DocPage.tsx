"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  title: string;
  filename: string;
  githubPath: string;
  back?: { href: string; label: string };
}

export default function DocPage({ title, filename, githubPath, back }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/docs/${filename}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setContent)
      .catch((e) => setError(String(e)));
  }, [filename]);

  return (
    <div className="min-h-screen bg-surface-canvas text-ink-primary">
      <header className="h-16 bg-surface-panel border-b border-border flex items-center px-6 sticky top-0 z-30 no-print">
        <div className="flex-1 flex items-center gap-3">
          <Link
            href="/library"
            className="text-[24px] font-semibold tracking-tight text-ink-primary leading-none"
          >
            GridSight
          </Link>
          <Link
            href={back?.href ?? "/library"}
            className="h-7 inline-flex items-center gap-1 px-2 rounded-md border border-border bg-surface-panel text-[11px] font-medium text-ink-secondary hover:bg-surface-subtle"
          >
            <ArrowLeft size={12} /> {back?.label ?? "Library"}
          </Link>
        </div>
        <div className="flex-1 flex items-center justify-center font-mono text-[11px] text-slate-400 uppercase tracking-[0.1em] truncate px-4">
          {title}
        </div>
        <div className="flex-1 flex items-center justify-end gap-3">
          <a
            href={githubPath}
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-md border border-border bg-surface-panel text-[12px] font-medium text-ink-primary hover:bg-surface-subtle"
          >
            <ExternalLink size={13} /> GitHub
          </a>
        </div>
      </header>

      <main className="max-w-[820px] mx-auto px-8 py-10">
        {error ? (
          <div className="text-sev-critical text-sm font-mono">
            Failed to load doc: {error}
          </div>
        ) : !content ? (
          <div className="text-ink-tertiary text-sm">loading…</div>
        ) : (
          <article className="prose-doc">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </article>
        )}
      </main>
    </div>
  );
}
