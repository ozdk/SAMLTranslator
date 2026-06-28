import { describe, it, expect } from "vitest";
import { EXAMPLES } from "../examples";
import { parse } from "../parser";
import { explainRuleSet } from "../explain";
import { generate } from "../generate";

describe("example library", () => {
  it("has unique ids and non-empty metadata", () => {
    const ids = EXAMPLES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of EXAMPLES) {
      expect(e.name.length).toBeGreaterThan(0);
      expect(e.description.length).toBeGreaterThan(0);
      expect(e.rules.trim().length).toBeGreaterThan(0);
    }
  });

  for (const ex of EXAMPLES) {
    it(`"${ex.id}" parses, explains, and round-trips`, () => {
      const { ruleSet, error } = parse(ex.rules);
      expect(error).toBeNull();
      expect(ruleSet).not.toBeNull();
      if (!ruleSet) return;
      expect(ruleSet.rules.length).toBeGreaterThan(0);

      // Every rule explains without throwing.
      const explained = explainRuleSet(ruleSet);
      expect(explained.length).toBe(ruleSet.rules.length);

      // Regenerated text re-parses to the same structure.
      const reparsed = parse(generate(ruleSet));
      expect(reparsed.error).toBeNull();
    });
  }
});
