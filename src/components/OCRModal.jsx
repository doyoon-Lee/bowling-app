import React from "react";
import { calcBowlingScore, getPreview, renderFrameMark } from "../utils/bowling";

export default function OCRModal({
  scoreImage,
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
          <img className="scoreImagePreview" src={URL.createObjectURL(scoreImage)} alt="점수판 미리보기" />
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
