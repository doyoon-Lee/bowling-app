import React, { useMemo, useState } from "react";
import PinDeck from "./PinDeck";
import DonutStat from "./DonutStat";
import { allPins, calcProStats, isSplitLeave, pinName } from "../utils/proStats";

export default function ProMode({ next, onAddRoll, pinFrames, setPinFrames }) {
  const [proStep, setProStep] = useState("firstRemaining");
  const [firstRemainingPins, setFirstRemainingPins] = useState([]);
  const [secondRemainingPins, setSecondRemainingPins] = useState([]);
  const proStats = useMemo(() => calcProStats(pinFrames), [pinFrames]);

  const toggleFirstRemainingPin = (pin) => {
    setFirstRemainingPins((prev) =>
      prev.includes(pin) ? prev.filter((item) => item !== pin) : [...prev, pin].sort((a, b) => a - b)
    );
  };

  const toggleSecondRemainingPin = (pin) => {
    if (!firstRemainingPins.includes(pin)) return;

    setSecondRemainingPins((prev) =>
      prev.includes(pin) ? prev.filter((item) => item !== pin) : [...prev, pin].sort((a, b) => a - b)
    );
  };

  const confirmFirstRemaining = () => {
    if (!next) return;

    const firstRoll = 10 - firstRemainingPins.length;

    // 10프레임 3구는 보너스 투구 1번만 입력하고 종료한다.
    // 여기서 후구 입력 단계로 넘어가면 실제보다 한 번 더 던지는 UI가 된다.
    if (next.frame === 10 && next.rollInFrame === 3) {
      onAddRoll(firstRoll);
      setPinFrames((prev) => [
        ...prev,
        {
          frame: next.frame,
          firstRemaining: [...firstRemainingPins],
          secondRemaining: [],
          converted: null,
          isSplit: false,
          leaveName: `10F 보너스 ${firstRoll}핀`,
        },
      ]);
      setFirstRemainingPins([]);
      setSecondRemainingPins([]);
      setProStep("firstRemaining");
      return;
    }

    if (firstRoll === 10) {
      onAddRoll(10);
      setPinFrames((prev) => [
        ...prev,
        {
          frame: next.frame,
          firstRemaining: [],
          secondRemaining: [],
          converted: null,
          isSplit: false,
          leaveName: "스트라이크",
        },
      ]);
      setFirstRemainingPins([]);
      setSecondRemainingPins([]);
      setProStep("firstRemaining");
      return;
    }

    setProStep("secondRemaining");
  };

  const confirmSecondRemaining = () => {
    if (!next) return;

    const firstRoll = 10 - firstRemainingPins.length;
    const secondRoll = firstRemainingPins.length - secondRemainingPins.length;
    const converted = firstRemainingPins.length > 0 && secondRemainingPins.length === 0;

    onAddRoll(firstRoll);
    onAddRoll(secondRoll);

    setPinFrames((prev) => [
      ...prev,
      {
        frame: next.frame,
        firstRemaining: [...firstRemainingPins],
        secondRemaining: [...secondRemainingPins],
        converted,
        isSplit: isSplitLeave(firstRemainingPins),
        leaveName: pinName(firstRemainingPins),
      },
    ]);

    setFirstRemainingPins([]);
    setSecondRemainingPins([]);
    setProStep("firstRemaining");
  };

  const cancelProInput = () => {
    setFirstRemainingPins([]);
    setSecondRemainingPins([]);
    setProStep("firstRemaining");
  };

  return (
    <section className="proPanel">
      <div className="proStepCard">
        <strong>
          {proStep === "firstRemaining"
            ? next?.frame === 10 && next?.rollInFrame === 3
              ? "10프레임 보너스 투구 후 남은 핀 선택"
              : "초구 후 남은 핀 선택"
            : "후구 후 남은 핀 선택"}
        </strong>
        <p>
          {proStep === "firstRemaining"
            ? next?.frame === 10 && next?.rollInFrame === 3
              ? "보너스 투구는 1번만 입력합니다. 투구 후 남은 핀만 선택하고 바로 입력하세요."
              : "쓰러진 핀이 아니라 남아있는 핀만 선택하세요. 아무것도 선택하지 않으면 스트라이크입니다."
            : "초구 후 남았던 핀 중 후구 후에도 남은 핀만 선택하세요. 아무것도 안 남으면 커버 성공입니다."}
        </p>
      </div>

      {proStep === "firstRemaining" ? (
        <>
          <PinDeck
            selectedPins={firstRemainingPins}
            onToggle={toggleFirstRemainingPin}
            title="초구 후 남은 핀"
            helper="남은 핀만 클릭"
          />
          <button className="proPrimaryButton" type="button" onClick={confirmFirstRemaining} disabled={!next}>
            {next?.frame === 10 && next?.rollInFrame === 3
              ? "보너스 투구 입력"
              : firstRemainingPins.length === 0
                ? "스트라이크 입력"
                : "후구 입력으로 이동"}
          </button>
        </>
      ) : (
        <>
          <PinDeck
            selectedPins={secondRemainingPins}
            onToggle={toggleSecondRemainingPin}
            disabledPins={allPins.filter((pin) => !firstRemainingPins.includes(pin))}
            title="후구 후 남은 핀"
            helper={`${pinName(firstRemainingPins)} 처리 결과`}
          />
          <div className="proActionRow">
            <button className="proSubButton" type="button" onClick={cancelProInput}>
              다시 선택
            </button>
            <button className="proPrimaryButton" type="button" onClick={confirmSecondRemaining}>
              후구 결과 입력
            </button>
          </div>
        </>
      )}

      <section className="proStats">
        <div className="proStatsHeader">
          <strong>Pro 분석</strong>
          <span>현재 게임 기준</span>
        </div>

        <div className="donutGrid">
          <DonutStat
            label="전체 커버율"
            value={proStats.totalRate}
            detail={`${proStats.totalConverted}/${proStats.totalAttempts}`}
          />
          <DonutStat
            label="10핀 처리율"
            value={proStats.tenPinRate}
            detail={`${proStats.tenPinConverted}/${proStats.tenPinAttempts}`}
          />
          <DonutStat
            label="7핀 처리율"
            value={proStats.sevenPinRate}
            detail={`${proStats.sevenPinConverted}/${proStats.sevenPinAttempts}`}
          />
          <DonutStat
            label="스플릿 처리율"
            value={proStats.splitRate}
            detail={`${proStats.splitConverted}/${proStats.splitAttempts}`}
          />
        </div>
      </section>
    </section>
  );
}
