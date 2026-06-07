import React, { useEffect, useState } from "react";
import { BET_RULE_MODES, createBetRule, createDefaultCustomRankRules, normalizeMoney } from "../utils/betting";

const PRESET_BET_AMOUNTS = [1000, 2000, 5000, 10000];

export default function RoomLobby({ appMode, roomCode, onCreateRoom, onJoinRoom, onLeaveRoom }) {
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [isBetModalOpen, setIsBetModalOpen] = useState(false);
  const [betMode, setBetMode] = useState(BET_RULE_MODES.NONE);
  const [baseAmount, setBaseAmount] = useState(2000);
  const [customRules, setCustomRules] = useState(createDefaultCustomRankRules(2000, 6));

  const normalizedBaseAmount = normalizeMoney(baseAmount);

  useEffect(() => {
    if (betMode !== BET_RULE_MODES.CUSTOM_RANK) return;
    setCustomRules(createDefaultCustomRankRules(normalizedBaseAmount, 6));
  }, [normalizedBaseAmount, betMode]);

  const createRoomWithBet = () => {
    const betRule = createBetRule({
      mode: betMode,
      baseAmount: normalizedBaseAmount,
      customRules,
    });

    setIsBetModalOpen(false);
    onCreateRoom({
      betAmount: betRule.baseAmount,
      betRule,
    });
  };

  const updateCustomRulePay = (rank, value) => {
    setCustomRules((prev) =>
      prev.map((rule) =>
        rule.rank === rank
          ? { ...rule, pay: value }
          : rule
      )
    );
  };

  const normalizeCustomRulePay = (rank) => {
    setCustomRules((prev) =>
      prev.map((rule) =>
        rule.rank === rank
          ? { ...rule, pay: normalizeMoney(rule.pay) }
          : rule
      )
    );
  };

  if (appMode === "room") {
    return (
      <section className="roomModePanel liveRoomHeader">
        <div>
          <strong>실시간 방</strong>
          <span>{roomCode}</span>
        </div>
        <button type="button" onClick={onLeaveRoom}>방 나가기</button>
      </section>
    );
  }

  return (
    <section className="roomModePanel">
      <div className="roomModeTitle">
        <strong>실시간 방 모드</strong>
        <span>방을 만들거나 방 코드로 참여해 서로 점수판을 볼 수 있습니다.</span>
      </div>

      <div className="roomCreateBox singleAction">
        <button type="button" onClick={() => setIsBetModalOpen(true)}>방 만들기</button>
      </div>

      <div className="roomJoinBox">
        <input
          value={joinCodeInput}
          onChange={(e) => setJoinCodeInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="예: 483920"
          inputMode="numeric"
          maxLength={6}
        />
        <button type="button" onClick={() => onJoinRoom(joinCodeInput)}>방 참여</button>
      </div>

      {isBetModalOpen && (
        <div className="betModalOverlay" role="dialog" aria-modal="true">
          <div className="betModal">
            <div className="betModalHeader">
              <div>
                <strong>내기 방식 설정</strong>
                <p>방을 만들기 전에 내기 방식을 선택하세요. 금액은 천원 단위로 보정됩니다.</p>
              </div>
              <button type="button" className="betModalClose" onClick={() => setIsBetModalOpen(false)}>
                ×
              </button>
            </div>

            <div className="betModeGrid">
              <button
                type="button"
                className={betMode === BET_RULE_MODES.NONE ? "active" : ""}
                onClick={() => setBetMode(BET_RULE_MODES.NONE)}
              >
                내기 없이
              </button>
              <button
                type="button"
                className={betMode === BET_RULE_MODES.EQUAL ? "active" : ""}
                onClick={() => setBetMode(BET_RULE_MODES.EQUAL)}
              >
                균등 정산
              </button>
              <button
                type="button"
                className={betMode === BET_RULE_MODES.CUSTOM_RANK ? "active" : ""}
                onClick={() => setBetMode(BET_RULE_MODES.CUSTOM_RANK)}
              >
                차등 정산
              </button>
            </div>

            {betMode === BET_RULE_MODES.EQUAL && (
              <>
                <div className="betPresetGrid">
                  {PRESET_BET_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      className={normalizedBaseAmount === amount ? "active" : ""}
                      onClick={() => setBaseAmount(amount)}
                    >
                      {amount.toLocaleString()}원
                    </button>
                  ))}
                </div>

                <label className="betCustomInput">
                  <span>기준 금액</span>
                  <input
                    value={baseAmount}
                    onChange={(event) => {
                      const nextValue = event.target.value.replace(/[^0-9]/g, "");
                      setBaseAmount(nextValue ? Number(nextValue) : 0);
                    }}
                    onBlur={() => setBaseAmount(normalizedBaseAmount)}
                    placeholder="예: 2000"
                    inputMode="numeric"
                  />
                </label>
              </>
            )}

            {betMode === BET_RULE_MODES.EQUAL && (
              <div className="betRulePreview">
                <strong>균등 정산</strong>
                <p>
                  1등이 전체 금액을 가져가고, 2등 이하가 각각 {normalizedBaseAmount.toLocaleString()}원씩 냅니다.
                </p>
              </div>
            )}

            {betMode === BET_RULE_MODES.CUSTOM_RANK && (
              <div className="customRankRuleBox">
                <div>
                  <strong>순위별 지급 금액</strong>
                  <p>1등은 돈을 내지 않고, 2등 이하가 입력한 금액을 1등에게 지급합니다.</p>
                </div>

                <div className="customRankRuleList">
                  {customRules
                    .filter((rule) => rule.rank > 1)
                    .map((rule) => (
                      <label key={rule.rank} className="customRankRuleItem">
                        <span>{rule.rank}등</span>
                        <input
                          value={rule.pay}
                          onChange={(event) => {
                            updateCustomRulePay(rule.rank, event.target.value.replace(/[^0-9]/g, ""));
                          }}
                          onBlur={() => normalizeCustomRulePay(rule.rank)}
                          inputMode="numeric"
                        />
                        <em>원</em>
                      </label>
                    ))}
                </div>

                <small>
                  차등 정산은 위 금액을 직접 수정해서 사용합니다. 예: 2등 1,000원 / 3등 2,000원 / 4등 3,000원처럼 설정할 수 있습니다.
                </small>
              </div>
            )}

            {betMode === BET_RULE_MODES.NONE && (
              <div className="betRulePreview">
                <strong>내기 없이</strong>
                <p>실시간 점수판만 사용하고 정산표는 표시하지 않습니다.</p>
              </div>
            )}

            <div className="betModalActions">
              <button type="button" className="secondary" onClick={() => setIsBetModalOpen(false)}>
                취소
              </button>
              <button type="button" onClick={createRoomWithBet}>
                {betMode === BET_RULE_MODES.NONE ? "내기 없이 방 만들기" : "내기 방 만들기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
