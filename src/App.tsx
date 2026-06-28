import { useState } from "react";
import { EXAMPLE_RULES, type Rule } from "./lib";
import { Translate } from "./components/Translate";
import { Build } from "./components/Build";

type Tab = "translate" | "build";

export function App() {
  const [tab, setTab] = useState<Tab>("translate");
  const [source, setSource] = useState<string>(EXAMPLE_RULES);
  const [showFull, setShowFull] = useState(false);

  // Rule sent from Translate → Build. The key forces Build to re-seed on send.
  const [seed, setSeed] = useState<Rule | null>(null);
  const [seedKey, setSeedKey] = useState(0);

  const sendToBuild = (rule: Rule) => {
    setSeed(rule);
    setSeedKey((k) => k + 1);
    setTab("build");
  };

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <span className="logo">
            SAML<span className="accent">Translator</span>
          </span>
          <span className="tagline">Decode &amp; build ADFS claim rules</span>
        </div>
        <div className="tabs" role="tablist" aria-label="Mode">
          <button
            role="tab"
            aria-selected={tab === "translate"}
            className={tab === "translate" ? "active" : ""}
            onClick={() => setTab("translate")}
          >
            Translate
          </button>
          <button
            role="tab"
            aria-selected={tab === "build"}
            className={tab === "build" ? "active" : ""}
            onClick={() => setTab("build")}
          >
            Build
          </button>
        </div>
      </div>

      {tab === "translate" ? (
        <Translate
          source={source}
          onSourceChange={setSource}
          showFull={showFull}
          onShowFullChange={setShowFull}
          onSendToBuild={sendToBuild}
        />
      ) : (
        <Build key={seedKey} seed={seed} />
      )}
    </div>
  );
}
