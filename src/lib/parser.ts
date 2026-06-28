// Recursive-descent parser for the ADFS Claim Rules Language.
//
// Grammar (informal):
//   ruleset    := rule*
//   rule       := header* conditions "=>" action ";"
//   header     := "@" ident "=" string
//   conditions := (condition ("," condition)*)?
//   condition  := binding? claimSelector | aggregate
//   binding    := ident ":"
//   aggregate  := "NOT"? "EXISTS" "(" claimSelector ")"
//   claimSel   := "[" (propTest ("," propTest)*)? "]"
//   propTest   := property op operand
//   action     := ("issue"|"add") "(" actionBody ")"
//   actionBody := "claim" "=" ident
//               | assignment ("," assignment)*
//               | storeQuery
//   value      := string | ident "." property | "RegExReplace" "(" value "," string "," string ")"

import type {
  Action,
  AggregateCondition,
  ClaimCondition,
  ClaimProperty,
  ClaimPropertyTest,
  Condition,
  ConditionOperator,
  IssueVerb,
  PropertyAssignment,
  Rule,
  RuleHeader,
  RuleSet,
  Span,
  ValueExpr,
} from "./ast";
import { LexError, tokenize, type Token } from "./lexer";

export class ParseError extends Error {
  token: Token;
  constructor(message: string, token: Token) {
    super(message);
    this.name = "ParseError";
    this.token = token;
  }
}

const CLAIM_PROPERTIES = new Set<string>([
  "Type",
  "Value",
  "ValueType",
  "Issuer",
  "OriginalIssuer",
]);

class Parser {
  private tokens: Token[];
  private index = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(ahead = 0): Token {
    return this.tokens[Math.min(this.index + ahead, this.tokens.length - 1)];
  }

  private next(): Token {
    const t = this.tokens[this.index];
    if (this.index < this.tokens.length - 1) this.index += 1;
    return t;
  }

  private at(type: Token["type"]): boolean {
    return this.peek().type === type;
  }

  private atKeyword(word: string): boolean {
    const t = this.peek();
    return t.type === "ident" && t.value === word;
  }

  private expect(type: Token["type"], what?: string): Token {
    const t = this.peek();
    if (t.type !== type) {
      throw new ParseError(
        `Expected ${what ?? type}, but found ${describe(t)}`,
        t,
      );
    }
    return this.next();
  }

  private spanFrom(start: Token, endTok: Token): Span {
    return { start: start.start, end: endTok.end };
  }

  parseRuleSet(): RuleSet {
    const first = this.peek();
    const rules: Rule[] = [];
    while (!this.at("eof")) {
      rules.push(this.parseRule());
    }
    const last = this.peek();
    return {
      kind: "RuleSet",
      rules,
      span: { start: first.start, end: last.end },
    };
  }

  private parseRule(): Rule {
    const start = this.peek();
    const headers: RuleHeader[] = [];
    while (this.at("at")) {
      headers.push(this.parseHeader());
    }

    const conditions = this.parseConditions();
    this.expect("arrow", "'=>'");
    const action = this.parseAction();
    const semi = this.expect("semicolon", "';'");

    return {
      kind: "Rule",
      headers,
      conditions,
      action,
      span: this.spanFrom(start, semi),
    };
  }

  private parseHeader(): RuleHeader {
    const at = this.expect("at");
    const name = this.expect("ident", "header name");
    this.expect("eq", "'='");
    const value = this.expect("string", "header value");
    return {
      kind: "RuleHeader",
      name: name.value,
      value: value.value,
      span: this.spanFrom(at, value),
    };
  }

  private parseConditions(): Condition[] {
    const conditions: Condition[] = [];
    if (this.at("arrow")) return conditions; // no conditions
    conditions.push(this.parseCondition());
    // Top-level conditions are joined with `&&` (not commas — commas only
    // separate property tests inside `[...]` and parameters inside `(...)`).
    while (this.at("and")) {
      this.next();
      conditions.push(this.parseCondition());
    }
    return conditions;
  }

  private parseCondition(): Condition {
    // Aggregate: NOT EXISTS([...]) / EXISTS([...]). Only treat NOT/EXISTS as an
    // aggregate keyword when it is not actually a binding name (`EXISTS:[...]`).
    const isBinding = this.peek(1).type === "colon";
    if (!isBinding && (this.atKeyword("NOT") || this.atKeyword("EXISTS"))) {
      return this.parseAggregate();
    }
    return this.parseClaimCondition();
  }

  private parseAggregate(): AggregateCondition {
    const start = this.peek();
    let negated = false;
    if (this.atKeyword("NOT")) {
      this.next();
      negated = true;
    }
    const fnTok = this.peek();
    if (!this.atKeyword("EXISTS")) {
      throw new ParseError(
        `Expected 'EXISTS' after 'NOT', but found ${describe(fnTok)}`,
        fnTok,
      );
    }
    this.next(); // EXISTS
    this.expect("lparen", "'(' after EXISTS");
    const claim = this.parseClaimCondition();
    const close = this.expect("rparen", "')'");
    return {
      kind: "AggregateCondition",
      fn: "EXISTS",
      negated,
      claim,
      span: this.spanFrom(start, close),
    };
  }

  private parseClaimCondition(): ClaimCondition {
    const start = this.peek();
    let binding: string | null = null;

    // Optional binding `ident :` — only when followed by a colon.
    if (this.at("ident") && this.peek(1).type === "colon") {
      binding = this.next().value;
      this.next(); // colon
    }

    this.expect("lbracket", "'['");
    const tests: ClaimPropertyTest[] = [];
    if (!this.at("rbracket")) {
      tests.push(this.parsePropertyTest());
      while (this.at("comma")) {
        this.next();
        tests.push(this.parsePropertyTest());
      }
    }
    const close = this.expect("rbracket", "']'");

    return {
      kind: "ClaimCondition",
      binding,
      tests,
      span: this.spanFrom(start, close),
    };
  }

  private parsePropertyTest(): ClaimPropertyTest {
    const propTok = this.expect("ident", "claim property");
    if (!CLAIM_PROPERTIES.has(propTok.value)) {
      throw new ParseError(
        `Unknown claim property '${propTok.value}' (expected one of ${[...CLAIM_PROPERTIES].join(", ")})`,
        propTok,
      );
    }
    const property = propTok.value as ClaimProperty;

    const opTok = this.peek();
    if (opTok.type !== "op") {
      throw new ParseError(
        `Expected a comparison operator (==, !=, =~, !~), but found ${describe(opTok)}`,
        opTok,
      );
    }
    this.next();
    const operator = opTok.value as ConditionOperator;

    // Operand: single string, or a parenthesised list of strings.
    let operand: string | string[];
    let endTok: Token;
    if (this.at("lparen")) {
      this.next();
      const list: string[] = [this.expect("string", "string value").value];
      while (this.at("comma")) {
        this.next();
        list.push(this.expect("string", "string value").value);
      }
      endTok = this.expect("rparen", "')'");
      operand = list;
    } else {
      const strTok = this.expect("string", "string value");
      operand = strTok.value;
      endTok = strTok;
    }

    return {
      kind: "ClaimPropertyTest",
      property,
      operator,
      operand,
      span: this.spanFrom(propTok, endTok),
    };
  }

  private parseAction(): Action {
    const verbTok = this.peek();
    if (verbTok.type !== "ident" || (verbTok.value !== "issue" && verbTok.value !== "add")) {
      throw new ParseError(
        `Expected 'issue' or 'add', but found ${describe(verbTok)}`,
        verbTok,
      );
    }
    this.next();
    const verb = verbTok.value as IssueVerb;
    this.expect("lparen", "'(' after " + verb);

    const action = this.parseActionBody(verb, verbTok);

    return action;
  }

  private parseActionBody(verb: IssueVerb, verbTok: Token): Action {
    // Decide between: claim = c | store query | property assignments.
    // Peek the first parameter name.
    if (this.atKeyword("claim")) {
      this.next();
      this.expect("eq", "'='");
      const ident = this.expect("ident", "claim binding");
      const close = this.expect("rparen", "')'");
      return {
        kind: "IssueAction",
        verb,
        form: "copy",
        claim: ident.value,
        span: this.spanFrom(verbTok, close),
      };
    }

    if (this.atKeyword("store")) {
      return this.parseStoreQuery(verb, verbTok);
    }

    // Otherwise: property assignments.
    const assignments: PropertyAssignment[] = [this.parseAssignment()];
    while (this.at("comma")) {
      this.next();
      assignments.push(this.parseAssignment());
    }
    const close = this.expect("rparen", "')'");
    return {
      kind: "IssueAction",
      verb,
      form: "properties",
      assignments,
      span: this.spanFrom(verbTok, close),
    };
  }

  private parseStoreQuery(verb: IssueVerb, verbTok: Token): Action {
    let store: string | undefined;
    let types: string[] | undefined;
    let query: string | undefined;
    const params: ValueExpr[] = [];

    const readPair = (): void => {
      const nameTok = this.expect("ident", "parameter name");
      this.expect("eq", "'='");
      switch (nameTok.value) {
        case "store":
          store = this.expect("string", "store name").value;
          break;
        case "types": {
          this.expect("lparen", "'(' after types");
          types = [this.expect("string", "claim type").value];
          while (this.at("comma")) {
            this.next();
            types.push(this.expect("string", "claim type").value);
          }
          this.expect("rparen", "')'");
          break;
        }
        case "query":
          query = this.expect("string", "query string").value;
          break;
        case "param":
          params.push(this.parseValueExpr());
          break;
        default:
          throw new ParseError(
            `Unexpected store-query parameter '${nameTok.value}' (expected store, types, query, or param)`,
            nameTok,
          );
      }
    };

    readPair();
    while (this.at("comma")) {
      this.next();
      readPair();
    }
    const close = this.expect("rparen", "')'");

    if (store === undefined || types === undefined || query === undefined) {
      throw new ParseError(
        "Attribute-store query requires store, types, and query parameters",
        close,
      );
    }

    return {
      kind: "IssueAction",
      verb,
      form: "store",
      store,
      types,
      query,
      params,
      span: this.spanFrom(verbTok, close),
    };
  }

  private parseAssignment(): PropertyAssignment {
    const nameTok = this.expect("ident", "assignment target");
    const start = nameTok;

    let target: PropertyAssignment["target"];
    if (nameTok.value === "Properties") {
      this.expect("lbracket", "'[' after Properties");
      const key = this.expect("string", "property key");
      this.expect("rbracket", "']'");
      target = { property: "Properties", key: key.value };
    } else if (CLAIM_PROPERTIES.has(nameTok.value)) {
      target = nameTok.value as ClaimProperty;
    } else {
      throw new ParseError(
        `Unknown assignment target '${nameTok.value}'`,
        nameTok,
      );
    }

    this.expect("eq", "'='");
    const value = this.parseValueExpr();

    return {
      kind: "PropertyAssignment",
      target,
      value,
      span: { start: start.start, end: value.span.end },
    };
  }

  private parseValueExpr(): ValueExpr {
    const t = this.peek();

    if (t.type === "string") {
      this.next();
      return { kind: "StringLiteral", value: t.value, span: { start: t.start, end: t.end } };
    }

    if (t.type === "ident" && t.value === "RegExReplace") {
      return this.parseRegexReplace();
    }

    if (t.type === "ident") {
      // Member access: ident "." property
      const binding = this.next();
      this.expect("dot", "'.' after " + binding.value);
      const propTok = this.expect("ident", "claim property");
      if (!CLAIM_PROPERTIES.has(propTok.value)) {
        throw new ParseError(
          `Unknown claim property '${propTok.value}' in ${binding.value}.${propTok.value}`,
          propTok,
        );
      }
      return {
        kind: "MemberAccess",
        binding: binding.value,
        property: propTok.value as ClaimProperty,
        span: { start: binding.start, end: propTok.end },
      };
    }

    throw new ParseError(
      `Expected a value (string, member access, or RegExReplace), but found ${describe(t)}`,
      t,
    );
  }

  private parseRegexReplace(): ValueExpr {
    const start = this.expect("ident", "RegExReplace");
    this.expect("lparen", "'(' after RegExReplace");
    const input = this.parseValueExpr();
    this.expect("comma", "',' in RegExReplace");
    const pattern = this.expect("string", "regex pattern");
    this.expect("comma", "',' in RegExReplace");
    const replacement = this.expect("string", "replacement string");
    const close = this.expect("rparen", "')'");
    return {
      kind: "RegexReplaceCall",
      input,
      pattern: pattern.value,
      replacement: replacement.value,
      span: { start: start.start, end: close.end },
    };
  }
}

function describe(t: Token): string {
  if (t.type === "eof") return "end of input";
  if (t.type === "string") return `string ${JSON.stringify(t.value)}`;
  return `'${t.value}'`;
}

export interface ParseResult {
  ruleSet: RuleSet | null;
  error: ParseError | LexError | null;
}

/** Parse claim-rules text, returning either an AST or a structured error. */
export function parse(source: string): ParseResult {
  try {
    const tokens = tokenize(source);
    const ruleSet = new Parser(tokens).parseRuleSet();
    return { ruleSet, error: null };
  } catch (err) {
    if (err instanceof ParseError || err instanceof LexError) {
      return { ruleSet: null, error: err };
    }
    throw err;
  }
}

/** Parse and throw on failure — convenient for tests. */
export function parseOrThrow(source: string): RuleSet {
  const { ruleSet, error } = parse(source);
  if (error || !ruleSet) throw error ?? new Error("Unknown parse error");
  return ruleSet;
}
