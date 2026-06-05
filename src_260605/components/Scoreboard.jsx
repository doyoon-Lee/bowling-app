import React from "react";
import { displayTotal, renderFrameMark } from "../utils/bowling.jsx";

export default function Scoreboard({ result, scoreboardRef }) {
  return (
    <div className="laneScoreboard" ref={scoreboardRef}>
      {Array.from({ length: 10 }, (_, i) => {
        const frame = result.frames[i];
        return (
          <div className="frameBox" key={i}>
            <div className="frameNo">{i + 1}</div>
            <div className="frameMark">{renderFrameMark(frame?.mark)}</div>
            <div className="frameTotal">{displayTotal(frame?.total)}</div>
          </div>
        );
      })}
    </div>
  );
}
