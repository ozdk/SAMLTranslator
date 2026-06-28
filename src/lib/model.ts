// Builder presets — factory helpers that produce claim-rules AST `Rule`s for
// the most common ADFS templates. The Builder UI edits these structures and
// `generate()` turns them back into claim-rules text.

import type {
  ClaimCondition,
  ClaimProperty,
  ConditionOperator,
  Rule,
  Span,
  ValueExpr,
} from "./ast";

// All AST nodes carry source spans; builder-created nodes have no real source,
// so use a zero span everywhere.
const ZERO: Span = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

export function str(value: string): ValueExpr {
  return { kind: "StringLiteral", value, span: ZERO };
}

export function member(binding: string, property: ClaimProperty): ValueExpr {
  return { kind: "MemberAccess", binding, property, span: ZERO };
}

export function claimCondition(
  binding: string | null,
  tests: Array<{
    property: ClaimProperty;
    operator: ConditionOperator;
    operand: string | string[];
  }>,
): ClaimCondition {
  return {
    kind: "ClaimCondition",
    binding,
    tests: tests.map((t) => ({ kind: "ClaimPropertyTest", ...t, span: ZERO })),
    span: ZERO,
  };
}

export interface BuilderPreset {
  id: string;
  label: string;
  description: string;
  build(): Rule;
}

const WINDOWS_ACCOUNT_NAME =
  "http://schemas.microsoft.com/ws/2008/06/identity/claims/windowsaccountname";

export const PRESETS: BuilderPreset[] = [
  {
    id: "ldap",
    label: "Send LDAP attributes (LdapClaims)",
    description:
      "Look up attributes in Active Directory and issue them as claims.",
    build: (): Rule => ({
      kind: "Rule",
      headers: [
        { kind: "RuleHeader", name: "RuleTemplate", value: "LdapClaims", span: ZERO },
        { kind: "RuleHeader", name: "RuleName", value: "Send LDAP Attributes", span: ZERO },
      ],
      conditions: [
        claimCondition("c", [
          { property: "Type", operator: "==", operand: WINDOWS_ACCOUNT_NAME },
          { property: "Issuer", operator: "==", operand: "AD AUTHORITY" },
        ]),
      ],
      action: {
        kind: "IssueAction",
        verb: "issue",
        form: "store",
        store: "Active Directory",
        types: ["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"],
        query: ";mail;{0}",
        params: [member("c", "Value")],
        span: ZERO,
      },
      span: ZERO,
    }),
  },
  {
    id: "passthrough",
    label: "Pass through a claim (PassThroughClaims)",
    description: "Forward an incoming claim of a given type unchanged.",
    build: (): Rule => ({
      kind: "Rule",
      headers: [
        { kind: "RuleHeader", name: "RuleTemplate", value: "PassThroughClaims", span: ZERO },
        { kind: "RuleHeader", name: "RuleName", value: "Pass Through Claim", span: ZERO },
      ],
      conditions: [
        claimCondition("c", [
          {
            property: "Type",
            operator: "==",
            operand: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
          },
        ]),
      ],
      action: {
        kind: "IssueAction",
        verb: "issue",
        form: "copy",
        claim: "c",
        span: ZERO,
      },
      span: ZERO,
    }),
  },
  {
    id: "transform",
    label: "Transform / map a claim (TransformClaims)",
    description: "Take one claim's value and re-issue it as a different type.",
    build: (): Rule => ({
      kind: "Rule",
      headers: [
        { kind: "RuleHeader", name: "RuleTemplate", value: "MapClaims", span: ZERO },
        { kind: "RuleHeader", name: "RuleName", value: "Transform Claim", span: ZERO },
      ],
      conditions: [
        claimCondition("c", [
          {
            property: "Type",
            operator: "==",
            operand: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn",
          },
        ]),
      ],
      action: {
        kind: "IssueAction",
        verb: "issue",
        form: "properties",
        assignments: [
          {
            kind: "PropertyAssignment",
            target: "Type",
            value: str("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"),
            span: ZERO,
          },
          {
            kind: "PropertyAssignment",
            target: "Value",
            value: member("c", "Value"),
            span: ZERO,
          },
        ],
        span: ZERO,
      },
      span: ZERO,
    }),
  },
  {
    id: "permit-all",
    label: "Permit everyone (issuance authorization)",
    description: "Authorize all users to receive a token from the relying party.",
    build: (): Rule => ({
      kind: "Rule",
      headers: [
        { kind: "RuleHeader", name: "RuleName", value: "Permit Everyone", span: ZERO },
      ],
      conditions: [],
      action: {
        kind: "IssueAction",
        verb: "issue",
        form: "properties",
        assignments: [
          {
            kind: "PropertyAssignment",
            target: "Type",
            value: str("http://schemas.microsoft.com/authorization/claims/permit"),
            span: ZERO,
          },
          {
            kind: "PropertyAssignment",
            target: "Value",
            value: str("true"),
            span: ZERO,
          },
        ],
        span: ZERO,
      },
      span: ZERO,
    }),
  },
];

export function presetById(id: string): BuilderPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}
