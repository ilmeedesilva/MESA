import type React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { resolveDocLink } from "../docsLinks";

/**
 * Renders one in-app doc. GitHub-flavoured Markdown (tables, task lists, strikethrough,
 * autolinks); raw HTML in the Markdown is not rendered. Headings get the same ids as on GitHub,
 * so "#what-fails-the-check" links work in both places. Loaded only on the Documentation page.
 */
export default function DocsMarkdown({ content, docPath }: { content: string; docPath: string }) {
  const components: Components = {
    a({ href = "", children }) {
      const link = resolveDocLink(href, docPath);
      if (link.kind === "external") {
        return (
          <a href={link.href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        );
      }
      if (link.kind === "doc") return <a href={link.href}>{children}</a>;
      // A heading on this page. The app's address already uses "#", so scroll instead of
      // changing it, and move focus there for keyboard and screen-reader users.
      return (
        <a
          href={`#${link.id}`}
          onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
            event.preventDefault();
            const target = document.getElementById(link.id);
            if (!target) return;
            target.setAttribute("tabindex", "-1");
            target.scrollIntoView?.({ block: "start" });
            target.focus({ preventScroll: true });
          }}
        >
          {children}
        </a>
      );
    },
    // Wide tables and long code lines scroll inside their own box, never the page. The box can
    // take keyboard focus so it can be scrolled with the arrow keys.
    table({ children }) {
      return (
        <div className="docsTableScroll" role="region" aria-label="Table, scrolls sideways" tabIndex={0}>
          <table>{children}</table>
        </div>
      );
    },
    pre({ children }) {
      return (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region must be focusable
        <pre className="docsCodeBlock" tabIndex={0}>
          {children}
        </pre>
      );
    }
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]} skipHtml components={components}>
      {content}
    </ReactMarkdown>
  );
}
