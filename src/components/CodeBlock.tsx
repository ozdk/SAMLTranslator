import { Fragment } from "react";

// Lightweight syntax highlighter for claim-rules text. Tokenizes loosely just
// for display — the real parser lives in lib/.
const TOKEN_RE =
  /(@\w+)|("(?:[^"\\]|\\.)*")|(=>|==|!=|=~|!~)|\b(issue|add|store|types|query|param|claim|EXISTS|NOT|RegExReplace)\b/g;

export function CodeBlock({ code }: { code: string }) {
  const parts: Array<{ text: string; cls?: string }> = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(code)) !== null) {
    if (m.index > last) parts.push({ text: code.slice(last, m.index) });
    if (m[1]) parts.push({ text: m[1], cls: "c-at" });
    else if (m[2]) parts.push({ text: m[2], cls: "c-str" });
    else if (m[3]) parts.push({ text: m[3], cls: "c-op" });
    else if (m[4]) parts.push({ text: m[4], cls: "c-key" });
    last = m.index + m[0].length;
  }
  if (last < code.length) parts.push({ text: code.slice(last) });

  return (
    <pre className="codeblock">
      {parts.map((p, i) =>
        p.cls ? (
          <span key={i} className={p.cls}>
            {p.text}
          </span>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </pre>
  );
}
