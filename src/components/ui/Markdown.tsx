import clsx from "clsx";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { ResourceChip } from "./ResourceChip";

const TYPED_LINK = /^@([a-z]+)@(.*)$/s;

function childText(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(childText).join("");
  return "";
}

const components: Components = {
  a({ href, children }) {
    const text = childText(children);
    const typed = TYPED_LINK.exec(text);
    if (typed && href) {
      return <ResourceChip type={typed[1]} title={typed[2]} url={href} />;
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
};

/**
 * Renders content markdown. Typed resource links `[@type@Title](url)` become
 * resource chips. `inline` strips the wrapping paragraph for one-liners.
 */
export function Markdown({ children, inline, className }: { children: string; inline?: boolean; className?: string }) {
  return (
    <div className={clsx("prose-atlas", inline && "[&>p]:inline", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
