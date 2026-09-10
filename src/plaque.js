const CACHE = new Map();
const IMAGES = new Map();

export function plaqueTexture(person, size = 520) {
  const key = `${person.id}|${person.photo || ''}|${person.name}|${person.birth?.date || ''}|${person.death?.date || ''}|${size}`;
  if (CACHE.has(key)) return CACHE.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = Math.round(size * 0.90);
  const ctx = canvas.getContext('2d');
  drawRibbon(ctx, canvas.width, canvas.height);
  drawPortrait(ctx, canvas.width, canvas.height, person);
  drawText(ctx, canvas.width, canvas.height, person);
  CACHE.set(key, canvas);
  return canvas;
}

function drawPortrait(ctx, w, h, person) {
  const cx = w * 0.5, cy = h * 0.335, rx = w * 0.205, ry = h * 0.275;
  drawGoldFrame(ctx, cx, cy, rx, ry, w);

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.84, ry * 0.84, 0, 0, Math.PI * 2);
  ctx.clip();
  const image = person.photo ? loadImage(person.photo) : null;
  if (image?.complete && image.naturalWidth) drawCover(ctx, image, cx - rx * 0.84, cy - ry * 0.84, rx * 1.68, ry * 1.68);
  else drawFallbackPortrait(ctx, cx, cy, rx * 0.84, ry * 0.84, person.sex);

  const vignette = ctx.createRadialGradient(cx, cy, rx * 0.2, cx, cy, rx * 1.1);
  vignette.addColorStop(0.56, 'rgba(35,22,12,0)');
  vignette.addColorStop(1, 'rgba(31,17,8,.30)');
  ctx.fillStyle = vignette;
  ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);

  const glass = ctx.createRadialGradient(cx - rx * 0.5, cy - ry * 0.60, 0, cx - rx * 0.05, cy, rx * 1.35);
  glass.addColorStop(0, 'rgba(255,253,238,.55)');
  glass.addColorStop(0.18, 'rgba(255,255,250,.16)');
  glass.addColorStop(0.52, 'rgba(255,255,255,.01)');
  glass.addColorStop(0.88, 'rgba(55,34,17,.07)');
  glass.addColorStop(1, 'rgba(25,13,6,.30)');
  ctx.fillStyle = glass;
  ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
  ctx.strokeStyle = 'rgba(255,247,221,.68)';
  ctx.lineWidth = Math.max(1.5, w * 0.004);
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.15, cy - ry * 0.18, rx * 0.56, ry * 0.62, -0.18, Math.PI * 1.06, Math.PI * 1.62);
  ctx.stroke();
  ctx.restore();
}

function drawGoldFrame(ctx, cx, cy, rx, ry, w) {
  ctx.save();
  ctx.shadowColor = 'rgba(55,31,12,.42)';
  ctx.shadowBlur = w * 0.028;
  ctx.shadowOffsetY = w * 0.014;
  const gold = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
  gold.addColorStop(0, '#76501f');
  gold.addColorStop(0.22, '#d5ab55');
  gold.addColorStop(0.52, '#f0d27c');
  gold.addColorStop(0.74, '#a9752d');
  gold.addColorStop(1, '#5c3b18');
  ctx.fillStyle = gold;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx * 1.08, ry * 1.06, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.86, ry * 0.86, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(255,229,153,.70)';
  ctx.lineWidth = Math.max(1.5, w * 0.004);
  ctx.beginPath(); ctx.ellipse(cx, cy, rx * 1.00, ry * 0.98, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  drawOrnament(ctx, cx, cy - ry * 1.01, 0, w);
  drawOrnament(ctx, cx, cy + ry * 1.01, Math.PI, w);
  drawOrnament(ctx, cx - rx * 1.01, cy, -Math.PI / 2, w * 0.72);
  drawOrnament(ctx, cx + rx * 1.01, cy, Math.PI / 2, w * 0.72);
}

function drawOrnament(ctx, x, y, rotation, w) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.strokeStyle = '#7a511f';
  ctx.fillStyle = '#c89a43';
  ctx.lineWidth = Math.max(2, w * 0.005);
  ctx.beginPath();
  ctx.moveTo(0, -w * 0.028);
  ctx.bezierCurveTo(-w * 0.018, -w * 0.010, -w * 0.038, w * 0.006, -w * 0.055, w * 0.025);
  ctx.bezierCurveTo(-w * 0.024, w * 0.018, -w * 0.014, w * 0.045, 0, w * 0.060);
  ctx.bezierCurveTo(w * 0.014, w * 0.045, w * 0.024, w * 0.018, w * 0.055, w * 0.025);
  ctx.bezierCurveTo(w * 0.038, w * 0.006, w * 0.018, -w * 0.010, 0, -w * 0.028);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawFallbackPortrait(ctx, cx, cy, rx, ry, sex) {
  const paper = ctx.createRadialGradient(cx - rx * 0.35, cy - ry * 0.45, 4, cx, cy, rx * 1.25);
  paper.addColorStop(0, '#ead8ae'); paper.addColorStop(0.62, '#9c805a'); paper.addColorStop(1, '#4d3e2e');
  ctx.fillStyle = paper; ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
  ctx.fillStyle = 'rgba(49,39,29,.82)';
  ctx.beginPath(); ctx.ellipse(cx, cy - ry * 0.16, rx * 0.29, ry * 0.30, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx, cy + ry * 0.72, rx * 0.74, ry * 0.58, 0, Math.PI, Math.PI * 2); ctx.fill();
  if (sex === 'F') { ctx.beginPath(); ctx.ellipse(cx, cy - ry * 0.2, rx * 0.42, ry * 0.39, 0, Math.PI, Math.PI * 2); ctx.fill(); }
}

function drawRibbon(ctx, w, h) {
  const y = h * 0.645, rh = h * 0.27;
  const left = w * 0.10, right = w * 0.90;
  ctx.save();
  ctx.shadowColor = 'rgba(55,31,12,.40)';
  ctx.shadowBlur = w * 0.025;
  ctx.shadowOffsetY = w * 0.017;
  const parchment = ctx.createLinearGradient(0, y, 0, y + rh);
  parchment.addColorStop(0, '#f2dda5'); parchment.addColorStop(0.50, '#dab875'); parchment.addColorStop(1, '#b78345');
  ctx.fillStyle = parchment;
  ctx.strokeStyle = '#765028';
  ctx.lineWidth = Math.max(2, w * 0.007);
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.bezierCurveTo(left - w * 0.10, y - rh * 0.08, left - w * 0.13, y + rh * 0.18, left - w * 0.07, y + rh * 0.37);
  ctx.lineTo(left - w * 0.14, y + rh * 0.62);
  ctx.bezierCurveTo(left - w * 0.03, y + rh * 0.57, left + w * 0.02, y + rh * 0.78, left + w * 0.045, y + rh * 0.95);
  ctx.lineTo(right - w * 0.045, y + rh * 0.95);
  ctx.bezierCurveTo(right - w * 0.02, y + rh * 0.78, right + w * 0.03, y + rh * 0.57, right + w * 0.14, y + rh * 0.62);
  ctx.lineTo(right + w * 0.07, y + rh * 0.37);
  ctx.bezierCurveTo(right + w * 0.13, y + rh * 0.18, right + w * 0.10, y - rh * 0.08, right, y);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawText(ctx, w, h, person) {
  const max = w * 0.73;
  let fontSize = w * 0.068;
  ctx.fillStyle = '#26190e';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${fontSize}px Georgia, serif`;
  while (ctx.measureText(person.name).width > max && fontSize > w * 0.048) {
    fontSize -= 1;
    ctx.font = `700 ${fontSize}px Georgia, serif`;
  }
  ctx.fillText(person.name, w * 0.5, h * 0.775);
  const dates = `${person.birth?.date || '?'}${person.death?.date ? ` – ${person.death.date}` : ' –'}`;
  ctx.font = `600 ${w * 0.043}px Georgia, serif`;
  ctx.fillText(dates, w * 0.5, h * 0.86);
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
  const sy = Math.max(0, (image.naturalHeight - sh) * 0.28);
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}
