import { describe, it, expect } from "vitest";
import { parseOrThrow } from "../parser";
import { generate } from "../generate";
import { EXAMPLE_RULES } from "../index";
import { PRESETS } from "../model";

/** Strip spans so two ASTs can be compared structurally. */
function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "span") continue;
      out[k] = strip(v);
    }
    return out;
  }
  return value;
}

const SAMPLES = [
  EXAMPLE_RULES,
  'c:[Type == "http://x/upn"] => issue(claim = c);',
  'NOT EXISTS([Type == "http://x/role"]) => issue(Type = "http://x/role", Value = "user");',
  'c:[Value =~ "(?i)^contoso", Type == "http://x/n"] => issue(Type = "http://x/id", Value = RegExReplace(c.Value, "^a", "b"));',
  'c:[Type == ("http://x/a", "http://x/b")] => add(claim = c);',
  // Multiple conditions joined with && and a backslash-heavy regex pattern.
  'c1:[Type == "http://x/a"] && c2:[Type == "http://x/b"] => issue(claim = c1);',
  'c:[Type == "http://x/n"] => issue(Type = "http://x/id", Value = RegExReplace(c.Value, "(?<domain>[^\\]+)\\(?<user>.+)", "${user}"));',
];

describe("round-trip parse → generate → parse", () => {
  for (const sample of SAMPLES) {
    it(`is stable for: ${sample.slice(0, 40).replace(/\n/g, " ")}…`, () => {
      const ast1 = parseOrThrow(sample);
      const text = generate(ast1);
      const ast2 = parseOrThrow(text);
      expect(strip(ast2)).toEqual(strip(ast1));
    });
  }

  it("re-parses again identically (idempotent generate)", () => {
    const ast1 = parseOrThrow(EXAMPLE_RULES);
    const once = generate(ast1);
    const twice = generate(parseOrThrow(once));
    expect(twice).toBe(once);
  });
});

describe("builder presets generate valid, re-parseable rules", () => {
  for (const preset of PRESETS) {
    it(`preset "${preset.id}" round-trips`, () => {
      const rule = preset.build();
      const text = generate({ kind: "RuleSet", rules: [rule], span: rule.span });
      const reparsed = parseOrThrow(text);
      expect(strip(reparsed.rules[0])).toEqual(strip(rule));
    });
  }
});
