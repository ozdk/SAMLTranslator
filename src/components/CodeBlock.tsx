import { highlight } from "../lib/highlight";

export function CodeBlock({ code }: { code: string }) {
  return <pre className="codeblock">{highlight(code)}</pre>;
}
