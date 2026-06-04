
export function cropFrameRegions(canvas, frameBoxes) {
  return frameBoxes.map((box, index) => {
    const ctx = canvas.getContext("2d");

    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");

    const isTenthFrame = index === 9;

    tempCanvas.width = isTenthFrame
      ? box.width + 40
      : box.width;

    tempCanvas.height = box.height;

    tempCtx.drawImage(
      canvas,
      box.x,
      box.y,
      box.width,
      box.height,
      0,
      0,
      tempCanvas.width,
      tempCanvas.height
    );

    return {
      frame: index + 1,
      canvas: tempCanvas,
      isTenthFrame
    };
  });
}
