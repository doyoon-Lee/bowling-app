import React from "react";
import { displayTotal } from "../utils/bowling.jsx";
import FrameMarkDisplay from "./FrameMarkDisplay";

export default function Scoreboard({ result, scoreboardRef, splitFrames = [] }) {
  return (
    <div className="laneScoreboard" ref={scoreboardRef}>
      {Array.from({ length: 10 }, (_, i) => {
        const frame = result.frames[i];
        return (
          <div className="frameBox" key={i}>
            <div className="frameNo">{i + 1}</div>
            <div className="frameMark"><FrameMarkDisplay mark={frame?.mark} isSplit={splitFrames.includes(i + 1) || frame?.isSplit} /></div>
            <div className="frameTotal">{displayTotal(frame?.total)}</div>
          </div>
        );
      })}
    </div>
  );
}
