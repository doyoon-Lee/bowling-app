
export function validateFrames(frames) {
  return frames.map((frame, index) => {
    const isTenth = index === 9;

    if (!isTenth && frame.length > 2) {
      return frame.slice(0, 2);
    }

    if (isTenth && frame.length > 3) {
      return frame.slice(0, 3);
    }

    return frame;
  });
}
