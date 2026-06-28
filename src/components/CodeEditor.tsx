import { useRef, type ChangeEvent } from "react";
import { highlight } from "../lib/highlight";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

/**
 * Dependency-free highlighted code editor. A transparent <textarea> is layered
 * exactly over a <pre> that renders the same text with highlight spans. Both
 * share identical font, padding, line-height and white-space: pre-wrap so the
 * caret lines up with the rendered glyphs and long lines wrap (no h-scroll).
 */
export function CodeEditor({ value, onChange, placeholder, ariaLabel }: Props) {
  const preRef = useRef<HTMLPreElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const pre = preRef.current;
    if (!pre) return;
    pre.scrollTop = e.currentTarget.scrollTop;
    pre.scrollLeft = e.currentTarget.scrollLeft;
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="ce">
      <pre className="ce-pre" ref={preRef} aria-hidden="true">
        {highlight(value)}
        {"\n"}
      </pre>
      <textarea
        className="ce-textarea"
        aria-label={ariaLabel}
        value={value}
        spellCheck={false}
        placeholder={placeholder}
        onChange={handleChange}
        onScroll={handleScroll}
      />
    </div>
  );
}
