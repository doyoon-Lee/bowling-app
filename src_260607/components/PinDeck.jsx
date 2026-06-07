import React from "react";

const pinLayout = [
  { pin: 7, className: "deckPin p7" },
  { pin: 8, className: "deckPin p8" },
  { pin: 9, className: "deckPin p9" },
  { pin: 10, className: "deckPin p10" },
  { pin: 4, className: "deckPin p4" },
  { pin: 5, className: "deckPin p5" },
  { pin: 6, className: "deckPin p6" },
  { pin: 2, className: "deckPin p2" },
  { pin: 3, className: "deckPin p3" },
  { pin: 1, className: "deckPin p1" },
];

export default function PinDeck({ selectedPins, disabledPins = [], onToggle, title, helper }) {
  const disabledSet = new Set(disabledPins);

  return (
    <div className="pinDeckWrap">
      <div className="pinDeckHeader">
        <strong>{title}</strong>
        <span>{helper}</span>
      </div>

      <div className="pinDeck">
        {pinLayout.map(({ pin, className }) => (
          <button
            key={pin}
            type="button"
            disabled={disabledSet.has(pin)}
            className={`${className} ${selectedPins.includes(pin) ? "selected" : ""}`}
            onClick={() => onToggle(pin)}
          >
            {pin}
          </button>
        ))}
      </div>
    </div>
  );
}
