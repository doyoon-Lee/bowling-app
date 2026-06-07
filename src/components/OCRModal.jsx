import React from "react";
import { calcBowlingScore, getPreview } from "../utils/bowling.jsx";
import FrameMarkDisplay from "./FrameMarkDisplay";

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
  isAnalyzingScoreImage,
  onClose,
  onAnalyze,
  onApply,
}) {
  const score = calcBowlingScore(ocrPreviewRolls);
  const previewFrames = geminiPreviewFrames.length > 0 ? geminiPreviewFrames : score.frames;

  return (
    <div className="placeModalBackdrop" onClick={onClose}>
      <div className="placeModal" onClick={(e) => e.stopPropagation()}>
        <div className="placeModalHeader">
          <div>
            <strong>점수판 사진 분석</strong>
            <span>내 점수 한 줄만 선택하면 자동으로 분석합니다.</span>
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
              <strong>촬영 팁</strong>
              <ul>
                <li>여러 명 점수판이면 <b>내 이름이 있는 한 줄</b>만 선택해주세요.</li>
                <li>1~10프레임과 최종 점수가 같이 보이게 해주세요.</li>
                <li>반사광을 피하고 최대한 정면에서 촬영해주세요.</li>
              </ul>
            </div>
          </div>
        )}

        {cameraMessage && <div className="placeMessage">{cameraMessage}</div>}

        {ocrPreviewRolls.length > 0 && (
          <div className="ocrPreviewBox simpleOcrResultBox">
            <div className="simpleOcrResultHeader">
              <div>
                <strong>분석 결과</strong>
                <span>자동 검산을 거친 최종 결과입니다.</span>
              </div>
              <b>{score.total}점</b>
            </div>
            <div className="geminiScoreboardPreview">
              {previewFrames.map((frame) => (
                <div className="geminiScoreFrame" key={frame.frame}>
                  <div className="geminiScoreFrameNo">{frame.frame}</div>
                  <div className="geminiScoreFrameMark">
                    <FrameMarkDisplay mark={getPreview(frame)} isSplit={Boolean(frame?.isSplit || frame?.split)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button className="manualPlaceButton" onClick={onAnalyze} disabled={isAnalyzingScoreImage}>
          {isAnalyzingScoreImage ? "자동 검산 중..." : ocrPreviewRolls.length > 0 ? "다시 분석하기" : "사진 분석하기"}
        </button>

        {ocrPreviewRolls.length > 0 && (
          <button className="manualPlaceButton primaryModalButton" onClick={onApply}>
            인식 결과 적용
          </button>
        )}

        <p className="cameraGuide">
          결과가 실제와 다르면 사진을 더 정면에서 다시 찍거나 내 점수 한 줄만 다시 선택해 분석해주세요.
        </p>
      </div>
    </div>
  );
}
