import { useState } from "react";
import { friendlyClaimType, lookupClaimType } from "../lib";

function namespaceClass(uri: string): string {
  if (uri.includes("schemas.microsoft.com")) return "ns-ms";
  if (uri.includes("schemas.xmlsoap.org")) return "ns-xmlsoap";
  return "ns-other";
}

interface Props {
  uri: string;
  /** When true, render the full URI instead of the friendly short name. */
  showFull?: boolean;
}

/**
 * Renders a claim-type URI as a compact, copyable pill. Hover reveals the full
 * URI and a description; click copies the full URI to the clipboard.
 */
export function ClaimPill({ uri, showFull = false }: Props) {
  const [hover, setHover] = useState(false);
  const [copied, setCopied] = useState(false);
  const info = lookupClaimType(uri);
  const label = showFull ? uri : friendlyClaimType(uri);

  const copy = () => {
    navigator.clipboard?.writeText(uri).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1100);
      },
      () => {},
    );
  };

  return (
    <span
      className={`pill ${namespaceClass(uri)}`}
      role="button"
      tabIndex={0}
      aria-label={`Claim type ${friendlyClaimType(uri)}. ${uri}. Activate to copy the full URI.`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      onClick={(e) => {
        e.stopPropagation();
        copy();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          copy();
        }
      }}
    >
      <span className={showFull ? "full" : ""}>{label}</span>
      {copied && <span className="copied">copied ✓</span>}
      {hover && !copied && (
        <span className="tip" role="tooltip">
          <span className="tip-name">{info ? info.short : friendlyClaimType(uri)}</span>
          {info && <span style={{ display: "block", marginBottom: 4 }}>{info.description}</span>}
          <span className="tip-uri">{uri}</span>
          <span className="tip-hint">Click or press Enter to copy the full URI</span>
        </span>
      )}
    </span>
  );
}
