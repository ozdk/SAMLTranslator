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
export { EXAMPLES } from "./examples";
export type { Example } from "./examples";

import { EXAMPLES } from "./examples";

/** Default example shown on load — the ADFS LdapClaims + permit rules. */
export const EXAMPLE_RULES = EXAMPLES[0].rules;
