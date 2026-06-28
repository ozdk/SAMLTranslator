// Turn a parsed claim-rules AST into plain-English explanations.

import type {
  Action,
  AggregateCondition,
  ClaimCondition,
  ClaimProperty,
  ClaimPropertyTest,
  Condition,
  ConditionOperator,
  PropertyAssignment,
  Rule,
  RuleSet,
  ValueExpr,
} from "./ast";
import { describeIssuer, friendlyClaimType } from "./claimTypes";

export interface RuleExplanation {
  /** A one-line summary headline for the rule. */
  title: string;
  /** What the rule template was, if any (e.g. "LdapClaims"). */
  template: string | null;
  /** The author-given rule name, if any. */
  name: string | null;
  /** Plain-English description of the conditions ("when ..."). */
  conditionText: string;
  /** Plain-English description of the action ("then ..."). */
  actionText: string;
  /** A combined multi-line narrative. */
  narrative: string;
  /** Bullet-point steps for a step-by-step view. */
  steps: string[];
}

const PROPERTY_LABEL: Record<ClaimProperty, string> = {
  Type: "type",
  Value: "value",
  ValueType: "value type",
  Issuer: "issuer",
  OriginalIssuer: "original issuer",
};

function operatorPhrase(op: ConditionOperator): string {
  switch (op) {
    case "==":
      return "is";
    case "!=":
      return "is not";
    case "=~":
      return "matches the pattern";
    case "!~":
      return "does not match the pattern";
  }
}

function renderOperand(
  property: ClaimProperty,
  operand: string | string[],
): string {
  const one = (v: string): string =>
    property === "Type" ? `${friendlyClaimType(v)}` : `"${v}"`;
  if (Array.isArray(operand)) {
    return operand.map(one).join(" or ");
  }
  return one(operand);
}

function explainPropertyTest(test: ClaimPropertyTest): string {
  const label = PROPERTY_LABEL[test.property];
  // Issuer reads better with the friendly issuer description.
  if (test.property === "Issuer" || test.property === "OriginalIssuer") {
    if (!Array.isArray(test.operand) && test.operator === "==") {
      return `the ${label} is ${describeIssuer(test.operand)}`;
    }
  }
  return `the ${label} ${operatorPhrase(test.operator)} ${renderOperand(
    test.property,
    test.operand,
  )}`;
}

function explainClaimCondition(cond: ClaimCondition): string {
  if (cond.tests.length === 0) {
    return "there is an incoming claim";
  }
  const parts = cond.tests.map(explainPropertyTest);
  const joined =
    parts.length === 1
      ? parts[0]
      : parts.slice(0, -1).join(", ") + ", and " + parts[parts.length - 1];
  return `there is an incoming claim where ${joined}`;
}

function explainAggregate(cond: AggregateCondition): string {
  const inner = explainClaimCondition(cond.claim);
  return cond.negated
    ? `there is no claim where ${stripLead(inner)}`
    : `there exists a claim where ${stripLead(inner)}`;
}

/** Drop the "there is an incoming claim where" lead so it reads cleanly. */
function stripLead(text: string): string {
  return text
    .replace(/^there is an incoming claim where /, "")
    .replace(/^there is an incoming claim$/, "any claim is present");
}

function explainCondition(cond: Condition): string {
  return cond.kind === "ClaimCondition"
    ? explainClaimCondition(cond)
    : explainAggregate(cond);
}

function explainConditions(conds: Condition[]): string {
  if (conds.length === 0) {
    return "Always (this rule has no conditions, so it applies to every request)";
  }
  const parts = conds.map(explainCondition);
  if (parts.length === 1) return capitalize(parts[0]);
  return capitalize(parts.join("; and "));
}

function explainValue(expr: ValueExpr): string {
  switch (expr.kind) {
    case "StringLiteral":
      return `the literal text "${expr.value}"`;
    case "MemberAccess":
      return `the ${PROPERTY_LABEL[expr.property]} of the matched claim (${expr.binding})`;
    case "RegexReplaceCall":
      return `${explainValue(expr.input)}, with the pattern "${expr.pattern}" replaced by "${expr.replacement}"`;
  }
}

function explainAssignmentTarget(target: PropertyAssignment["target"]): string {
  if (typeof target === "string") return PROPERTY_LABEL[target];
  return `the custom property "${target.key}"`;
}

function explainAction(action: Action): { text: string; steps: string[] } {
  const verb = action.verb === "add" ? "Add to the pipeline" : "Issue";
  const verbNote =
    action.verb === "add"
      ? " (added to the claim set for use by later rules, not sent to the application)"
      : " (sent to the relying-party application, and also available to later rules in this rule set)";

  switch (action.form) {
    case "copy":
      return {
        text: `${verb} the matched claim (${action.claim}) unchanged${verbNote}.`,
        steps: [`${verb} the matched claim (${action.claim}) as-is${verbNote}.`],
      };

    case "properties": {
      const lines = action.assignments.map((a) => {
        if (typeof a.target === "string" && a.target === "Type") {
          if (a.value.kind === "StringLiteral") {
            return `set the claim type to ${friendlyClaimType(a.value.value)}`;
          }
        }
        return `set ${explainAssignmentTarget(a.target)} to ${explainValue(a.value)}`;
      });
      const summary = lines.join(", ");
      return {
        text: `${verb} a claim where ${summary}${verbNote}.`,
        steps: [`${verb} a new claim${verbNote}:`, ...lines.map(capitalize)],
      };
    }

    case "store": {
      const typeList = action.types.map(friendlyClaimType).join(", ");
      const params = action.params.map(explainValue).join("; ");
      // The query's attribute segment maps positionally to the `types` list:
      // attribute[i] is issued as types[i]. Surface that correspondence.
      const mappings = storeMappings(action.query, action.types);
      const mappingText = mappings
        .map((m) => `${m.attribute} → ${friendlyClaimType(m.type)}`)
        .join(", ");

      const text =
        `${verb} claims by querying the "${action.store}" attribute store. ` +
        `Run the query "${action.query}"` +
        (action.params.length
          ? ` (where {0} is filled in with ${params})`
          : "") +
        (mappings.length
          ? `, issuing each looked-up attribute as a claim: ${mappingText}${verbNote}.`
          : `, and map the returned column(s) to: ${typeList}${verbNote}.`);

      const steps = [
        `Look up data in the "${action.store}" attribute store.`,
        `Run the query "${action.query}"${
          action.params.length ? `, substituting ${params} for {0}` : ""
        }.`,
        ...(mappings.length
          ? mappings.map(
              (m) => `Issue the "${m.attribute}" value as a ${friendlyClaimType(m.type)} claim.`,
            )
          : [`Emit the result(s) as: ${typeList}.`]),
      ];
      return { text, steps };
    }
  }
}

/**
 * Pair the attributes named in an attribute-store query with the claim types
 * they are issued as. The LDAP query format is `<filter>;<attrs>;<param>`, and
 * the comma-separated attributes map positionally onto the `types` list. If the
 * query doesn't fit this shape (e.g. a SQL store), returns [] so the caller can
 * fall back to a plain type list.
 */
function storeMappings(
  query: string,
  types: string[],
): Array<{ attribute: string; type: string }> {
  const segments = query.split(";");
  if (segments.length < 2) return [];
  const attrs = segments[1]
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
  if (attrs.length !== types.length || attrs.length === 0) return [];
  return attrs.map((attribute, i) => ({ attribute, type: types[i] }));
}

function header(rule: Rule, name: string): string | null {
  const h = rule.headers.find((x) => x.name === name);
  return h ? h.value : null;
}

export function explainRule(rule: Rule, index: number): RuleExplanation {
  const template = header(rule, "RuleTemplate");
  const name = header(rule, "RuleName");
  const conditionText = explainConditions(rule.conditions);
  const { text: actionText, steps: actionSteps } = explainAction(rule.action);

  const title =
    name ??
    (template ? `${template} rule` : `Rule ${index + 1}`);

  const whenLine =
    rule.conditions.length === 0
      ? "When: every request (unconditional)."
      : `When: ${conditionText}.`;
  const thenLine = `Then: ${actionText}`;

  const narrative = [whenLine, thenLine].join("\n");

  const steps = [
    rule.conditions.length === 0
      ? "This rule always runs."
      : `Check that ${lowerFirst(conditionText)}.`,
    ...actionSteps,
  ];

  return {
    title,
    template,
    name,
    conditionText,
    actionText,
    narrative,
    steps,
  };
}

export function explainRuleSet(ruleSet: RuleSet): RuleExplanation[] {
  return ruleSet.rules.map((r, i) => explainRule(r, i));
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

function lowerFirst(s: string): string {
  return s.length ? s[0].toLowerCase() + s.slice(1) : s;
}
