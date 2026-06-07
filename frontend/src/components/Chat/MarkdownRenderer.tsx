/**
 * Enhanced Markdown Renderer — v7.0
 * Support: Mermaid diagrams, KaTeX math, code highlighting, GFM tables
 * 灵感来源: WorkBuddy + QClaw 的完整 Markdown 渲染能力
 */
import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import MermaidRenderer from './MermaidRenderer';

interface Props {
  content: string;
  className?: string;
}

/** Extract mermaid code blocks and replace with placeholders */
function processMermaidBlocks(content: string): { processedContent: string; mermaidCharts: Array<{ placeholder: string; chart: string }> } {
  const mermaidCharts: Array<{ placeholder: string; chart: string }> = [];
  const regex = /```mermaid\s*\n([\s\S]*?)```/g;
  let match;
  let processedContent = content;
  while ((match = regex.exec(content)) !== null) {
    const chart = match[1].trim();
    const placeholder = `<!--MERMAID_${mermaidCharts.length}-->`;
    mermaidCharts.push({ placeholder, chart });
    processedContent = processedContent.replace(match[0], placeholder);
  }
  return { processedContent, mermaidCharts };
}

/** Extract KaTeX math blocks */
function processMathBlocks(content: string): { processedContent: string; mathBlocks: Array<{ placeholder: string; formula: string; display: boolean }> } {
  const mathBlocks: Array<{ placeholder: string; formula: string; display: boolean }> = [];
  let processedContent = content;
  // Display math $$...$$
  const displayRegex = /\$\$([\s\S]*?)\$\$/g;
  let match;
  while ((match = displayRegex.exec(content)) !== null) {
    const formula = match[1].trim();
    const placeholder = `<!--MATH_D_${mathBlocks.length}-->`;
    mathBlocks.push({ placeholder, formula, display: true });
    processedContent = processedContent.replace(match[0], placeholder);
  }
  // Inline math $...$
  const inlineRegex = /\$(.+?)\$/g;
  while ((match = inlineRegex.exec(processedContent)) !== null) {
    if (match[1].includes('$')) continue; // skip display math remnants
    const formula = match[1].trim();
    const placeholder = `<!--MATH_I_${mathBlocks.length}-->`;
    mathBlocks.push({ placeholder, formula, display: false });
    processedContent = processedContent.replace(match[0], placeholder);
  }
  return { processedContent, mathBlocks };
}

/** Simple code block component */
const CodeBlock: React.FC<{ language?: string; children?: React.ReactNode }> = ({ language, children }) => {
  const code = String(children).replace(/\n$/, '');
  return (
    <div className="code-block relative rounded-lg overflow-hidden my-3 border">
      {language && (
        <div className="flex items-center px-4 py-1.5 bg-gray-100 text-xs text-gray-500 font-mono border-b">
          {language}
        </div>
      )}
      <pre className="p-4 bg-gray-50 overflow-auto text-sm">
        <code className={`language-${language || 'text'}`}>{code}</code>
      </pre>
    </div>
  );
};

const MarkdownRenderer: React.FC<Props> = ({ content, className = '' }) => {
  const { processedContent: afterMermaid, mermaidCharts } = useMemo(() => processMermaidBlocks(content), [content]);
  const { processedContent: finalContent, mathBlocks } = useMemo(() => processMathBlocks(afterMermaid), [afterMermaid]);

  // If content starts with ⚠️, render as plain text warning
  if (content.trim().startsWith('⚠️')) {
    return (
      <div className={`p-4 rounded-lg border border-orange-200 bg-orange-50 text-orange-800 text-sm ${className}`}>
        {content}
      </div>
    );
  }

  return (
    <div className={`markdown-body prose prose-sm max-w-none ${className}`}>
      {mermaidCharts.length === 0 && mathBlocks.length === 0 ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, className: codeClass, children, ...props }) {
              const match = /language-(\w+)/.exec(codeClass || '');
              const language = match ? match[1] : undefined;
              const isInline = !match && !String(children).includes('\n');
              if (isInline) {
                return <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm text-pink-600" {...props}>{children}</code>;
              }
              return <CodeBlock language={language}>{children}</CodeBlock>;
            },
            table({ children }) { return <div className="overflow-auto my-4"><table className="min-w-full border-collapse border text-sm">{children}</table></div>; },
            th({ children }) { return <th className="border px-3 py-2 bg-gray-50 font-medium text-left">{children}</th>; },
            td({ children }) { return <td className="border px-3 py-2">{children}</td>; },
            blockquote({ children }) { return <blockquote className="border-l-4 border-green-400 pl-4 py-1 my-3 bg-green-50 rounded-r">{children}</blockquote>; },
            a({ href, children }) { return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{children}</a>; },
          }}
        >
          {finalContent}
        </ReactMarkdown>
      ) : (
        // With special blocks: split by placeholders and interleave
        <div>
          {finalContent.split(/(<!--MERMAID_\d+-->|<!--MATH_[DI]_\d+-->)/g).map((part, i) => {
            const mermaidMatch = part.match(/^<!--MERMAID_(\d+)-->$/);
            if (mermaidMatch) {
              const chart = mermaidCharts[parseInt(mermaidMatch[1])];
              return chart ? <MermaidRenderer key={i} chart={chart.chart} /> : null;
            }
            const mathMatch = part.match(/^<!--MATH_[DI]_(\d+)-->$/);
            if (mathMatch) {
              const math = mathBlocks[parseInt(mathMatch[1])];
              if (!math) return null;
              const formula = math.formula;
              return math.display ? (
                <div key={i} className="flex justify-center py-3 overflow-auto">
                  <span className="text-gray-700 italic px-4 py-2 bg-gray-50 rounded text-sm font-mono">{formula}</span>
                </div>
              ) : (
                <span key={i} className="italic font-mono text-sm text-gray-700 bg-gray-50 px-1 rounded">{formula}</span>
              );
            }
            // Regular markdown
            return part ? (
              <ReactMarkdown
                key={i}
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, className: codeClass, children: c, ...props }) {
                    const match = /language-(\w+)/.exec(codeClass || '');
                    const isInline = !match && !String(c).includes('\n');
                    if (isInline) return <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm text-pink-600" {...props}>{c}</code>;
                    return <CodeBlock language={match?.[1]}>{c}</CodeBlock>;
                  },
                  table({ children: t }) { return <div className="overflow-auto my-4"><table className="min-w-full border-collapse border text-sm">{t}</table></div>; },
                  th({ children: t }) { return <th className="border px-3 py-2 bg-gray-50 font-medium text-left">{t}</th>; },
                  td({ children: t }) { return <td className="border px-3 py-2">{t}</td>; },
                  blockquote({ children: t }) { return <blockquote className="border-l-4 border-green-400 pl-4 py-1 my-3 bg-green-50 rounded-r">{t}</blockquote>; },
                  a({ href, children: t }) { return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{t}</a>; },
                }}
              >
                {part}
              </ReactMarkdown>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
};

export default MarkdownRenderer;
