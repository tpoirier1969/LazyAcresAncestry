const CACHE = new Map();
const IMAGES = new Map();

export function plaqueTexture(person, size = 480) {
  const key = `${person.id}|${person.photo || ''}|${person.name}|${person.birth?.date || ''}|${person.death?.date || ''}|${size}`;
  if (CACHE.has(key)) return CACHE.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = Math.round(size * 0.86);
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  drawRibbon(ctx, w, h);
  drawPortrait(ctx, w, h, person);
  drawText(ctx, w, h, person);
  CACHE.set(key, canvas);
  return canvas;
}

function drawPortrait(ctx, w, h, person) {
  const cx = w * 0.5, cy = h * 0.335, rx = w * 0.205, ry = h * 0.265;
  ctx.save();
  ctx.shadowColor = 'rgba(55,31,12,.34)';
  ctx.shadowBlur = w * 0.025;
  ctx.shadowOffsetY = w * 0.012;
  ctx.fillStyle = '#77512a';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 1.075, ry * 1.055, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();

  const image = person.photo ? loadImage(person.photo) : null;
  if (image?.complete && image.naturalWidth) {
    drawCover(ctx, image, cx - rx, cy - ry, rx * 2, ry * 2);
  } else {
    drawFallbackPortrait(ctx, cx, cy, rx, ry, person.sex);
  }

  const vignette = ctx.createRadialGradient(cx, cy * 0.94, rx * 0.18, cx, cy, rx * 1.2);
  vignette.addColorStop(0.55, 'rgba(40,25,12,0)');
  vignette.addColorStop(1, 'rgba(31,17,8,.28)');
  ctx.fillStyle = vignette;
  ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);

  // Convex old glass: broad highlight, edge darkening, tiny specular streak.
  const glass = ctx.createRadialGradient(cx - rx * 0.48, cy - ry * 0.58, 0, cx - rx * 0.08, cy - ry * 0.05, rx * 1.35);
  glass.addColorStop(0, 'rgba(255,252,233,.48)');
  glass.addColorStop(0.19, 'rgba(255,255,248,.13)');
  glass.addColorStop(0.52, 'rgba(255,255,255,.015)');
  glass.addColorStop(0.86, 'rgba(55,34,17,.07)');
  glass.addColorStop(1, 'rgba(25,13,6,.28)');
  ctx.fillStyle = glass;
  ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
  ctx.strokeStyle = 'rgba(255,241,205,.5)';
  ctx.lineWidth = Math.max(1, w * 0.004);
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.16, cy - ry * 0.19, rx * 0.68, ry * 0.71, -0.16, Math.PI * 1.08, Math.PI * 1.62);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = '#6f4822';
  ctx.lineWidth = Math.max(4, w * 0.012);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 1.02, ry * 1.02, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(248,218,153,.62)';
  ctx.lineWidth = Math.max(1.5, w * 0.0045);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.96, ry * 0.96, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawFallbackPortrait(ctx, cx, cy, rx, ry, sex) {
  const paper = ctx.createRadialGradient(cx - rx * 0.35, cy - ry * 0.45, 4, cx, cy, rx * 1.25);
  paper.addColorStop(0, '#ead8ae');
  paper.addColorStop(0.62, '#9c805a');
  paper.addColorStop(1, '#4d3e2e');
  ctx.fillStyle = paper;
  ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
  ctx.fillStyle = 'rgba(49,39,29,.82)';
  ctx.beginPath(); ctx.ellipse(cx, cy - ry * 0.16, rx * 0.29, ry * 0.30, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx, cy + ry * 0.72, rx * 0.74, ry * 0.58, 0, Math.PI, Math.PI * 2); ctx.fill();
  if (sex === 'F') { ctx.beginPath(); ctx.ellipse(cx, cy - ry * 0.2, rx * 0.42, ry * 0.39, 0, Math.PI, Math.PI * 2); ctx.fill(); }
}

function drawRibbon(ctx, w, h) {
  const y = h * 0.64, rh = h * 0.28;
  const left = w * 0.12, right = w * 0.88;
  ctx.save();
  ctx.shadowColor = 'rgba(55,31,12,.38)';
  ctx.shadowBlur = w * 0.022;
  ctx.shadowOffsetY = w * 0.016;
  const parchment = ctx.createLinearGradient(0, y, 0, y + rh);
  parchment.addColorStop(0, '#f0d89b');
  parchment.addColorStop(0.48, '#d8b875');
  parchment.addColorStop(1, '#b9894d');
  ctx.fillStyle = parchment;
  ctx.strokeStyle = '#765028';
  ctx.lineWidth = Math.max(2, w * 0.007);
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.bezierCurveTo(left - w * 0.085, y - rh * 0.06, left - w * 0.12, y + rh * 0.17, left - w * 0.07, y + rh * 0.35);
  ctx.lineTo(left - w * 0.13, y + rh * 0.6);
  ctx.bezierCurveTo(left - w * 0.03, y + rh * 0.56, left + w * 0.02, y + rh * 0.75, left + w * 0.04, y + rh * 0.94);
  ctx.lineTo(right - w * 0.04, y + rh * 0.94);
  ctx.bezierCurveTo(right - w * 0.02, y + rh * 0.75, right + w * 0.03, y + rh * 0.56, right + w * 0.13, y + rh * 0.6);
  ctx.lineTo(right + w * 0.07, y + rh * 0.35);
  ctx.bezierCurveTo(right + w * 0.12, y + rh * 0.17, right + w * 0.085, y - rh * 0.06, right, y);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawText(ctx, w, h, person) {
  const max = w * 0.69;
  let fontSize = w * 0.066;
  ctx.fillStyle = '#2a1c10';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${fontSize}px Georgia, serif`;
  while (ctx.measureText(person.name).width > max && fontSize > w * 0.046) {
    fontSize -= 1;
    ctx.font = `700 ${fontSize}px Georgia, serif`;
  }
  ctx.fillText(person.name, w * 0.5, h * 0.765);
  const dates = `${person.birth?.date || '?'}${person.death?.date ? ` – ${person.death.date}` : ' –'}`;
  ctx.font = `600 ${w * 0.041}px Georgia, serif`;
  ctx.fillText(dates, w * 0.5, h * 0.855);
}

function loadImage(src) {
  if (IMAGES.has(src)) return IMAGES.get(src);
  const image = new Image();
  image.decoding = 'async';
  image.onload = () => { CACHE.clear(); window.dispatchEvent(new Event('ancestry-photo-loaded')); };
  image.src = src;
  IMAGES.set(src, image);
  return image;
}

function drawCover(ctx, image, x, y, w, h) {
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const sw = w / scale, sh = h / scale;
  const sx = (image.naturalWidth - sw) / 2;
  const sy = Math.max(0, (image.naturalHeight - sh) * 0.32);
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}
