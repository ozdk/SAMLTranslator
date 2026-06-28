// Public API for the claim-rules engine.

export * from "./ast";
export { tokenize, LexError } from "./lexer";
export type { Token, TokenType } from "./lexer";
export { parse, parseOrThrow, ParseError } from "./parser";
export type { ParseResult } from "./parser";
export { explainRule, explainRuleSet } from "./explain";
export type { RuleExplanation } from "./explain";
export { generate, generateRule } from "./generate";
export type { GenerateOptions } from "./generate";
export {
  lookupClaimType,
  knownClaimTypes,
  friendlyClaimType,
  describeIssuer,
} from "./claimTypes";
export type { ClaimTypeInfo } from "./claimTypes";
export { PRESETS, presetById, str, member, claimCondition } from "./model";
export type { BuilderPreset } from "./model";

/** The example from the project brief — ADFS LdapClaims + permit rules. */
export const EXAMPLE_RULES = `@RuleTemplate = "LdapClaims"
@RuleName = "UPN and Roles"
c:[Type == "http://schemas.microsoft.com/ws/2008/06/identity/claims/windowsaccountname", Issuer == "AD AUTHORITY"]
 => issue(store = "Active Directory", types = ("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn", "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"), query = ";userPrincipalName,tokenGroups;{0}", param = c.Value);

 => issue(Type = "http://schemas.microsoft.com/authorization/claims/permit", Value = "true");
`;
