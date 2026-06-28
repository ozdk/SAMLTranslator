import { Fragment, type ReactNode } from "react";

// Shared, dependency-free tokenizer for ADFS claim-rules text. Used by both the
// read-only CodeBlock (generated code) and the editable CodeEditor overlay so the
// two never drift. Order in the alternation matters: longer operators first.
const TOKEN_RE =
  /(@\w+)|("(?:[^"\\]|\\.)*")|(=>|==|!=|=~|!~|&&|\|\|)|\b(issue|add|store|types|query|param|claim|EXISTS|NOT|RegExReplace)\b/g;

// Inside a "..." string literal, light up anything that looks like a claim-type
// URI (http(s):// or urn:) so namespaces stand out from ordinary string values.
const URI_RE = /(https?:\/\/[^\s"]+|urn:[^\s"]+)/g;

export interface Token {
  text: string;
  cls?: string;
}

/** Tokenize claim-rules source into a flat list of {text, cls?} spans. */
export function tokenize(code: string): Token[] {
  const parts: Token[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(code)) !== null) {
    if (m.index > last) parts.push({ text: code.slice(last, m.index) });
    if (m[1]) parts.push({ text: m[1], cls: "c-at" });
    else if (m[2]) pushString(parts, m[2]);
    else if (m[3]) parts.push({ text: m[3], cls: "c-op" });
    else if (m[4]) parts.push({ text: m[4], cls: "c-key" });
    last = m.index + m[0].length;
  }
  if (last < code.length) parts.push({ text: code.slice(last) });
  return parts;
}

// Split a quoted string into URI vs plain-string segments.
function pushString(parts: Token[], str: string) {
  let last = 0;
  let m: RegExpExecArray | null;
  URI_RE.lastIndex = 0;
  while ((m = URI_RE.exec(str)) !== null) {
    if (m.index > last) parts.push({ text: str.slice(last, m.index), cls: "c-str" });
    parts.push({ text: m[0], cls: "c-uri" });
    last = m.index + m[0].length;
  }
  if (last < str.length) parts.push({ text: str.slice(last), cls: "c-str" });
}

/** Render tokens as React nodes (used by both CodeBlock and CodeEditor). */
export function highlight(code: string): ReactNode[] {
  return tokenize(code).map((p, i) =>
    p.cls ? (
      <span key={i} className={p.cls}>
        {p.text}
      </span>
    ) : (
      <Fragment key={i}>{p.text}</Fragment>
    ),
  );
}
