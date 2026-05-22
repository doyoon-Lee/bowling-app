import React from "react";
import {
  formatPinButton,
  isGutterSpareAvailable,
  isTenthFrameGutterSpareAvailable,
  keypadNumbers,
} from "../utils/bowling";

export default function BeginnerKeypad({ next, rolls, onAddRoll, onCameraChange }) {
  return (
    <>
      <div className="scoreInputHeader">
        <div className="keypadTitle">핀 수 입력</div>
        <label className="cameraButton">
          📷 점수판 촬영
          <input type="file" accept="image/*" capture="environment" onChange={onCameraChange} />
        </label>
      </div>

      <div className="pinGrid keypad">
        {keypadNumbers
          .filter((pins) => {
            if (pins !== 10) return true;
            if (next?.canStrike) return true;
            if (isGutterSpareAvailable(next, rolls)) return true;
            return isTenthFrameGutterSpareAvailable(next, rolls);
          })
          .map((pins) => {
            const isGutterSpareButton = pins === 10 && isGutterSpareAvailable(next, rolls);
            const isTenthGutterSpareButton = pins === 10 && isTenthFrameGutterSpareAvailable(next, rolls);

            return (
              <button
                key={pins}
                disabled={!next || pins > next.max || (pins === 10 && !next.canStrike && !isGutterSpareButton && !isTenthGutterSpareButton)}
                onClick={() => onAddRoll(pins)}
                className={pins === 10 && next?.canStrike ? "pin strike" : "pin"}
              >
                {formatPinButton(pins, next, rolls)}
              </button>
            );
          })}
      </div>
    </>
  );
}
