// Tokenizer for the ADFS Claim Rules Language.

import type { Position } from "./ast";

export type TokenType =
  | "at" // @
  | "ident" // identifier / keyword
  | "string" // "..."
  | "op" // == != =~ !~
  | "and" // &&
  | "arrow" // =>
  | "eq" // =
  | "lbracket" // [
  | "rbracket" // ]
  | "lparen" // (
  | "rparen" // )
  | "comma" // ,
  | "colon" // :
  | "dot" // .
  | "semicolon" // ;
  | "eof";

export interface Token {
  type: TokenType;
  /** Raw text of the token; for strings this is the *decoded* value. */
  value: string;
  start: Position;
  end: Position;
}

export class LexError extends Error {
  position: Position;
  constructor(message: string, position: Position) {
    super(message);
    this.name = "LexError";
    this.position = position;
  }
}

const isIdentStart = (c: string): boolean => /[A-Za-z_]/.test(c);
const isIdentPart = (c: string): boolean => /[A-Za-z0-9_]/.test(c);
const isWhitespace = (c: string): boolean => c === " " || c === "\t" || c === "\r" || c === "\n";

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let offset = 0;
  let line = 1;
  let column = 1;

  const pos = (): Position => ({ offset, line, column });

  const advance = (): string => {
    const c = source[offset];
    offset += 1;
    if (c === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
    return c;
  };

  const peek = (ahead = 0): string => source[offset + ahead] ?? "";

  const push = (type: TokenType, value: string, start: Position): void => {
    tokens.push({ type, value, start, end: pos() });
  };

  while (offset < source.length) {
    const c = peek();

    if (isWhitespace(c)) {
      advance();
      continue;
    }

    // Line comments (`//`) and block comments (`/* */`) — not part of the
    // official grammar, but tolerated so users can annotate pasted rules.
    if (c === "/" && peek(1) === "/") {
      while (offset < source.length && peek() !== "\n") advance();
      continue;
    }
    if (c === "/" && peek(1) === "*") {
      advance();
      advance();
      while (offset < source.length && !(peek() === "*" && peek(1) === "/")) advance();
      if (offset < source.length) {
        advance();
        advance();
      }
      continue;
    }

    const start = pos();

    if (c === "@") {
      advance();
      push("at", "@", start);
      continue;
    }

    if (c === '"') {
      // ADFS string literals are taken verbatim: their contents are passed
      // straight to the regex / attribute-store engines, so backslashes are
      // NOT escape characters (e.g. `"[^\\]"` must keep both backslashes). A
      // closing double-quote ends the string; quotes cannot appear inside one.
      advance(); // opening quote
      let str = "";
      let closed = false;
      while (offset < source.length) {
        const ch = peek();
        if (ch === '"') {
          advance();
          closed = true;
          break;
        }
        str += advance();
      }
      if (!closed) {
        throw new LexError("Unterminated string literal", start);
      }
      push("string", str, start);
      continue;
    }

    if (isIdentStart(c)) {
      let id = "";
      while (offset < source.length && isIdentPart(peek())) {
        id += advance();
      }
      push("ident", id, start);
      continue;
    }

    // Multi-character operators.
    if (c === "=" && peek(1) === ">") {
      advance();
      advance();
      push("arrow", "=>", start);
      continue;
    }
    if (c === "=" && peek(1) === "=") {
      advance();
      advance();
      push("op", "==", start);
      continue;
    }
    if (c === "!" && peek(1) === "=") {
      advance();
      advance();
      push("op", "!=", start);
      continue;
    }
    if (c === "=" && peek(1) === "~") {
      advance();
      advance();
      push("op", "=~", start);
      continue;
    }
    if (c === "!" && peek(1) === "~") {
      advance();
      advance();
      push("op", "!~", start);
      continue;
    }
    // `&&` joins top-level conditions in the claim rules language.
    if (c === "&" && peek(1) === "&") {
      advance();
      advance();
      push("and", "&&", start);
      continue;
    }

    switch (c) {
      case "=":
        advance();
        push("eq", "=", start);
        continue;
      case "[":
        advance();
        push("lbracket", "[", start);
        continue;
      case "]":
        advance();
        push("rbracket", "]", start);
        continue;
      case "(":
        advance();
        push("lparen", "(", start);
        continue;
      case ")":
        advance();
        push("rparen", ")", start);
        continue;
      case ",":
        advance();
        push("comma", ",", start);
        continue;
      case ":":
        advance();
        push("colon", ":", start);
        continue;
      case ".":
        advance();
        push("dot", ".", start);
        continue;
      case ";":
        advance();
        push("semicolon", ";", start);
        continue;
      default:
        throw new LexError(`Unexpected character ${JSON.stringify(c)}`, start);
    }
  }

  tokens.push({ type: "eof", value: "", start: pos(), end: pos() });
  return tokens;
}
