// Floating-element positioning: place a box of `size` next to `anchor` (DOMRect-like),
// flipping and clamping so it stays inside the viewport.
export function computePosition(anchor, size, opts = {}) {
  const { placement = 'bottom', align = 'start', offset = 6, padding = 8 } = opts;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = 0;
  let left = 0;
  let place = placement;

  const fitsBelow = anchor.bottom + offset + size.height <= vh - padding;
  const fitsAbove = anchor.top - offset - size.height >= padding;
  const fitsRight = anchor.right + offset + size.width <= vw - padding;
  const fitsLeft = anchor.left - offset - size.width >= padding;

  if (place === 'bottom' && !fitsBelow && fitsAbove) place = 'top';
  else if (place === 'top' && !fitsAbove && fitsBelow) place = 'bottom';
  else if (place === 'right' && !fitsRight && fitsLeft) place = 'left';
  else if (place === 'left' && !fitsLeft && fitsRight) place = 'right';

  if (place === 'bottom' || place === 'top') {
    top = place === 'bottom' ? anchor.bottom + offset : anchor.top - offset - size.height;
    if (align === 'start') left = anchor.left;
    else if (align === 'end') left = anchor.right - size.width;
    else left = anchor.left + anchor.width / 2 - size.width / 2;
  } else {
    left = place === 'right' ? anchor.right + offset : anchor.left - offset - size.width;
    if (align === 'start') top = anchor.top;
    else if (align === 'end') top = anchor.bottom - size.height;
    else top = anchor.top + anchor.height / 2 - size.height / 2;
  }

  left = Math.max(padding, Math.min(left, vw - size.width - padding));
  top = Math.max(padding, Math.min(top, vh - size.height - padding));

  const originY = place === 'top' ? 'bottom' : 'top';
  const originX = align === 'end' ? 'right' : align === 'center' ? 'center' : 'left';
  return { top, left, placement: place, origin: `${originY} ${originX}` };
}

export function pointRect(x, y) {
  return { top: y, bottom: y, left: x, right: x, width: 0, height: 0 };
}
