import React from "react";
import { calcBowlingScore, getPreview, renderFrameMark } from "../utils/bowling.jsx";

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

            <p className="cropGuide">
              여러 명 점수판이면 내 점수 줄만 직접 드래그해서 선택한 뒤 분석하세요.
              {cropBox ? " 현재 선택 영역만 분석합니다." : " 영역 미선택 시 전체 사진을 분석합니다."}
            </p>
          </div>
        )}

        {cameraMessage && <div className="placeMessage">{cameraMessage}</div>}

        {ocrPreviewRolls.length > 0 && (
          <div className="ocrPreviewBox">
            <strong>Gemini 분석 투구값</strong>
            <div className="geminiScoreboardPreview">
              {(geminiPreviewFrames.length > 0 ? geminiPreviewFrames : calcBowlingScore(ocrPreviewRolls).frames).map((frame) => (
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

        <button className="manualPlaceButton" onClick={onAnalyze} disabled={isAnalyzingScoreImage}>
          {isAnalyzingScoreImage ? "분석 중..." : ocrPreviewRolls.length > 0 ? "다시 분석하기" : "사진 분석하기"}
        </button>

        {ocrPreviewRolls.length > 0 && (
          <button className="manualPlaceButton primaryModalButton" onClick={onApply}>
            인식 결과 적용
          </button>
        )}

        <p className="cameraGuide">
          Gemini Vision으로 사진을 분석합니다. 결과가 다를 수 있으니 적용 전 투구값을 꼭 확인해주세요.
        </p>
      </div>
    </div>
  );
}
