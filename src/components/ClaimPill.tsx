import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

const MARGIN = 8; // min gap from viewport edges

/**
 * Renders a claim-type URI as a compact, copyable pill. Hover/focus reveals the
 * full URI and a description in a viewport-clamped tooltip (rendered through a
 * portal so it never clips against pane edges); click copies the full URI.
 */
export function ClaimPill({ uri, showFull = false }: Props) {
  const [hover, setHover] = useState(false);
  const [copied, setCopied] = useState(false);
  const pillRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; placement: "top" | "bottom" }>({
    left: 0,
    top: 0,
    placement: "top",
  });
  const info = lookupClaimType(uri);
  const label = showFull ? uri : friendlyClaimType(uri);

  const showTip = hover && !copied;

  // Measure pill + tooltip once both are in the DOM, then clamp into the viewport.
  useLayoutEffect(() => {
    if (!showTip) return;
    const pill = pillRef.current;
    const tip = tipRef.current;
    if (!pill || !tip) return;

    const reposition = () => {
      const p = pill.getBoundingClientRect();
      const t = tip.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;

      let left = p.left;
      const maxLeft = vw - t.width - MARGIN;
      if (left > maxLeft) left = maxLeft;
      if (left < MARGIN) left = MARGIN;

      const fitsAbove = p.top - t.height - 6 >= MARGIN;
      const placement: "top" | "bottom" = fitsAbove ? "top" : "bottom";
      const top = placement === "top" ? p.top - t.height - 6 : p.bottom + 6;

      setPos({ left, top: Math.min(Math.max(top, MARGIN), vh - t.height - MARGIN), placement });
    };

    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [showTip, uri]);

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
      ref={pillRef}
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
      {showTip &&
        createPortal(
          <span
            ref={tipRef}
            className={`tip tip--${pos.placement}`}
            role="tooltip"
            style={{ left: pos.left, top: pos.top }}
          >
            <span className="tip-name">{info ? info.short : friendlyClaimType(uri)}</span>
            {info && <span style={{ display: "block", marginBottom: 4 }}>{info.description}</span>}
            <span className="tip-uri">{uri}</span>
            <span className="tip-hint">Click or press Enter to copy the full URI</span>
          </span>,
          document.body,
        )}
    </span>
  );
}
