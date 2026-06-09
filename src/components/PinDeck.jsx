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

      <div className="pinDeck" aria-label={title}>
        {pinLayout.map(({ pin, className }) => {
          const isSelected = selectedPins.includes(pin);

          return (
            <button
              key={pin}
              type="button"
              disabled={disabledSet.has(pin)}
              aria-pressed={isSelected}
              aria-label={`${pin}번 핀`}
              className={`${className} ${isSelected ? "selected" : ""}`}
              onClick={() => onToggle(pin)}
            >
              <svg className="deckPinSvg" viewBox="0 0 64 100" aria-hidden="true" focusable="false">
                <defs>
                  <linearGradient id={`pinBodyGradient-${pin}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="58%" stopColor="#f8fbff" />
                    <stop offset="100%" stopColor="#dfeaf5" />
                  </linearGradient>
                  <linearGradient id={`pinSideShadow-${pin}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgba(15,23,42,0.16)" />
                    <stop offset="50%" stopColor="rgba(15,23,42,0)" />
                    <stop offset="100%" stopColor="rgba(15,23,42,0.18)" />
                  </linearGradient>
                </defs>
                <path
                  className="deckPinBodyPath"
                  d="M32 3C23.5 3 18 9.3 18 18.2c0 5.3 1.8 9.4 4.6 12.5 1.1 1.2 1.6 2.9 1.2 4.5L13.9 73.5C11 84.9 19.5 96 32 96s21-11.1 18.1-22.5l-9.9-38.3c-.4-1.6.1-3.3 1.2-4.5 2.8-3.1 4.6-7.2 4.6-12.5C46 9.3 40.5 3 32 3Z"
                  fill={`url(#pinBodyGradient-${pin})`}
                />
                <path
                  d="M32 3C23.5 3 18 9.3 18 18.2c0 5.3 1.8 9.4 4.6 12.5 1.1 1.2 1.6 2.9 1.2 4.5L13.9 73.5C11 84.9 19.5 96 32 96s21-11.1 18.1-22.5l-9.9-38.3c-.4-1.6.1-3.3 1.2-4.5 2.8-3.1 4.6-7.2 4.6-12.5C46 9.3 40.5 3 32 3Z"
                  fill={`url(#pinSideShadow-${pin})`}
                />
                <path className="deckPinStripe" d="M20.4 29.8C26 32.2 38 32.2 43.6 29.8L45.1 35.2C38.4 38.1 25.6 38.1 18.9 35.2L20.4 29.8Z" />
                <path className="deckPinStripe" d="M18.8 38.1C26.1 41.2 37.9 41.2 45.2 38.1L46.5 43.1C38.7 46.5 25.3 46.5 17.5 43.1L18.8 38.1Z" />
                <path className="deckPinHighlight" d="M27.2 8.6C22.4 11.1 21 17.8 22.9 24.4c.6 2.2 2.4 2.2 2.7-.1.8-5.8 2.7-9.5 6-12.3 1.9-1.6-.9-4.7-4.4-3.4Z" />
                <ellipse className="deckPinBaseShadow" cx="32" cy="95" rx="15" ry="3.2" />
              </svg>
              <span className="deckPinNumber">{pin}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
