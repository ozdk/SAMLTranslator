import { Fragment } from "react";
import type {
  Action,
  ClaimCondition,
  ClaimProperty,
  Condition,
  ConditionOperator,
  PropertyAssignment,
  Rule,
  ValueExpr,
} from "../lib";
import { describeIssuer, explainRule } from "../lib";
import { ClaimPill } from "./ClaimPill";

const PROP_LABEL: Record<ClaimProperty, string> = {
  Type: "type",
  Value: "value",
  ValueType: "value type",
  Issuer: "issuer",
  OriginalIssuer: "original issuer",
};

const OP_WORD: Record<ConditionOperator, string> = {
  "==": "is",
  "!=": "is not",
  "=~": "matches",
  "!~": "doesn’t match",
};

function Lit({ children }: { children: React.ReactNode }) {
  return <span className="lit">“{children}”</span>;
}

function renderClaimCondition(cond: ClaimCondition, showFull: boolean) {
  if (cond.tests.length === 0) {
    return <span>any incoming claim is present</span>;
  }
  return (
    <span className="sentence">
      <span className="kw">an incoming claim where </span>
      {cond.tests.map((t, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="kw">{i === cond.tests.length - 1 ? " and " : ", "}</span>}
          <b>{PROP_LABEL[t.property]}</b>{" "}
          {t.operator === "==" && (t.property === "Issuer" || t.property === "OriginalIssuer") ? (
            <>
              <span className="kw">is</span>{" "}
              {Array.isArray(t.operand) ? (
                t.operand.join(", ")
              ) : (
                <span className="lit">{describeIssuer(t.operand)}</span>
              )}
            </>
          ) : (
            <>
              <span className="op">{OP_WORD[t.operator]}</span>{" "}
              {renderOperand(t.property, t.operand, showFull)}
            </>
          )}
        </Fragment>
      ))}
    </span>
  );
}

function renderOperand(
  property: ClaimProperty,
  operand: string | string[],
  showFull: boolean,
) {
  const one = (v: string, key: number) =>
    property === "Type" ? (
      <ClaimPill key={key} uri={v} showFull={showFull} />
    ) : (
      <Lit key={key}>{v}</Lit>
    );
  if (Array.isArray(operand)) {
    return (
      <>
        {operand.map((v, i) => (
          <Fragment key={i}>
            {i > 0 && <span className="kw"> or </span>}
            {one(v, i)}
          </Fragment>
        ))}
      </>
    );
  }
  return one(operand, 0);
}

function renderCondition(cond: Condition, showFull: boolean) {
  if (cond.kind === "ClaimCondition") {
    return <>There is {renderClaimCondition(cond, showFull)}.</>;
  }
  return (
    <>
      <b>{cond.negated ? "There is no " : "There exists a "}</b>
      claim where {renderClaimCondition(cond.claim, showFull)}.
    </>
  );
}

function renderValue(expr: ValueExpr, showFull: boolean): React.ReactNode {
  switch (expr.kind) {
    case "StringLiteral":
      return <Lit>{expr.value}</Lit>;
    case "MemberAccess":
      return (
        <span className="kw">
          the {PROP_LABEL[expr.property]} of the matched claim (<code>{expr.binding}</code>)
        </span>
      );
    case "RegexReplaceCall":
      return (
        <>
          {renderValue(expr.input, showFull)} <span className="kw">with </span>
          <Lit>{expr.pattern}</Lit> <span className="kw">replaced by </span>
          <Lit>{expr.replacement}</Lit>
        </>
      );
  }
}

function renderAssignment(a: PropertyAssignment, showFull: boolean) {
  if (a.target === "Type" && a.value.kind === "StringLiteral") {
    return (
      <>
        <span className="kw">set the </span>
        <b>type</b> <span className="kw">to </span>
        <ClaimPill uri={a.value.value} showFull={showFull} />
      </>
    );
  }
  const label =
    typeof a.target === "string" ? PROP_LABEL[a.target] : `property “${a.target.key}”`;
  return (
    <>
      <span className="kw">set the </span>
      <b>{label}</b> <span className="kw">to </span>
      {renderValue(a.value, showFull)}
    </>
  );
}

function renderAction(action: Action, showFull: boolean) {
  const verb = action.verb === "add" ? "Add to the pipeline" : "Issue";
  switch (action.form) {
    case "copy":
      return (
        <>
          <b>{verb}</b> the matched claim (<code>{action.claim}</code>) unchanged.
        </>
      );
    case "properties":
      return (
        <>
          <b>{verb}</b> a claim and{" "}
          {action.assignments.map((a, i) => (
            <Fragment key={i}>
              {i > 0 && <span className="kw">, </span>}
              {renderAssignment(a, showFull)}
            </Fragment>
          ))}
          .
        </>
      );
    case "store":
      return (
        <>
          <b>{verb}</b> claims by querying the <Lit>{action.store}</Lit> attribute store. Run the
          query <Lit>{action.query}</Lit>
          {action.params.length > 0 && (
            <>
              {" "}
              <span className="kw">passing </span>
              {action.params.map((p, i) => (
                <Fragment key={i}>
                  {i > 0 && <span className="kw">, </span>}
                  {renderValue(p, showFull)}
                </Fragment>
              ))}
            </>
          )}
          <span className="kw">, mapping the result(s) to: </span>
          {action.types.map((t, i) => (
            <Fragment key={i}>
              {i > 0 && " "}
              <ClaimPill uri={t} showFull={showFull} />
            </Fragment>
          ))}
          .
        </>
      );
  }
}

/** Incoming and outgoing claim types, for the flow diagram. */
function flowTypes(rule: Rule): { incoming: string[]; outgoing: string[] } {
  const incoming: string[] = [];
  for (const c of rule.conditions) {
    const cc = c.kind === "ClaimCondition" ? c : c.claim;
    for (const t of cc.tests) {
      if (t.property === "Type") {
        (Array.isArray(t.operand) ? t.operand : [t.operand]).forEach((u) => incoming.push(u));
      }
    }
  }
  const outgoing: string[] = [];
  const a = rule.action;
  if (a.form === "store") outgoing.push(...a.types);
  else if (a.form === "properties") {
    for (const asg of a.assignments) {
      if (asg.target === "Type" && asg.value.kind === "StringLiteral") {
        outgoing.push(asg.value.value);
      }
    }
  } else if (a.form === "copy") {
    incoming.forEach((u) => outgoing.push(u));
  }
  return { incoming: dedupe(incoming), outgoing: dedupe(outgoing) };
}

function dedupe(xs: string[]): string[] {
  return [...new Set(xs)];
}

interface Props {
  rule: Rule;
  index: number;
  showFull: boolean;
  onSendToBuild?: (rule: Rule) => void;
}

export function RuleCard({ rule, index, showFull, onSendToBuild }: Props) {
  const exp = explainRule(rule, index);
  const { incoming, outgoing } = flowTypes(rule);
  const showFlow = incoming.length > 0 || outgoing.length > 0;

  return (
    <div className="card">
      <div className="card-head">
        <span className="idx">{index + 1}</span>
        <span className="title">{exp.title}</span>
        {exp.template && <span className="tmpl">{exp.template}</span>}
        <span className="spacer" />
        {onSendToBuild && (
          <button className="btn ghost" onClick={() => onSendToBuild(rule)} title="Edit this rule in the Builder">
            Send to Build →
          </button>
        )}
      </div>

      <div className="clause when">
        <span className="lab">WHEN</span>
        <div className="body">
          {rule.conditions.length === 0 ? (
            <span className="kw">Always — this rule has no conditions, so it applies to every request.</span>
          ) : (
            rule.conditions.map((c, i) => (
              <div className="cond-line" key={i}>
                {i > 0 && <div className="cond-conn">…and at the same time…</div>}
                {renderCondition(c, showFull)}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="clause then">
        <span className="lab">THEN</span>
        <div className="body">
          <span className="sentence">{renderAction(rule.action, showFull)}</span>
        </div>
      </div>

      {showFlow && (
        <div className="flow">
          <div className="flow-node in">
            <div className="role">Incoming</div>
            <div className="flow-chips">
              {incoming.length ? (
                incoming.map((u, i) => <ClaimPill key={i} uri={u} showFull={false} />)
              ) : (
                <span className="hint-inline">any</span>
              )}
            </div>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-node rule">
            <div className="role">This rule</div>
            <div className="hint-inline">
              {rule.action.form === "store"
                ? "look up & map"
                : rule.action.form === "copy"
                  ? "pass through"
                  : "transform"}
            </div>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-node out">
            <div className="role">Outgoing</div>
            <div className="flow-chips">
              {outgoing.length ? (
                outgoing.map((u, i) => <ClaimPill key={i} uri={u} showFull={false} />)
              ) : (
                <span className="hint-inline">—</span>
              )}
            </div>
          </div>
        </div>
      )}

      <ol className="steps">
        {exp.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </div>
  );
}
