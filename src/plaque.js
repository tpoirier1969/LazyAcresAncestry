const CACHE = new Map();
const IMAGES = new Map();

export function plaqueTexture(person, size = 520) {
  const key = `${person.id}|${person.photo || ''}|${person.name}|${person.birth?.date || ''}|${person.death?.date || ''}|${size}`;
  if (CACHE.has(key)) return CACHE.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = Math.round(size * 0.90);
  const ctx = canvas.getContext('2d');
  drawScroll(ctx, canvas.width, canvas.height);
  drawPortrait(ctx, canvas.width, canvas.height, person);
  drawText(ctx, canvas.width, canvas.height, person);
  CACHE.set(key, canvas);
  return canvas;
}

function drawPortrait(ctx, w, h, person) {
  const cx = w * 0.5, cy = h * 0.315, rx = w * 0.225, ry = h * 0.305;
  drawGoldFrame(ctx, cx, cy, rx, ry, w);

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.845, ry * 0.845, 0, 0, Math.PI * 2);
  ctx.clip();
  const image = person.photo ? loadImage(person.photo) : null;
  if (image?.complete && image.naturalWidth) drawCover(ctx, image, cx - rx * 0.845, cy - ry * 0.845, rx * 1.69, ry * 1.69);
  else drawFallbackPortrait(ctx, cx, cy, rx * 0.845, ry * 0.845, person.sex);

  const vignette = ctx.createRadialGradient(cx - rx * 0.12, cy - ry * 0.15, rx * 0.18, cx, cy, rx * 1.16);
  vignette.addColorStop(0.48, 'rgba(35,22,12,0)');
  vignette.addColorStop(0.82, 'rgba(40,24,12,.08)');
  vignette.addColorStop(1, 'rgba(24,13,7,.40)');
  ctx.fillStyle = vignette;
  ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);

  const glass = ctx.createRadialGradient(cx - rx * 0.48, cy - ry * 0.58, 0, cx - rx * 0.02, cy - ry * 0.02, rx * 1.38);
  glass.addColorStop(0, 'rgba(255,255,244,.64)');
  glass.addColorStop(0.17, 'rgba(255,255,250,.20)');
  glass.addColorStop(0.48, 'rgba(255,255,255,.015)');
  glass.addColorStop(0.82, 'rgba(68,42,20,.06)');
  glass.addColorStop(1, 'rgba(24,13,7,.31)');
  ctx.fillStyle = glass;
  ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);

  ctx.strokeStyle = 'rgba(255,252,234,.78)';
  ctx.lineWidth = Math.max(2, w * 0.005);
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.13, cy - ry * 0.18, rx * 0.60, ry * 0.67, -0.16, Math.PI * 1.07, Math.PI * 1.60);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,248,.28)';
  ctx.lineWidth = Math.max(1.4, w * 0.0032);
  ctx.beginPath();
  ctx.ellipse(cx + rx * 0.08, cy + ry * 0.02, rx * 0.78, ry * 0.79, 0.08, Math.PI * 1.58, Math.PI * 1.94);
  ctx.stroke();
  ctx.restore();
}

function drawGoldFrame(ctx, cx, cy, rx, ry, w) {
  ctx.save();
  ctx.shadowColor = 'rgba(55,31,12,.48)';
  ctx.shadowBlur = w * 0.032;
  ctx.shadowOffsetY = w * 0.016;
  const gold = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
  gold.addColorStop(0, '#654016');
  gold.addColorStop(0.18, '#c9953c');
  gold.addColorStop(0.42, '#f1d47c');
  gold.addColorStop(0.65, '#b27a28');
  gold.addColorStop(0.84, '#e1bc62');
  gold.addColorStop(1, '#513214');
  ctx.fillStyle = gold;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx * 1.10, ry * 1.075, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.855, ry * 0.855, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  ctx.strokeStyle = 'rgba(255,235,169,.86)';
  ctx.lineWidth = Math.max(1.8, w * 0.0045);
  ctx.beginPath(); ctx.ellipse(cx, cy, rx * 1.015, ry * 0.995, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(74,45,15,.72)';
  ctx.lineWidth = Math.max(1.2, w * 0.003);
  ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.90, ry * 0.90, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  drawOrnament(ctx, cx, cy - ry * 1.02, 0, w);
  drawOrnament(ctx, cx, cy + ry * 1.02, Math.PI, w);
  drawOrnament(ctx, cx - rx * 1.02, cy, -Math.PI / 2, w * 0.72);
  drawOrnament(ctx, cx + rx * 1.02, cy, Math.PI / 2, w * 0.72);
}

function drawOrnament(ctx, x, y, rotation, w) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.strokeStyle = '#704718';
  ctx.fillStyle = '#c59035';
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

function drawScroll(ctx, w, h) {
  const y = h * 0.655;
  const rh = h * 0.255;
  const left = w * 0.145;
  const right = w * 0.855;
  const curl = w * 0.075;

  ctx.save();
  ctx.shadowColor = 'rgba(55,31,12,.42)';
  ctx.shadowBlur = w * 0.026;
  ctx.shadowOffsetY = w * 0.018;

  const parchment = ctx.createLinearGradient(0, y, 0, y + rh);
  parchment.addColorStop(0, '#f4e2ad');
  parchment.addColorStop(0.44, '#e5c986');
  parchment.addColorStop(0.76, '#d2aa61');
  parchment.addColorStop(1, '#b77e3c');
  ctx.fillStyle = parchment;
  ctx.strokeStyle = '#765028';
  ctx.lineWidth = Math.max(2, w * 0.0065);

  ctx.beginPath();
  ctx.moveTo(left, y + rh * 0.08);
  ctx.quadraticCurveTo(w * 0.5, y - rh * 0.03, right, y + rh * 0.08);
  ctx.lineTo(right, y + rh * 0.88);
  ctx.quadraticCurveTo(w * 0.5, y + rh * 1.01, left, y + rh * 0.88);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  drawScrollCurl(ctx, left, y + rh * 0.49, -1, curl, rh, parchment, w);
  drawScrollCurl(ctx, right, y + rh * 0.49, 1, curl, rh, parchment, w);

  ctx.strokeStyle = 'rgba(255,244,205,.52)';
  ctx.lineWidth = Math.max(1.2, w * 0.003);
  ctx.beginPath();
  ctx.moveTo(left + curl * 0.28, y + rh * 0.16);
  ctx.quadraticCurveTo(w * 0.5, y + rh * 0.06, right - curl * 0.28, y + rh * 0.16);
  ctx.stroke();
  ctx.restore();
}

function drawScrollCurl(ctx, x, cy, direction, curl, rh, parchment, w) {
  ctx.save();
  ctx.fillStyle = parchment;
  ctx.strokeStyle = '#765028';
  ctx.lineWidth = Math.max(2, w * 0.006);

  ctx.beginPath();
  ctx.moveTo(x, cy - rh * 0.40);
  ctx.bezierCurveTo(x + direction * curl * 0.95, cy - rh * 0.34, x + direction * curl * 0.98, cy - rh * 0.02, x + direction * curl * 0.38, cy + rh * 0.09);
  ctx.bezierCurveTo(x + direction * curl * 0.88, cy + rh * 0.18, x + direction * curl * 0.80, cy + rh * 0.42, x, cy + rh * 0.40);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const roll = ctx.createLinearGradient(x, cy, x + direction * curl, cy);
  roll.addColorStop(0, 'rgba(92,55,24,.18)');
  roll.addColorStop(0.45, 'rgba(255,244,202,.48)');
  roll.addColorStop(1, 'rgba(84,49,20,.34)');
  ctx.fillStyle = roll;
  ctx.beginPath();
  ctx.ellipse(x + direction * curl * 0.46, cy + rh * 0.08, curl * 0.34, rh * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawText(ctx, w, h, person) {
  const max = w * 0.67;
  let fontSize = w * 0.074;
  ctx.fillStyle = '#26190e';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${fontSize}px Georgia, serif`;
  while (ctx.measureText(person.name).width > max && fontSize > w * 0.050) {
    fontSize -= 1;
    ctx.font = `700 ${fontSize}px Georgia, serif`;
  }
  ctx.fillText(person.name, w * 0.5, h * 0.765);
  const dates = `${person.birth?.date || '?'}${person.death?.date ? ` – ${person.death.date}` : ' –'}`;
  ctx.font = `600 ${w * 0.046}px Georgia, serif`;
  ctx.fillText(dates, w * 0.5, h * 0.838);
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
  const sy = Math.max(0, (image.naturalHeight - sh) * 0.25);
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}
