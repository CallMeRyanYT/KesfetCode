// Coordinates are shared with puzzle-workspace.css. A stack is a connected
// sequence; only `connected` belongs to the immovable yellow Start block.
export const PUZZLE_GEOMETRY = Object.freeze({ x: 30, y: 24, width: 164, height: 58, startHeight: 58 });
export const CONNECTED_STACK = 'start';

export function createPuzzleWorkspace(connected = []) {
  return { connected: structuredClone(connected), detached: [], nextId: 1 };
}
export const puzzleBlockCount = model => [model.connected, ...model.detached.map(stack => stack.blocks)]
  .reduce((total, blocks) => total + blocks.reduce((sum, block) => sum + (block.type === 'repeat' ? 1 + block.body.length : 1), 0), 0);
export const puzzleStackBlocks = (model, id) => id === CONNECTED_STACK ? model.connected : model.detached.find(stack => stack.id === id)?.blocks;
export function puzzleStacks(model) {
  return [{ id: CONNECTED_STACK, x: PUZZLE_GEOMETRY.x, y: PUZZLE_GEOMETRY.y + PUZZLE_GEOMETRY.startHeight, blocks: model.connected }, ...model.detached];
}

const TAB_HEIGHT = 8, FREE_GAP = 12;
const stackRect = stack => ({ x: stack.x, y: stack.y, width: PUZZLE_GEOMETRY.width, height: stack.blocks.length * PUZZLE_GEOMETRY.height + TAB_HEIGHT });
const intersects = (a, b, gap = 0) => a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
function remainingStacks(model, source) {
  return puzzleStacks(model).map(stack => source.kind !== 'palette' && source.stackId === stack.id
    ? { ...stack, blocks: stack.blocks.slice(0, source.index) } : stack)
    .filter(stack => stack.id === CONNECTED_STACK || stack.blocks.length);
}
function protectedRects(stacks) {
  const connected = stacks.find(stack => stack.id === CONNECTED_STACK);
  return [{ x: PUZZLE_GEOMETRY.x, y: PUZZLE_GEOMETRY.y, width: PUZZLE_GEOMETRY.width,
    height: PUZZLE_GEOMETRY.startHeight + (connected?.blocks.length || 0) * PUZZLE_GEOMETRY.height + TAB_HEIGHT },
  ...stacks.filter(stack => stack.id !== CONNECTED_STACK).map(stackRect)];
}

// Find the nearest clear parking space. Candidate edges grow only when a
// collision is encountered, instead of scanning every pixel of the canvas.
function clearPosition(point, height, obstacles) {
  const start = { x: Math.max(0, point.x), y: Math.max(0, point.y) };
  const pending = [start], seen = new Set();
  const distance = point => (point.x - start.x) ** 2 + (point.y - start.y) ** 2;
  while (pending.length) {
    pending.sort((a, b) => distance(a) - distance(b) || a.y - b.y || a.x - b.x);
    const position = pending.shift(), key = `${position.x},${position.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const collision = obstacles.find(rect => intersects({ ...position, width: PUZZLE_GEOMETRY.width, height }, rect, FREE_GAP));
    if (!collision) return position;
    for (const candidate of [
      { x: collision.x + collision.width + FREE_GAP, y: position.y },
      { x: Math.max(0, collision.x - PUZZLE_GEOMETRY.width - FREE_GAP), y: position.y },
      { x: position.x, y: collision.y + collision.height + FREE_GAP },
      { x: position.x, y: Math.max(0, collision.y - height - FREE_GAP) },
    ]) if (!seen.has(`${candidate.x},${candidate.y}`)) pending.push(candidate);
  }
  return start;
}

function arrangeDetached(model, anchoredStackId = null) {
  const obstacles = protectedRects([{ id: CONNECTED_STACK, blocks: model.connected }]);
  // A chosen connector is an anchor, including one on a loose stack. Expanding
  // it must move other loose stacks out of the way rather than move the drop.
  const anchored = model.detached.find(stack => stack.id === anchoredStackId);
  const ordered = anchored ? [anchored, ...model.detached.filter(stack => stack !== anchored)] : model.detached;
  ordered.forEach(stack => {
    const position = clearPosition(stack, stackRect(stack).height, obstacles);
    stack.x = position.x; stack.y = position.y;
    obstacles.push(stackRect(stack));
  });
  return model;
}

export function movePuzzleStack(model, source, destination, { maxBlocks = 80, allowedTypes = null } = {}) {
  if (!source || !destination) return model;
  const palette = source.kind === 'palette';
  if (palette && (typeof source.type !== 'string' || (allowedTypes && !allowedTypes.includes(source.type)) || puzzleBlockCount(model) >= maxBlocks)) return model;
  const origin = palette ? null : puzzleStackBlocks(model, source.stackId);
  if (!palette && (!origin || !Number.isInteger(source.index) || source.index < 0 || source.index >= origin.length)) return model;
  if (!['connect', 'free', 'trash'].includes(destination.kind)) return model;
  if (destination.kind === 'trash' && palette) return model;
  if (destination.kind === 'free' && (!Number.isFinite(destination.x) || !Number.isFinite(destination.y))) return model;
  const target = destination.kind === 'connect' ? puzzleStackBlocks(model, destination.stackId) : null;
  if (destination.kind === 'connect' && (!target || !Number.isInteger(destination.index) || destination.index < 0 || destination.index > target.length)) return model;
  // A connection inside the suffix being carried would join a stack to itself.
  if (!palette && destination.kind === 'connect' && source.stackId === destination.stackId && destination.index >= source.index) return model;
  const next = structuredClone(model);
  const blocks = palette ? [{ type: source.type }] : puzzleStackBlocks(next, source.stackId).splice(source.index);
  if (destination.kind === 'connect') puzzleStackBlocks(next, destination.stackId).splice(destination.index, 0, ...blocks);
  if (destination.kind === 'free') {
    const id = !palette && source.stackId !== CONNECTED_STACK && source.index === 0 ? source.stackId : `loose-${next.nextId++}`;
    next.detached.push({ id, x: Math.max(0, destination.x), y: Math.max(0, destination.y), blocks });
  }
  // Empty source stacks disappear, including the old position of a moved stack.
  next.detached = next.detached.filter(stack => stack.blocks.length);
  return arrangeDetached(next, destination.kind === 'connect' ? destination.stackId : null);
}

export function removePuzzleBlock(model, stackId, index) {
  const blocks = puzzleStackBlocks(model, stackId);
  if (!blocks || !Number.isInteger(index) || index < 0 || index >= blocks.length) return model;
  const next = structuredClone(model);
  puzzleStackBlocks(next, stackId).splice(index, 1);
  next.detached = next.detached.filter(stack => stack.blocks.length);
  return arrangeDetached(next);
}

// Only a release close to a top connector attaches a stack. Passing over a
// block's body has no attraction; a distant release parks it in clear space.
export function puzzleDropDestination(model, source, point, tolerance = { x: 28, y: 22 }) {
  const stacks = remainingStacks(model, source);
  const carriedCount = source.kind === 'palette' ? 1 : (puzzleStackBlocks(model, source.stackId)?.length || 0) - source.index;
  let nearest = null, distance = Infinity;
  for (const stack of stacks) {
    for (let index = 0; index <= stack.blocks.length; index++) {
      const x = stack.x, y = stack.y + index * PUZZLE_GEOMETRY.height;
      const dx = Math.abs(point.x - x), dy = Math.abs(point.y - y);
      if (dx <= tolerance.x && dy <= tolerance.y && dx + dy < distance) {
        nearest = { kind: 'connect', stackId: stack.id, index, x, y }; distance = dx + dy;
      }
    }
  }
  const height = Math.max(1, carriedCount) * PUZZLE_GEOMETRY.height + TAB_HEIGHT;
  return nearest || { kind: 'free', ...clearPosition(point, height, protectedRects(stacks)) };
}

export function puzzleSourceFromElement(element) {
  const palette = element?.closest('[data-add]');
  if (palette) return { kind: 'palette', type: palette.dataset.add };
  const card = element?.closest('[data-puzzle-index]');
  return card ? { kind: 'stack', stackId: card.dataset.puzzleStack, index: Number(card.dataset.puzzleIndex) } : null;
}

// This controller moves a decorative ghost during the gesture. Model changes
// happen only after a valid drop, so cancelling never mutates the user's code.
export function mountPuzzleInteractions(root, { getWorkspace, onDrop, renderGhost, enabled = () => true }) {
  const canvas = root.querySelector('.puzzle-canvas'), plane = root.querySelector('.puzzle-plane');
  if (!canvas || !plane) return () => {};
  let pending = null, active = null, ghost = null, cue = null, frame = 0, nativeSource = null, nativeOffset = null;
  let suppressUntil = 0, suppressNextClick = false;
  const add = (target, type, handler, options) => { target.addEventListener(type, handler, options); return () => target.removeEventListener(type, handler, options); };
  const cleanups = [];
  const signal = (name, detail) => root.dispatchEvent(new CustomEvent(name, { detail }));
  const coordinates = () => {
    const canvasRect = canvas.getBoundingClientRect(), planeRect = plane.getBoundingClientRect();
    const scaleX = plane.offsetWidth > 0 && planeRect.width > 0 ? planeRect.width / plane.offsetWidth : 1;
    const scaleY = plane.offsetHeight > 0 && planeRect.height > 0 ? planeRect.height / plane.offsetHeight : scaleX;
    return { scaleX, scaleY,
      left: Number.isFinite(planeRect.left) ? planeRect.left : canvasRect.left - canvas.scrollLeft * scaleX,
      top: Number.isFinite(planeRect.top) ? planeRect.top : canvasRect.top - canvas.scrollTop * scaleY };
  };
  const grabOffset = (event, element) => {
    const rect = element.getBoundingClientRect(), { scaleX, scaleY } = coordinates();
    return { x: Math.max(0, Math.min(PUZZLE_GEOMETRY.width, (event.clientX - rect.left) / scaleX)),
      y: Math.max(0, Math.min(PUZZLE_GEOMETRY.height, (event.clientY - rect.top) / scaleY)) };
  };
  const clearVisual = () => {
    cancelAnimationFrame(frame); frame = 0;
    ghost?.remove(); cue?.remove(); ghost = cue = null;
    root.querySelectorAll('.puzzle-being-dragged,.puzzle-trash-active').forEach(node => node.classList.remove('puzzle-being-dragged', 'puzzle-trash-active'));
    root.classList.remove('puzzle-dragging');
  };
  const end = () => {
    const hadDrag = !!active || !!nativeSource;
    clearVisual(); pending = active = nativeSource = nativeOffset = null;
    if (hadDrag) { suppressNextClick = true; signal('puzzle-dragend'); }
  };
  const destinationAt = (clientX, clientY, source, offset) => {
    const trash = root.querySelector('[data-puzzle-trash]'), trashRect = trash?.getBoundingClientRect();
    if (source.kind === 'stack' && trashRect && clientX >= trashRect.left && clientX <= trashRect.right && clientY >= trashRect.top && clientY <= trashRect.bottom) return { kind: 'trash' };
    const rect = canvas.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    const { left, top, scaleX, scaleY } = coordinates();
    return puzzleDropDestination(getWorkspace(), source, { x: (clientX - left) / scaleX - offset.x, y: (clientY - top) / scaleY - offset.y });
  };
  const preview = (clientX, clientY, source, offset) => {
    const destination = destinationAt(clientX, clientY, source, offset);
    if (ghost) {
      const { scaleX, scaleY } = coordinates();
      ghost.style.left = `${clientX - offset.x * scaleX}px`;
      ghost.style.top = `${clientY - offset.y * scaleY}px`;
      ghost.style.scale = `${scaleX} ${scaleY}`; ghost.style.transformOrigin = 'top left';
    }
    if (cue) { cue.hidden = destination?.kind !== 'connect'; if (!cue.hidden) { cue.style.left = `${destination.x}px`; cue.style.top = `${destination.y}px`; } }
    root.querySelector('[data-puzzle-trash]')?.classList.toggle('puzzle-trash-active', destination?.kind === 'trash');
    return destination;
  };
  const makeVisual = source => {
    root.classList.add('puzzle-dragging');
    ghost = document.createElement('div'); ghost.className = 'puzzle-ghost'; ghost.setAttribute('aria-hidden', 'true');
    ghost.innerHTML = renderGhost(source); document.body.append(ghost);
    cue = document.createElement('div'); cue.className = 'puzzle-snap-target'; cue.setAttribute('aria-hidden', 'true'); cue.hidden = true; plane.append(cue);
    if (source.kind === 'stack') root.querySelectorAll(`[data-puzzle-stack="${source.stackId}"][data-puzzle-index]`).forEach(card => { if (Number(card.dataset.puzzleIndex) >= source.index) card.classList.add('puzzle-being-dragged'); });
    signal('puzzle-dragstart');
  };
  const autoscroll = () => {
    frame = 0;
    if (!active) return;
    const rect = canvas.getBoundingClientRect(), { clientX, clientY } = active;
    if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
      const edge = 36;
      const dy = clientY < rect.top + edge ? -10 : clientY > rect.bottom - edge ? 10 : 0;
      const dx = clientX < rect.left + edge ? -8 : clientX > rect.right - edge ? 8 : 0;
      if (dy || dx) { canvas.scrollTop += dy; canvas.scrollLeft += dx; preview(clientX, clientY, active.source, active.offset); }
    }
    frame = requestAnimationFrame(autoscroll);
  };
  cleanups.push(add(root, 'pointerdown', event => {
    if (event.isPrimary === false || pending || active) return;
    suppressNextClick = false; suppressUntil = 0;
    if (!enabled() || event.button !== 0 || event.target.closest('.direction-count,.block-delete,.puzzle-connect,.start-block')) return;
    const source = puzzleSourceFromElement(event.target);
    if (!source) return;
    const element = event.target.closest('[data-add],[data-puzzle-index]');
    pending = { source, pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, offset: grabOffset(event, element) };
    // Native drag events below remain a fallback. Pointer input avoids the
    // browser's translucent drag image and supports the same puzzle on touch.
    event.preventDefault();
  }));
  cleanups.push(add(document, 'pointermove', event => {
    if (!pending || event.pointerId !== pending.pointerId) return;
    if (!active && Math.hypot(event.clientX - pending.clientX, event.clientY - pending.clientY) < 5) return;
    if (!active) { active = { ...pending }; makeVisual(active.source); frame = requestAnimationFrame(autoscroll); }
    active.clientX = event.clientX; active.clientY = event.clientY;
    preview(event.clientX, event.clientY, active.source, active.offset); event.preventDefault();
  }, { passive: false }));
  cleanups.push(add(document, 'pointerup', event => {
    if (!pending || event.pointerId !== pending.pointerId) return;
    const drag = active;
    const source = pending.source;
    if (drag) {
      const destination = destinationAt(event.clientX, event.clientY, drag.source, drag.offset);
      if (destination) signal('puzzle-drop', { source, destination });
      suppressUntil = performance.now() + 350; end();
      if (destination && enabled()) onDrop(source, destination);
    } else { pending = null; }
  }));
  cleanups.push(add(document, 'pointercancel', event => {
    if (pending && event.pointerId === pending.pointerId) end();
  }));
  cleanups.push(add(document, 'keydown', event => { if (event.key === 'Escape') end(); }));
  cleanups.push(add(root, 'click', event => {
    if (suppressNextClick || performance.now() < suppressUntil) {
      suppressNextClick = false; event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true));
  cleanups.push(add(root, 'dragstart', event => {
    if (!enabled() || event.target.closest('.direction-count,.block-delete,.puzzle-connect,.start-block')) { event.preventDefault(); return; }
    const source = puzzleSourceFromElement(event.target);
    if (!source) return;
    nativeOffset = pending?.offset || grabOffset(event, event.target.closest('[data-add],[data-puzzle-index]'));
    pending = null; nativeSource = source;
    event.dataTransfer?.setData('text/plain', 'kesfet-puzzle-block');
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      if (typeof event.dataTransfer.setDragImage === 'function') {
        const transparent = document.createElement('canvas'); transparent.width = transparent.height = 1;
        event.dataTransfer.setDragImage(transparent, 0, 0);
      }
    }
    makeVisual(source);
  }));
  cleanups.push(add(root, 'dragover', event => {
    if (!nativeSource) return;
    const destination = preview(event.clientX, event.clientY, nativeSource, nativeOffset);
    if (destination) { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'; }
  }));
  cleanups.push(add(root, 'drop', event => {
    if (!nativeSource) return;
    const source = nativeSource, destination = destinationAt(event.clientX, event.clientY, source, nativeOffset);
    if (destination) signal('puzzle-drop', { source, destination });
    event.preventDefault(); end(); if (destination && enabled()) onDrop(source, destination);
  }));
  cleanups.push(add(root, 'dragend', end));
  cleanups.push(add(window, 'blur', end));
  return () => { end(); cleanups.forEach(dispose => dispose()); };
}
