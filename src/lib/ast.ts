// Abstract syntax tree for the ADFS Claim Rules Language.
//
// A claim-rules document is a sequence of rules. Each rule has optional
// `@Header = "..."` attributes (RuleTemplate, RuleName, ...), a list of
// conditions on the left of `=>`, and a single issuance action on the right.

export interface Position {
  /** 0-based offset into the source string. */
  offset: number;
  /** 1-based line number. */
  line: number;
  /** 1-based column number. */
  column: number;
}

export interface Span {
  start: Position;
  end: Position;
}

export interface RuleSet {
  kind: "RuleSet";
  rules: Rule[];
  span: Span;
}

export interface Rule {
  kind: "Rule";
  /** Header attributes such as RuleTemplate / RuleName, in source order. */
  headers: RuleHeader[];
  conditions: Condition[];
  action: Action;
  span: Span;
}

export interface RuleHeader {
  kind: "RuleHeader";
  /** Attribute name without the leading `@`, e.g. "RuleTemplate". */
  name: string;
  value: string;
  span: Span;
}

// ---------------------------------------------------------------------------
// Conditions (left of `=>`)
// ---------------------------------------------------------------------------

export type Condition = ClaimCondition | AggregateCondition;

export type ConditionOperator = "==" | "!=" | "=~" | "!~";

/** A claim selector, optionally bound to an identifier: `c:[Type == "..."]`. */
export interface ClaimCondition {
  kind: "ClaimCondition";
  /** Binding identifier (e.g. "c", "c1") or null when unbound. */
  binding: string | null;
  /** Property tests inside the brackets. May be empty for `[]`. */
  tests: ClaimPropertyTest[];
  span: Span;
}

export type ClaimProperty =
  | "Type"
  | "Value"
  | "ValueType"
  | "Issuer"
  | "OriginalIssuer";

export interface ClaimPropertyTest {
  kind: "ClaimPropertyTest";
  property: ClaimProperty;
  operator: ConditionOperator;
  /** Right-hand operand: a string literal, or a list for set membership. */
  operand: string | string[];
  span: Span;
}

/** `EXISTS([...])` / `NOT EXISTS([...])` aggregate condition. */
export interface AggregateCondition {
  kind: "AggregateCondition";
  /** The aggregate function name, e.g. "EXISTS". */
  fn: "EXISTS";
  negated: boolean;
  claim: ClaimCondition;
  span: Span;
}

// ---------------------------------------------------------------------------
// Actions (right of `=>`)
// ---------------------------------------------------------------------------

export type Action = IssueAction;

export type IssueVerb = "issue" | "add";

export type IssueAction =
  | CopyIssueAction
  | PropertyIssueAction
  | StoreQueryIssueAction;

export interface CopyIssueActionBase {
  kind: "IssueAction";
  verb: IssueVerb;
  span: Span;
}

/** `issue(claim = c)` — emit a bound claim unchanged. */
export interface CopyIssueAction extends CopyIssueActionBase {
  form: "copy";
  /** The binding identifier being copied. */
  claim: string;
}

/** `issue(Type = "...", Value = c.Value, ...)`. */
export interface PropertyIssueAction extends CopyIssueActionBase {
  form: "properties";
  assignments: PropertyAssignment[];
}

/** `issue(store = "...", types = (...), query = "...", param = ...)`. */
export interface StoreQueryIssueAction extends CopyIssueActionBase {
  form: "store";
  store: string;
  types: string[];
  query: string;
  params: ValueExpr[];
}

export interface PropertyAssignment {
  kind: "PropertyAssignment";
  /** Target: a claim property, or a custom Properties[...] key. */
  target: ClaimProperty | { property: "Properties"; key: string };
  value: ValueExpr;
  span: Span;
}

// ---------------------------------------------------------------------------
// Value expressions (right-hand side of assignments / store params)
// ---------------------------------------------------------------------------

export type ValueExpr = StringLiteral | MemberAccess | RegexReplaceCall;

export interface StringLiteral {
  kind: "StringLiteral";
  value: string;
  span: Span;
}

/** `c.Value`, `c.Type`, ... */
export interface MemberAccess {
  kind: "MemberAccess";
  binding: string;
  property: ClaimProperty;
  span: Span;
}

/** `RegExReplace(c.Value, "pattern", "replacement")`. */
export interface RegexReplaceCall {
  kind: "RegexReplaceCall";
  input: ValueExpr;
  pattern: string;
  replacement: string;
  span: Span;
}
