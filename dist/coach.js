// Shows children what to tap next: a pulsing ring, the tapping hand from the
// first-mission guide and a short label. It never clicks anything itself.
const HAND = '<svg viewBox="0 0 72 82" aria-hidden="true"><circle class="coach-touch" cx="18" cy="17" r="13"/><path d="M27 68 9 46Q5 41 9 38Q13 35 18 40L26 48 11 20Q8 14 13 11Q18 8 22 14L35 35 30 24Q27 18 32 16Q37 14 40 20L47 33 43 24Q40 18 45 16Q50 14 53 20L59 34Q61 30 65 33Q70 37 69 47L66 61Q64 70 55 74L45 79Z"/></svg>';
// The fingertip sits 13px right and 12px below the hand's top-left corner.
const TIP = { x: 13, y: 12 };

/** Where the ring, hand and label go for a target rectangle inside a frame. */
export function coachLayout(target, frame, { labelHeight = 46, gap = 14, placement = 'auto' } = {}) {
  const cx = target.left + target.width / 2, cy = target.top + target.height / 2;
  const ring = { left: target.left - 8, top: target.top - 8, width: target.width + 16, height: target.height + 16 };
  const hand = { left: cx - TIP.x + Math.min(18, target.width * .2), top: cy - TIP.y + Math.min(14, target.height * .2) };
  // The label goes above the target when there is room, otherwise below.
  const above = placement === 'above' || (placement === 'auto' && target.top - frame.top > labelHeight + gap + 10);
  const label = { centerX: Math.max(frame.left + 90, Math.min(frame.right - 90, cx)), top: above ? target.top - gap - labelHeight : target.bottom + gap + 46, above };
  return { ring, hand, label };
}

export class Coach {
  constructor(doc = document) {
    this.doc = doc;
    this.layer = doc.createElement('div');
    this.layer.className = 'coach-layer';
    this.layer.setAttribute('aria-hidden', 'true');
    this.layer.innerHTML = `<div class="coach-ring"></div><div class="coach-hand">${HAND}</div><div class="coach-label"></div>`;
    this.target = null; this.key = ''; this.timer = 0; this.showTimer = 0;
    this.place = () => this.position();
  }

  /** Points at `target` (an element) with `text`. The same key keeps the current hint. */
  show(target, text, key = text, { placement = 'auto' } = {}) {
    this.placement = placement;
    if (!target?.isConnected) { this.hide(); return; }
    this.target = target;
    if (this.key === key && this.layer.isConnected) { this.position(); return; }
    this.key = key;
    this.layer.querySelector('.coach-label').textContent = text;
    // Inside a modal dialog the hint must live in the dialog: it sits above the page.
    const host = target.closest('dialog[open]') || this.doc.body;
    if (this.layer.parentElement !== host) host.append(this.layer);
    this.layer.classList.remove('is-shown');
    this.position();
    clearTimeout(this.showTimer);
    this.showTimer = setTimeout(() => this.layer.classList.add('is-shown'), 450);
    if (!this.timer) {
      // Layout can move (scrolling, rotation, images loading); a slow check is enough.
      this.timer = setInterval(this.place, 300);
      addEventListener('resize', this.place); addEventListener('scroll', this.place, true);
    }
  }

  hide() {
    clearTimeout(this.showTimer);
    clearInterval(this.timer); this.timer = 0;
    removeEventListener('resize', this.place); removeEventListener('scroll', this.place, true);
    this.layer.classList.remove('is-shown');
    this.layer.remove();
    this.target = null; this.key = '';
  }

  position() {
    const target = this.target;
    if (!target?.isConnected) { this.hide(); return; }
    const box = target.getBoundingClientRect();
    if (!box.width || !box.height) { this.layer.style.visibility = 'hidden'; return; }
    this.layer.style.visibility = '';
    const dialog = this.layer.parentElement?.matches?.('dialog') ? this.layer.parentElement.getBoundingClientRect() : null;
    const origin = dialog ? { x: dialog.left, y: dialog.top } : { x: 0, y: 0 };
    const frame = dialog || { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    const { ring, hand, label } = coachLayout(box, frame, { placement: this.placement });
    const set = (el, left, top, width, height) => {
      el.style.transform = `translate(${Math.round(left - origin.x)}px,${Math.round(top - origin.y)}px)`;
      if (width) { el.style.width = `${Math.round(width)}px`; el.style.height = `${Math.round(height)}px`; }
    };
    const ringEl = this.layer.querySelector('.coach-ring');
    set(ringEl, ring.left, ring.top, ring.width, ring.height);
    ringEl.style.borderRadius = getComputedStyle(target).borderRadius === '50%' || box.width === box.height ? '50%' : '22px';
    set(this.layer.querySelector('.coach-hand'), hand.left, hand.top);
    const labelEl = this.layer.querySelector('.coach-label');
    labelEl.style.transform = `translate(calc(${Math.round(label.centerX - origin.x)}px - 50%),${Math.round(label.top - origin.y)}px)`;
    labelEl.classList.toggle('is-below', !label.above);
  }
}
