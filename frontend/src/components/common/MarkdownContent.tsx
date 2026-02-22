import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-base font-bold text-zinc-100 mt-3 mb-1 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-[13px] font-bold text-zinc-200 mt-2.5 mb-1 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-[12px] font-semibold text-zinc-300 mt-2 mb-0.5 first:mt-0">{children}</h3>
  ),
  p: ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc list-outside ml-4 mb-1.5 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside ml-4 mb-1.5 space-y-0.5">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  code: ({ className, children, ...props }) => {
    const isBlock = className?.startsWith('language-');
    if (isBlock) {
      return (
        <code
          className="block bg-zinc-900 border border-zinc-700/50 rounded px-3 py-2 text-[11px] font-mono text-zinc-200 overflow-x-auto whitespace-pre"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className="bg-zinc-800 border border-zinc-700/40 rounded px-1 py-0.5 text-[11px] font-mono text-amber-300"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => <pre className="mb-1.5 last:mb-0">{children}</pre>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-zinc-600 pl-3 text-zinc-400 italic my-1.5">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => <strong className="font-semibold text-zinc-100">{children}</strong>,
  em: ({ children }) => <em className="italic text-zinc-300">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="border-zinc-700 my-2" />,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-1.5">
      <table className="text-[11px] border-collapse w-full">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-zinc-800/50">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-zinc-700 px-2 py-1 text-left text-zinc-300 font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-zinc-700/50 px-2 py-1 text-zinc-400">{children}</td>
  ),
};

interface MarkdownContentProps {
  text: string;
  className?: string;
}

export function MarkdownContent({ text, className }: MarkdownContentProps) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
