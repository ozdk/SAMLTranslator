import { useMemo } from "react";
import { EXAMPLES, parse, type Rule } from "../lib";
import { RuleCard } from "./RuleCard";
import { CodeEditor } from "./CodeEditor";

interface Props {
  source: string;
  onSourceChange: (s: string) => void;
  showFull: boolean;
  onShowFullChange: (b: boolean) => void;
  onSendToBuild: (rule: Rule) => void;
}

/** Render a parse error with the offending line and a caret at the column. */
function ErrorView({ source, error }: { source: string; error: NonNullable<ReturnType<typeof parse>["error"]> }) {
  const pos = "token" in error ? error.token.start : error.position;
  const lines = source.split("\n");
  const lineText = lines[pos.line - 1] ?? "";
  const caret = " ".repeat(Math.max(0, pos.column - 1)) + "^";
  return (
    <div className="errbox">
      <div className="etitle">Couldn’t parse the claim rules</div>
      <div className="eloc">
        Line {pos.line}, column {pos.column}: {error.message}
      </div>
      <pre>
        {lineText}
        {"\n"}
        <span className="caret">{caret}</span>
      </pre>
    </div>
  );
}

export function Translate({
  source,
  onSourceChange,
  showFull,
  onShowFullChange,
  onSendToBuild,
}: Props) {
  const result = useMemo(() => parse(source), [source]);
  const trimmed = source.trim();

  const loadExample = (id: string) => {
    const ex = EXAMPLES.find((e) => e.id === id);
    if (ex) onSourceChange(ex.rules);
  };

  return (
    <div className="split">
      <div className="pane left">
        <div className="pane-head">
          <h2>Claim rules</h2>
          <span className="spacer" />
          <select
            className="select-btn"
            aria-label="Load an example claim rule"
            value=""
            onChange={(e) => loadExample(e.target.value)}
          >
            <option value="" disabled>
              Load example…
            </option>
            {EXAMPLES.map((ex) => (
              <option key={ex.id} value={ex.id} title={ex.description}>
                {ex.name}
              </option>
            ))}
          </select>
        </div>
        <div className="pane-body">
          <CodeEditor
            value={source}
            onChange={onSourceChange}
            ariaLabel="Claim rules source"
            placeholder={
              "Paste your ADFS claim rules here…\n\nExample:\nc:[Type == \"…/upn\"] => issue(claim = c);"
            }
          />
        </div>
      </div>

      <div className="pane">
        <div className="pane-head">
          <h2>Plain English</h2>
          <span className="spacer" />
          <label className="toggle">
            <input
              type="checkbox"
              checked={showFull}
              onChange={(e) => onShowFullChange(e.target.checked)}
            />
            Show full URIs
          </label>
        </div>
        <div className="pane-body">
          {trimmed === "" ? (
            <div className="empty">
              Paste claim rules on the left to see them explained in plain English.
            </div>
          ) : result.error ? (
            <ErrorView source={source} error={result.error} />
          ) : result.ruleSet && result.ruleSet.rules.length > 0 ? (
            <div className="cards">
              {result.ruleSet.rules.map((rule, i) => (
                <RuleCard
                  key={i}
                  rule={rule}
                  index={i}
                  showFull={showFull}
                  onSendToBuild={onSendToBuild}
                />
              ))}
            </div>
          ) : (
            <div className="empty">No rules found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
