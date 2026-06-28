import { describe, it, expect } from "vitest";
import { parse, parseOrThrow } from "../parser";
import { EXAMPLE_RULES } from "../index";

describe("parser", () => {
  it("parses the LdapClaims store query from the brief", () => {
    const rs = parseOrThrow(EXAMPLE_RULES);
    expect(rs.rules).toHaveLength(2);

    const [ldap, permit] = rs.rules;

    expect(ldap.headers).toEqual([
      expect.objectContaining({ name: "RuleTemplate", value: "LdapClaims" }),
      expect.objectContaining({ name: "RuleName", value: "UPN and Roles" }),
    ]);
    expect(ldap.conditions).toHaveLength(1);
    const cond = ldap.conditions[0];
    expect(cond.kind).toBe("ClaimCondition");
    if (cond.kind === "ClaimCondition") {
      expect(cond.binding).toBe("c");
      expect(cond.tests).toHaveLength(2);
      expect(cond.tests[0].property).toBe("Type");
      expect(cond.tests[1].property).toBe("Issuer");
    }
    expect(ldap.action.form).toBe("store");
    if (ldap.action.form === "store") {
      expect(ldap.action.store).toBe("Active Directory");
      expect(ldap.action.types).toHaveLength(2);
      expect(ldap.action.query).toBe(";userPrincipalName,tokenGroups;{0}");
      expect(ldap.action.params).toHaveLength(1);
    }

    expect(permit.conditions).toHaveLength(0);
    expect(permit.action.form).toBe("properties");
  });

  it("parses a pass-through copy action", () => {
    const rs = parseOrThrow(
      'c:[Type == "http://x/upn"] => issue(claim = c);',
    );
    const a = rs.rules[0].action;
    expect(a.form).toBe("copy");
    if (a.form === "copy") expect(a.claim).toBe("c");
  });

  it("parses member-access and RegExReplace values", () => {
    const rs = parseOrThrow(
      'c:[Type == "http://x/name"] => issue(Type = "http://x/id", Value = RegExReplace(c.Value, "(?i)^domain\\\\\\\\", ""));',
    );
    const a = rs.rules[0].action;
    expect(a.form).toBe("properties");
    if (a.form === "properties") {
      expect(a.assignments[1].value.kind).toBe("RegexReplaceCall");
      if (a.assignments[1].value.kind === "RegexReplaceCall") {
        expect(a.assignments[1].value.input.kind).toBe("MemberAccess");
      }
    }
  });

  it("parses multiple conditions joined by &&", () => {
    const rs = parseOrThrow(
      'c1:[Type == "http://x/role", Value == "admin"] && c2:[Type == "http://x/group"] => issue(claim = c1);',
    );
    expect(rs.rules[0].conditions).toHaveLength(2);
    const [a, b] = rs.rules[0].conditions;
    if (a.kind === "ClaimCondition") expect(a.binding).toBe("c1");
    if (b.kind === "ClaimCondition") expect(b.binding).toBe("c2");
  });

  it("rejects commas used between top-level conditions", () => {
    const { error } = parse(
      'c1:[Type == "http://x/a"], c2:[Type == "http://x/b"] => issue(claim = c1);',
    );
    expect(error).not.toBeNull();
  });

  it("keeps backslashes verbatim in regex patterns", () => {
    const rs = parseOrThrow(
      'c:[Type == "http://x/n"] => issue(Type = "http://x/id", Value = RegExReplace(c.Value, "(?<domain>[^\\]+)\\(?<user>.+)", "${user}"));',
    );
    const a = rs.rules[0].action;
    if (a.form === "properties" && a.assignments[1].value.kind === "RegexReplaceCall") {
      expect(a.assignments[1].value.pattern).toBe("(?<domain>[^\\]+)\\(?<user>.+)");
    }
  });

  it("parses EXISTS and NOT EXISTS aggregates", () => {
    const rs = parseOrThrow(
      'NOT EXISTS([Type == "http://x/role", Value == "admin"]) => issue(Type = "http://x/role", Value = "user");',
    );
    const cond = rs.rules[0].conditions[0];
    expect(cond.kind).toBe("AggregateCondition");
    if (cond.kind === "AggregateCondition") {
      expect(cond.negated).toBe(true);
      expect(cond.fn).toBe("EXISTS");
    }
  });

  it("parses all four condition operators", () => {
    const rs = parseOrThrow(
      'c:[Value =~ "a", Value !~ "b", Value != "c", Type == "http://x/t"] => issue(claim = c);',
    );
    const cond = rs.rules[0].conditions[0];
    if (cond.kind === "ClaimCondition") {
      expect(cond.tests.map((t) => t.operator)).toEqual(["=~", "!~", "!=", "=="]);
    }
  });

  it("parses a set-membership operand list", () => {
    const rs = parseOrThrow(
      'c:[Type == ("http://x/a", "http://x/b")] => issue(claim = c);',
    );
    const cond = rs.rules[0].conditions[0];
    if (cond.kind === "ClaimCondition") {
      expect(cond.tests[0].operand).toEqual(["http://x/a", "http://x/b"]);
    }
  });

  it("parses Properties[...] custom assignment targets", () => {
    const rs = parseOrThrow(
      'c:[Type == "http://x/n"] => issue(Type = "http://x/id", Value = c.Value, Properties["http://schemas.xmlsoap.org/ws/2005/05/identity/claimproperties/format"] = "urn:format");',
    );
    const a = rs.rules[0].action;
    if (a.form === "properties") {
      const t = a.assignments[2].target;
      expect(typeof t === "object" && t.property).toBe("Properties");
    }
  });

  it("tolerates comments", () => {
    const rs = parseOrThrow(
      '// leading comment\nc:[Type == "http://x/t"] => issue(claim = c); /* trailing */',
    );
    expect(rs.rules).toHaveLength(1);
  });

  it("returns a structured error on malformed input", () => {
    const { error } = parse('c:[Type == ] => issue(claim = c);');
    expect(error).not.toBeNull();
    expect(error?.name).toBe("ParseError");
  });

  it("reports an unterminated string", () => {
    const { error } = parse('c:[Type == "unclosed] => issue(claim = c);');
    expect(error?.name).toBe("LexError");
  });

  it("errors on an unknown claim property", () => {
    const { error } = parse('c:[Bogus == "x"] => issue(claim = c);');
    expect(error?.name).toBe("ParseError");
  });
});
