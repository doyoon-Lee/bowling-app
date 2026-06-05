
export function splitTenthFrameSlots(imageWidth) {
  const slotWidth = imageWidth / 3;

  return [
    {
      startX: 0,
      endX: slotWidth
    },
    {
      startX: slotWidth,
      endX: slotWidth * 2
    },
    {
      startX: slotWidth * 2,
      endX: imageWidth
    }
  ];
}
