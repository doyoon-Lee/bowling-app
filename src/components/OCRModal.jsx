import React, { useState } from "react";
import { calcBowlingScore, getPreview, parseGeminiFrameRolls, renderFrameMark } from "../utils/bowling.jsx";

export default function OCRModal({
  scoreImage,
  scoreImagePreviewUrl,
  cropMode,
  cropBox,
  currentCropBox,
  setCropMode,
  resetCropSelection,
  startCropSelection,
  moveCropSelection,
  endCropSelection,
  cameraMessage,
  ocrPreviewRolls,
  geminiPreviewFrames,
  ocrFramePreviews = [],
  ocrReviewFrames = [],
  isAnalyzingScoreImage,
  onClose,
  onAnalyze,
  onApply,
  onPreviewRollsChange,
}) {
  const previewFrames = geminiPreviewFrames.length > 0 ? geminiPreviewFrames : calcBowlingScore(ocrPreviewRolls).frames;
  const reviewTargets = ocrReviewFrames.filter((frame) => frame.needsReview);
  const criticalReviewTargets = reviewTargets.filter((frame) => {
    const reasons = Array.isArray(frame.reasons) ? frame.reasons.join(" ") : "";
    return frame.confidence < 0.45 || reasons.includes("최종점수") || reasons.includes("10프레임");
  });
  const [showManualCorrection, setShowManualCorrection] = useState(false);

  const updatePreviewFrameMark = (frameIndex, nextMark) => {
    const frameMarks = calcBowlingScore(ocrPreviewRolls).frames.map((frame) => frame.mark || "");
    frameMarks[frameIndex] = nextMark;

    const nextRolls = frameMarks.flatMap((mark, index) =>
      parseGeminiFrameRolls({ frame: index + 1, mark })
    );

    onPreviewRollsChange(nextRolls);
  };

  return (
    <div className="placeModalBackdrop" onClick={onClose}>
      <div className="placeModal" onClick={(e) => e.stopPropagation()}>
        <div className="placeModalHeader">
          <div>
            <strong>점수판 사진 분석</strong>
            <span>볼링장 모니터를 정면으로 촬영해주세요.</span>
          </div>
          <button onClick={onClose}>닫기</button>
        </div>

        {scoreImage && (
          <div className="cropPanel">
            <div className="cropToolbar">
              <button type="button" onClick={() => setCropMode((prev) => !prev)}>
                {cropMode ? "영역 선택 끄기" : "내 점수 영역 선택"}
              </button>
              <button type="button" onClick={resetCropSelection}>전체</button>
            </div>

            <div
              className={cropMode ? "cropImageWrap selecting" : "cropImageWrap"}
              onMouseDown={startCropSelection}
              onMouseMove={moveCropSelection}
              onMouseUp={endCropSelection}
              onMouseLeave={endCropSelection}
              onTouchStart={startCropSelection}
              onTouchMove={moveCropSelection}
              onTouchEnd={endCropSelection}
            >
              <img className="scoreImagePreview" src={scoreImagePreviewUrl} alt="점수판 미리보기" draggable={false} />
              {currentCropBox && (
                <div
                  className="cropSelectionBox"
                  style={{
                    left: `${currentCropBox.x * 100}%`,
                    top: `${currentCropBox.y * 100}%`,
                    width: `${currentCropBox.width * 100}%`,
                    height: `${currentCropBox.height * 100}%`,
                  }}
                />
              )}
            </div>

            <div className="ocrShootGuide">
              <strong>정확도를 높이는 촬영 방법</strong>
              <ul>
                <li>점수판 전체보다 <b>내 이름이 있는 한 줄</b>만 크게 잡아주세요.</li>
                <li>프레임 1~10과 최종 점수가 같이 보이게 선택해주세요.</li>
                <li>모니터를 비스듬히 찍지 말고 최대한 정면에서 촬영해주세요.</li>
                <li>반사광이 있으면 화면 밝기를 낮추거나 살짝 옆으로 이동해주세요.</li>
              </ul>
              <p>
                {cropBox ? "선택 영역의 세로 경계선을 먼저 감지한 뒤 1~10프레임으로 나눠 분석합니다." : "여러 명 점수판이면 내 점수 줄만 드래그해서 선택한 뒤 분석하는 것을 권장합니다."}
              </p>
            </div>

          </div>
        )}

        {cameraMessage && <div className="placeMessage">{cameraMessage}</div>}


        {ocrPreviewRolls.length > 0 && criticalReviewTargets.length > 0 && (
          <div className="ocrReviewBox needsReview compactReviewBox">
            <div className="ocrReviewHeader">
              <div>
                <strong>확인이 필요한 부분이 있어요</strong>
                <span>대부분은 자동 검산했습니다. 아래 프레임만 실제 화면과 비교해주세요.</span>
              </div>
              <b>{criticalReviewTargets.length}개 확인</b>
            </div>

            <div className="ocrReviewList">
              {criticalReviewTargets.map((item) => {
                const currentFrame = previewFrames[item.frame - 1];
                const currentMark = renderFrameMark(getPreview(currentFrame || {})).replace(/\u00A0/g, "").trim();
                const quickMarks = item.frame === 10
                  ? ["X|X|X", "X|9|/", "X|-|/", "9|/|X", "9|-", "-|/"]
                  : ["X", "9|/", "8|/", "7|/", "9|-", "8|1", "-|-", "-|/"];

                return (
                  <div className="ocrReviewCard compactReviewCard" key={`ocr-critical-review-${item.frame}`}>
                    <div className="ocrReviewCardTop">
                      <div>
                        <strong>{item.frame}프레임</strong>
                        <span>{item.reasons?.[0] || "인식 결과 확인 필요"}</span>
                      </div>
                      <em>{currentMark || "미인식"}</em>
                    </div>

                    {item.imageUrl && (
                      <img className="ocrReviewFrameImage" src={item.imageUrl} alt={`${item.frame}프레임 원본`} />
                    )}

                    <div className="ocrQuickMarks">
                      {quickMarks.map((mark) => (
                        <button type="button" key={`${item.frame}-${mark}`} onClick={() => updatePreviewFrameMark(item.frame - 1, mark)}>
                          {mark.replace(/\|/g, " | ")}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {ocrPreviewRolls.length > 0 && (
          <div className="ocrPreviewBox simpleOcrResultBox">
            <div className="simpleOcrResultHeader">
              <div>
                <strong>분석 결과</strong>
                <span>내부 검산을 마친 최종 결과만 표시합니다.</span>
              </div>
              <b>{calcBowlingScore(ocrPreviewRolls).total}점</b>
            </div>
            <div className="geminiScoreboardPreview">
              {previewFrames.map((frame) => (
                <div className="geminiScoreFrame" key={frame.frame}>
                  <div className="geminiScoreFrameNo">{frame.frame}</div>
                  <div className="geminiScoreFrameMark">
                    {renderFrameMark(getPreview(frame))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {ocrPreviewRolls.length > 0 && (
          <div className="ocrCorrectionBox simpleCorrectionBox">
            <button type="button" className="ocrCorrectionToggle" onClick={() => setShowManualCorrection((prev) => !prev)}>
              {showManualCorrection ? "수정 닫기" : "결과가 다르면 직접 수정"}
            </button>

            {showManualCorrection && (
              <>
                <div className="ocrCorrectionHeader">
                  <strong>인식 결과 수정</strong>
                  <span>틀린 프레임만 고친 뒤 적용하세요.</span>
                </div>
                <div className="ocrCorrectionGrid">
                  {calcBowlingScore(ocrPreviewRolls).frames.map((frame, index) => (
                    <label className="ocrCorrectionCell" key={`ocr-correct-${frame.frame}`}>
                      <span>{frame.frame}F</span>
                      <input
                        value={renderFrameMark(frame.mark).replace(/\u00A0/g, "").trim()}
                        placeholder={frame.frame === 10 ? "X|X|X" : "X 또는 9|/"}
                        onChange={(event) => updatePreviewFrameMark(index, event.target.value)}
                      />
                    </label>
                  ))}
                </div>
                <p>예: 스트라이크는 X, 스페어는 9|/, 거터는 -, 10프레임은 X|9|/ 처럼 입력</p>
              </>
            )}
          </div>
        )}

        <button className="manualPlaceButton" onClick={onAnalyze} disabled={isAnalyzingScoreImage}>
          {isAnalyzingScoreImage ? "분석 중..." : ocrPreviewRolls.length > 0 ? "다시 분석하기" : "사진 분석하기"}
        </button>

        {ocrPreviewRolls.length > 0 && (
          <button className="manualPlaceButton primaryModalButton" onClick={onApply}>
            인식 결과 적용
          </button>
        )}

        <p className="cameraGuide">
          Gemini Vision과 Tesseract 숫자 OCR, 프레임 분리, 누적점수 검산은 내부적으로 처리됩니다. 화면에는 최종 결과만 간단히 표시합니다.
        </p>
      </div>
    </div>
  );
}
