// Program commands read from top to bottom, independently of their widths.
export function verticalInsertionIndex(rects, pointerY) {
  const index = rects.findIndex(rect => pointerY < rect.top + rect.height / 2);
  return index < 0 ? rects.length : index;
}

// Follow a running command inside its own shelf without scrolling the page.
export function scrollTopForBlock(block, shelf, scrollTop, padding = 12) {
  if (block.top < shelf.top + padding || block.height > shelf.height - padding * 2) {
    return Math.max(0, scrollTop + block.top - shelf.top - padding);
  }
  if (block.bottom > shelf.bottom - padding) {
    return scrollTop + block.bottom - shelf.bottom + padding;
  }
  return scrollTop;
}
