import { useMemo, useState } from "react";
import {
  claimCondition,
  generate,
  knownClaimTypes,
  member,
  str,
  type Rule,
  type Span,
} from "../lib";
import { CodeBlock } from "./CodeBlock";

const ZERO: Span = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

let rowUid = 0;
const nextRowId = () => `row-${rowUid++}`;

type BuildKind = "store" | "passthrough" | "transform" | "permit";

interface OutputRow {
  id: string;
  uri: string;
}

interface BuildState {
  presetId: string;
  kind: BuildKind;
  name: string;
  incomingType: string;
  issuer: string;
  store: string;
  query: string;
  outputs: OutputRow[];
  outType: string;
}

function out(uri: string): OutputRow {
  return { id: nextRowId(), uri };
}

const PRESET_CARDS: Array<{
  id: string;
  kind: BuildKind;
  label: string;
  desc: string;
  init: () => BuildState;
}> = [
  {
    id: "store-ldap",
    kind: "store",
    label: "Send LDAP attributes",
    desc: "Look up attributes in Active Directory and issue them as claims.",
    init: () => ({
      presetId: "store-ldap",
      kind: "store",
      name: "Send LDAP Attributes",
      incomingType: "http://schemas.microsoft.com/ws/2008/06/identity/claims/windowsaccountname",
      issuer: "AD AUTHORITY",
      store: "Active Directory",
      query: ";userPrincipalName,tokenGroups;{0}",
      outputs: [
        out("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn"),
        out("http://schemas.microsoft.com/ws/2008/06/identity/claims/role"),
      ],
      outType: "",
    }),
  },
  {
    id: "store-custom",
    kind: "store",
    label: "Transform via attribute store",
    desc: "Look up a value in a custom store (e.g. SQL) and issue it as a new claim.",
    init: () => ({
      presetId: "store-custom",
      kind: "store",
      name: "Enrich From Attribute Store",
      incomingType: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn",
      issuer: "",
      store: "Custom Attribute Store",
      query: "SELECT role FROM AppUsers WHERE upn = {0}",
      outputs: [out("http://schemas.microsoft.com/ws/2008/06/identity/claims/role")],
      outType: "",
    }),
  },
  {
    id: "passthrough",
    kind: "passthrough",
    label: "Pass through a claim",
    desc: "Forward an incoming claim of a given type unchanged.",
    init: () => ({
      presetId: "passthrough",
      kind: "passthrough",
      name: "Pass Through Claim",
      incomingType: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
      issuer: "",
      store: "",
      query: "",
      outputs: [],
      outType: "",
    }),
  },
  {
    id: "transform",
    kind: "transform",
    label: "Transform / map a claim",
    desc: "Re-issue an incoming claim's value as a different claim type.",
    init: () => ({
      presetId: "transform",
      kind: "transform",
      name: "Transform Claim",
      incomingType: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn",
      issuer: "",
      store: "",
      query: "",
      outputs: [],
      outType: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
    }),
  },
  {
    id: "permit",
    kind: "permit",
    label: "Permit everyone",
    desc: "Authorize all users to receive a token from the relying party.",
    init: () => ({
      presetId: "permit",
      kind: "permit",
      name: "Permit Everyone",
      incomingType: "",
      issuer: "",
      store: "",
      query: "",
      outputs: [],
      outType: "",
    }),
  },
];

function buildRule(s: BuildState): Rule {
  const headers = s.name
    ? [{ kind: "RuleHeader" as const, name: "RuleName", value: s.name, span: ZERO }]
    : [];
  const whenTests = [
    ...(s.incomingType
      ? [{ property: "Type" as const, operator: "==" as const, operand: s.incomingType }]
      : []),
    ...(s.issuer
      ? [{ property: "Issuer" as const, operator: "==" as const, operand: s.issuer }]
      : []),
  ];
  const conditions =
    s.kind === "permit" || whenTests.length === 0 ? [] : [claimCondition("c", whenTests)];

  let action: Rule["action"];
  switch (s.kind) {
    case "store":
      action = {
        kind: "IssueAction",
        verb: "issue",
        form: "store",
        store: s.store,
        types: s.outputs.map((o) => o.uri).filter(Boolean),
        query: s.query,
        params: [member("c", "Value")],
        span: ZERO,
      };
      break;
    case "passthrough":
      action = { kind: "IssueAction", verb: "issue", form: "copy", claim: "c", span: ZERO };
      break;
    case "transform":
      action = {
        kind: "IssueAction",
        verb: "issue",
        form: "properties",
        assignments: [
          { kind: "PropertyAssignment", target: "Type", value: str(s.outType), span: ZERO },
          { kind: "PropertyAssignment", target: "Value", value: member("c", "Value"), span: ZERO },
        ],
        span: ZERO,
      };
      break;
    case "permit":
      action = {
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
          { kind: "PropertyAssignment", target: "Value", value: str("true"), span: ZERO },
        ],
        span: ZERO,
      };
      break;
  }

  return { kind: "Rule", headers, conditions, action, span: ZERO };
}

/** Validate the form so the status badge tells the truth. */
function validate(s: BuildState): { ok: boolean; message: string } {
  if (s.kind !== "permit" && !s.incomingType.trim()) {
    return { ok: false, message: "Choose an incoming claim type" };
  }
  if (s.kind === "store") {
    if (!s.store.trim()) return { ok: false, message: "Name the attribute store" };
    if (!s.query.trim()) return { ok: false, message: "Add a query" };
    if (s.outputs.filter((o) => o.uri.trim()).length === 0) {
      return { ok: false, message: "Add at least one output claim" };
    }
  }
  if (s.kind === "transform" && !s.outType.trim()) {
    return { ok: false, message: "Choose the outgoing claim type" };
  }
  return { ok: true, message: "valid ✓" };
}

function ClaimTypeInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <input
      type="text"
      list="known-claim-types"
      value={value}
      aria-label={ariaLabel}
      placeholder={placeholder ?? "Claim type URI"}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Build({ seed }: { seed: Rule | null }) {
  // Seeded once on mount (the parent remounts via a changing key when a new
  // rule is sent from Translate), then freely editable.
  const [s, setState] = useState<BuildState>(
    () => seedToState(seed) ?? PRESET_CARDS[0].init(),
  );
  const [copied, setCopied] = useState(false);

  const set = (patch: Partial<BuildState>) => setState((prev) => ({ ...prev, ...patch }));

  const generated = useMemo(
    () => generate({ kind: "RuleSet", rules: [buildRule(s)], span: ZERO }, { indent: 4 }),
    [s],
  );
  const validity = useMemo(() => validate(s), [s]);

  const copy = () => {
    navigator.clipboard?.writeText(generated).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      },
      () => {},
    );
  };

  const k = s.kind;

  return (
    <div className="split">
      <div className="pane left">
        <div className="pane-head">
          <h2>Build a rule</h2>
        </div>
        <div className="pane-body">
          <div className="build-form">
            <div className="field">
              <label>Start from a template</label>
              <div className="preset-grid">
                {PRESET_CARDS.map((p) => (
                  <button
                    key={p.id}
                    className={`preset ${s.presetId === p.id ? "active" : ""}`}
                    onClick={() => setState(p.init())}
                  >
                    <div className="pl">{p.label}</div>
                    <div className="pd">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label htmlFor="rule-name">Rule name</label>
              <input
                id="rule-name"
                type="text"
                value={s.name}
                onChange={(e) => set({ name: e.target.value })}
              />
            </div>

            {k !== "permit" && (
              <div className="section when">
                <div className="sec-head">When — the incoming claim</div>
                <div className="sec-body">
                  <div className="field">
                    <label>Incoming claim type</label>
                    <ClaimTypeInput
                      ariaLabel="Incoming claim type"
                      value={s.incomingType}
                      onChange={(v) => set({ incomingType: v })}
                    />
                    <span className="help">Pick a friendly type or paste any claim-type URI.</span>
                  </div>
                  {k === "store" && (
                    <div className="field">
                      <label htmlFor="issuer">Issuer (optional)</label>
                      <input
                        id="issuer"
                        type="text"
                        value={s.issuer}
                        placeholder="e.g. AD AUTHORITY"
                        onChange={(e) => set({ issuer: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="section then">
              <div className="sec-head">Then — what to issue</div>
              <div className="sec-body">
                {k === "store" && (
                  <>
                    <div className="field">
                      <label htmlFor="store">Attribute store</label>
                      <input
                        id="store"
                        type="text"
                        value={s.store}
                        onChange={(e) => set({ store: e.target.value })}
                      />
                      <span className="help">
                        e.g. <code>Active Directory</code>, or a custom SQL / LDAP store you’ve
                        registered in AD FS.
                      </span>
                    </div>
                    <div className="field">
                      <label htmlFor="query">Query</label>
                      <input
                        id="query"
                        type="text"
                        value={s.query}
                        onChange={(e) => set({ query: e.target.value })}
                      />
                      <span className="help">
                        LDAP format: <code>;attr1,attr2;{"{0}"}</code> (attributes map in order to
                        the outputs below). <code>{"{0}"}</code> is the incoming claim value.
                      </span>
                    </div>
                    <div className="field">
                      <label>Output claim types</label>
                      {s.outputs.map((o, i) => (
                        <div className="maprow" key={o.id}>
                          <ClaimTypeInput
                            ariaLabel={`Output claim type ${i + 1}`}
                            value={o.uri}
                            onChange={(v) =>
                              set({
                                outputs: s.outputs.map((x) =>
                                  x.id === o.id ? { ...x, uri: v } : x,
                                ),
                              })
                            }
                          />
                          <span className="to" />
                          <span className="hint-inline">maps to query column {i + 1}</span>
                          <button
                            className="iconbtn"
                            title="Remove output"
                            aria-label="Remove output"
                            onClick={() =>
                              set({ outputs: s.outputs.filter((x) => x.id !== o.id) })
                            }
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        className="btn"
                        onClick={() => set({ outputs: [...s.outputs, out("")] })}
                      >
                        + Add output claim
                      </button>
                    </div>
                  </>
                )}

                {k === "passthrough" && (
                  <span className="hint-inline">
                    The matched claim is forwarded unchanged via <code>issue(claim = c)</code>.
                  </span>
                )}

                {k === "transform" && (
                  <div className="field">
                    <label>New (outgoing) claim type</label>
                    <ClaimTypeInput
                      ariaLabel="Outgoing claim type"
                      value={s.outType}
                      onChange={(v) => set({ outType: v })}
                    />
                    <span className="help">
                      The incoming claim’s value is re-issued under this type.
                    </span>
                  </div>
                )}

                {k === "permit" && (
                  <span className="hint-inline">
                    Issues the <code>permit</code> authorization claim for every request.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pane">
        <div className="pane-head">
          <h2>Generated claim rule</h2>
          <span className={`badge ${validity.ok ? "ok" : "bad"}`}>{validity.message}</span>
          <span className="spacer" />
          <button className="btn primary" onClick={copy} disabled={!validity.ok}>
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
        <div className="pane-body">
          <CodeBlock code={generated} />
        </div>
      </div>

      <datalist id="known-claim-types">
        {knownClaimTypes().map((t) => (
          <option key={t.uri} value={t.uri}>
            {t.short}
          </option>
        ))}
      </datalist>
    </div>
  );
}

/** Best-effort conversion of a translated Rule back into the builder form. */
function seedToState(rule: Rule | null): BuildState | null {
  if (!rule) return null;
  const name = rule.headers.find((h) => h.name === "RuleName")?.value ?? "";
  const cc = rule.conditions.find((c) => c.kind === "ClaimCondition");
  const claim = cc && cc.kind === "ClaimCondition" ? cc : null;
  const typeTest = claim?.tests.find((t) => t.property === "Type");
  const issuerTest = claim?.tests.find((t) => t.property === "Issuer");
  const incomingType = typeTest && !Array.isArray(typeTest.operand) ? typeTest.operand : "";
  const issuer = issuerTest && !Array.isArray(issuerTest.operand) ? issuerTest.operand : "";

  const a = rule.action;
  const base: BuildState = {
    presetId: "",
    kind: "store",
    name,
    incomingType,
    issuer,
    store: "",
    query: "",
    outputs: [],
    outType: "",
  };

  if (a.form === "store") {
    return {
      ...base,
      presetId: a.store === "Active Directory" ? "store-ldap" : "store-custom",
      kind: "store",
      store: a.store,
      query: a.query,
      outputs: a.types.map(out),
    };
  }
  if (a.form === "copy") {
    return { ...base, presetId: "passthrough", kind: "passthrough" };
  }
  // properties: distinguish permit from transform.
  const typeAsg = a.assignments.find(
    (x) => x.target === "Type" && x.value.kind === "StringLiteral",
  );
  const typeVal = typeAsg && typeAsg.value.kind === "StringLiteral" ? typeAsg.value.value : "";
  if (typeVal.includes("authorization/claims/permit")) {
    return { ...base, presetId: "permit", kind: "permit" };
  }
  return { ...base, presetId: "transform", kind: "transform", outType: typeVal };
}
