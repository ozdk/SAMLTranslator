import { describe, it, expect } from "vitest";
import { parseOrThrow } from "../parser";
import { explainRuleSet } from "../explain";
import { EXAMPLE_RULES } from "../index";

describe("explain", () => {
  it("explains the brief's LdapClaims rule in plain English", () => {
    const rs = parseOrThrow(EXAMPLE_RULES);
    const [ldap, permit] = explainRuleSet(rs);

    expect(ldap.name).toBe("UPN and Roles");
    expect(ldap.template).toBe("LdapClaims");
    // Condition mentions the friendly type and the AD authority issuer.
    expect(ldap.conditionText).toContain("Windows account name");
    expect(ldap.conditionText).toContain("Active Directory");
    // Action mentions the attribute store and the mapped output types.
    expect(ldap.actionText).toContain("attribute store");
    expect(ldap.actionText).toContain("UPN");
    expect(ldap.actionText).toContain("Role");
    expect(ldap.steps.length).toBeGreaterThan(1);

    // The permit rule is unconditional.
    expect(permit.conditionText.toLowerCase()).toContain("always");
    expect(permit.actionText).toContain("Permit");
  });

  it("uses friendly names for types and describes copy actions", () => {
    const rs = parseOrThrow(
      'c:[Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"] => issue(claim = c);',
    );
    const [e] = explainRuleSet(rs);
    expect(e.conditionText).toContain("Email address");
    expect(e.actionText.toLowerCase()).toContain("unchanged");
  });

  it("explains negated EXISTS as 'no claim'", () => {
    const rs = parseOrThrow(
      'NOT EXISTS([Type == "http://schemas.microsoft.com/ws/2008/06/identity/claims/role", Value == "admin"]) => issue(Type = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role", Value = "user");',
    );
    const [e] = explainRuleSet(rs);
    expect(e.conditionText.toLowerCase()).toContain("no claim");
  });

  it("maps query attributes positionally to their claim types", () => {
    const rs = parseOrThrow(EXAMPLE_RULES);
    const [ldap] = explainRuleSet(rs);
    // userPrincipalName → UPN, tokenGroups → Role
    expect(ldap.actionText).toContain("userPrincipalName → UPN");
    expect(ldap.actionText).toContain("tokenGroups → Role");
    expect(ldap.steps.some((s) => s.includes("userPrincipalName"))).toBe(true);
  });

  it("explains add() as pipeline-only", () => {
    const rs = parseOrThrow('c:[Type == "http://x/t"] => add(claim = c);');
    const [e] = explainRuleSet(rs);
    expect(e.actionText.toLowerCase()).toContain("not sent to the application");
  });
});
