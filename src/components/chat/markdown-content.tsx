'use client';

import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

import {
  pageTitleClassName,
  sectionTitleClassName,
  subsectionTitleClassName,
} from '@/components/layout/headings';
import { cn } from '@/lib/utils';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

const markdownComponents: Components = {
  h1: ({ children }) => <h1 className={pageTitleClassName}>{children}</h1>,
  h2: ({ children }) => <h2 className={sectionTitleClassName}>{children}</h2>,
  h3: ({ children }) => <h3 className={subsectionTitleClassName}>{children}</h3>,
  p: ({ children }) => <p className="leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="ml-5 list-disc space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="ml-5 list-decimal space-y-1">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  table: ({ children }) => (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => (
    <th className="border px-3 py-2 text-left text-sm font-medium">{children}</th>
  ),
  td: ({ children }) => <td className="border px-3 py-2 text-sm">{children}</td>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-primary underline underline-offset-2"
    >
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    if (className?.startsWith('language-')) {
      return <code className={cn('font-mono text-sm', className)}>{children}</code>;
    }

    return (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">{children}</code>
    );
  },
  pre: ({ children }) => (
    <pre
      className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-sm [&>code]:bg-transparent [&>code]:p-0"
    >
      {children}
    </pre>
  ),
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-muted-foreground/30 pl-4 italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-border" />,
};

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
