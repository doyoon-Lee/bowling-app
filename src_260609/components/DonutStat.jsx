import React from "react";

export default function DonutStat({ label, value, detail }) {
  return (
    <div className="donutCard">
      <div className="donut" style={{ "--rate": `${value}%` }}>
        <span>{value}%</span>
      </div>
      <strong>{label}</strong>
      <p>{detail}</p>
    </div>
  );
}
