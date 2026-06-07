import React from "react";
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
  isAnalyzingScoreImage,
  onClose,
  onAnalyze,
  onApply,
  onPreviewRollsChange,
}) {
  const previewFrames = geminiPreviewFrames.length > 0 ? geminiPreviewFrames : calcBowlingScore(ocrPreviewRolls).frames;

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
                {cropBox ? "선택 영역을 OCR용으로 보정한 뒤 1~10프레임으로 나눠 분석합니다." : "여러 명 점수판이면 내 점수 줄만 드래그해서 선택한 뒤 분석하는 것을 권장합니다."}
              </p>
            </div>

            {ocrFramePreviews.length > 0 && (
              <div className="ocrFramePreviewBox">
                <div className="ocrFramePreviewHeader">
                  <strong>프레임 단위 분석 영역</strong>
                  <span>대비/선명도 보정이 적용된 프레임 이미지로 인식합니다.</span>
                </div>
                <div className="ocrFramePreviewGrid">
                  {ocrFramePreviews.map((item) => (
                    <div className="ocrFramePreviewCell" key={`ocr-frame-preview-${item.frame}`}>
                      <span>{item.frame}F</span>
                      <img src={item.url} alt={`${item.frame}프레임 분석 영역`} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {cameraMessage && <div className="placeMessage">{cameraMessage}</div>}

        {ocrPreviewRolls.length > 0 && (
          <div className="ocrPreviewBox">
            <strong>Gemini 분석 투구값</strong>
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
          <div className="ocrCorrectionBox">
            <div className="ocrCorrectionHeader">
              <strong>인식 결과 빠른 수정</strong>
              <span>틀린 프레임만 직접 고친 뒤 적용하세요.</span>
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
          Gemini Vision으로 사진을 분석합니다. 이번 버전은 선택 영역을 OCR용으로 보정한 뒤 프레임 단위로 전달하고, 결과가 다를 수 있으니 적용 전 투구값을 꼭 확인해주세요.
        </p>
      </div>
    </div>
  );
}
