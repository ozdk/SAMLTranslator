// Serialize a claim-rules AST back into ADFS Claim Rules Language text.
// Round-trips with the parser: parse(generate(ast)) is structurally equal to ast.

import type {
  Action,
  ClaimCondition,
  Condition,
  PropertyAssignment,
  Rule,
  RuleSet,
  ValueExpr,
} from "./ast";

export interface GenerateOptions {
  /** Number of spaces to indent the action onto its own line. 0 = inline. */
  indent?: number;
}

function quote(s: string): string {
  // ADFS string contents are verbatim (no backslash escaping); a literal
  // double-quote cannot appear inside a string, so nothing needs escaping.
  return '"' + s + '"';
}

function genValue(expr: ValueExpr): string {
  switch (expr.kind) {
    case "StringLiteral":
      return quote(expr.value);
    case "MemberAccess":
      return `${expr.binding}.${expr.property}`;
    case "RegexReplaceCall":
      return `RegExReplace(${genValue(expr.input)}, ${quote(expr.pattern)}, ${quote(
        expr.replacement,
      )})`;
  }
}

function genClaimCondition(cond: ClaimCondition): string {
  const tests = cond.tests
    .map((t) => {
      const operand = Array.isArray(t.operand)
        ? `(${t.operand.map(quote).join(", ")})`
        : quote(t.operand);
      return `${t.property} ${t.operator} ${operand}`;
    })
    .join(", ");
  const inner = `[${tests}]`;
  return cond.binding ? `${cond.binding}:${inner}` : inner;
}

function genCondition(cond: Condition): string {
  if (cond.kind === "ClaimCondition") return genClaimCondition(cond);
  const prefix = cond.negated ? "NOT EXISTS" : "EXISTS";
  return `${prefix}(${genClaimCondition(cond.claim)})`;
}

function genAssignment(a: PropertyAssignment): string {
  const target =
    typeof a.target === "string"
      ? a.target
      : `Properties[${quote(a.target.key)}]`;
  return `${target} = ${genValue(a.value)}`;
}

function genAction(action: Action): string {
  switch (action.form) {
    case "copy":
      return `${action.verb}(claim = ${action.claim})`;
    case "properties":
      return `${action.verb}(${action.assignments.map(genAssignment).join(", ")})`;
    case "store": {
      const types = action.types.map(quote).join(", ");
      const params = action.params.map((p) => `param = ${genValue(p)}`).join(", ");
      const parts = [
        `store = ${quote(action.store)}`,
        `types = (${types})`,
        `query = ${quote(action.query)}`,
        ...(params ? [params] : []),
      ];
      return `${action.verb}(${parts.join(", ")})`;
    }
  }
}

export function generateRule(rule: Rule, options: GenerateOptions = {}): string {
  const indent = options.indent ?? 0;
  const lines: string[] = [];
  for (const h of rule.headers) {
    lines.push(`@${h.name} = ${quote(h.value)}`);
  }
  const conditions = rule.conditions.map(genCondition).join(" && ");
  const action = genAction(rule.action);
  if (indent > 0) {
    lines.push(`${conditions} =>`);
    lines.push(`${" ".repeat(indent)}${action};`);
  } else {
    lines.push(`${conditions} => ${action};`);
  }
  return lines.join("\n");
}

export function generate(ruleSet: RuleSet, options: GenerateOptions = {}): string {
  return ruleSet.rules.map((r) => generateRule(r, options)).join("\n\n");
}
