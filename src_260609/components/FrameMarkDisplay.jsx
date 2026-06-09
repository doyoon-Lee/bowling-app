import React from "react";
import { renderFrameMark } from "../utils/bowling.jsx";

function tokenizeMark(mark) {
  const normalized = renderFrameMark(mark).replace(/\u00A0/g, "").trim();
  if (!normalized) return [];
  return normalized.split(/\s*\|\s*/).filter(Boolean);
}

export default function FrameMarkDisplay({ mark, isSplit = false }) {
  const tokens = tokenizeMark(mark);
  if (!tokens.length) return <>{renderFrameMark(mark)}</>;

  return (
    <span className="frameMarkTokens">
      {tokens.map((token, index) => {
        const shouldCircle = isSplit && index === 0 && /^[0-9-]$/.test(token) && token !== "-";
        return (
          <React.Fragment key={`${token}-${index}`}>
            {index > 0 && <span className="frameMarkSeparator">|</span>}
            <span className={shouldCircle ? "splitRollMark" : ""}>{token}</span>
          </React.Fragment>
        );
      })}
    </span>
  );
}
