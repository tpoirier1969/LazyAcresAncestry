const CACHE = new Map();
const IMAGES = new Map();

export function plaqueTexture(person, size = 520) {
  const key = `${person.id}|${person.photo || ''}|${person.name}|${person.birth?.date || ''}|${person.death?.date || ''}|${size}`;
  if (CACHE.has(key)) return CACHE.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = Math.round(size * 0.90);
  const ctx = canvas.getContext('2d');
  drawWoodPlaque(ctx, canvas.width, canvas.height);
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

function drawWoodPlaque(ctx, w, h) {
  const x = w * 0.135;
  const y = h * 0.655;
  const width = w * 0.73;
  const height = h * 0.245;
  const radius = w * 0.028;
  const capWidth = w * 0.075;

  ctx.save();
  ctx.shadowColor = 'rgba(42,24,12,.46)';
  ctx.shadowBlur = w * 0.024;
  ctx.shadowOffsetY = w * 0.016;

  roundedRectPath(ctx, x, y, width, height, radius);
  const wood = ctx.createLinearGradient(0, y, 0, y + height);
  wood.addColorStop(0, '#74461f');
  wood.addColorStop(0.20, '#9a6330');
  wood.addColorStop(0.52, '#6d3d1b');
  wood.addColorStop(0.82, '#4b2915');
  wood.addColorStop(1, '#2f1a10');
  ctx.fillStyle = wood;
  ctx.fill();
  ctx.strokeStyle = '#2a170d';
  ctx.lineWidth = Math.max(2, w * 0.007);
  ctx.stroke();

  roundedRectPath(ctx, x + w * 0.014, y + h * 0.018, width - w * 0.028, height - h * 0.036, radius * 0.72);
  ctx.strokeStyle = 'rgba(214,159,78,.50)';
  ctx.lineWidth = Math.max(1.2, w * 0.0035);
  ctx.stroke();

  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = '#d4a66e';
  ctx.lineWidth = Math.max(0.8, w * 0.0024);
  for (let i = 0; i < 5; i += 1) {
    const gy = y + height * (0.18 + i * 0.16);
    ctx.beginPath();
    ctx.moveTo(x + capWidth * 0.70, gy);
    ctx.bezierCurveTo(
      x + width * 0.34, gy - h * 0.010,
      x + width * 0.62, gy + h * 0.012,
      x + width - capWidth * 0.70, gy - h * 0.004,
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  drawBrassCap(ctx, x - capWidth * 0.45, y - h * 0.006, capWidth, height + h * 0.012, w);
  drawBrassCap(ctx, x + width - capWidth * 0.55, y - h * 0.006, capWidth, height + h * 0.012, w);
  ctx.restore();
}

function drawBrassCap(ctx, x, y, width, height, w) {
  const radius = width * 0.32;
  roundedRectPath(ctx, x, y, width, height, radius);
  const brass = ctx.createLinearGradient(x, y, x + width, y);
  brass.addColorStop(0, '#604018');
  brass.addColorStop(0.18, '#a97829');
  brass.addColorStop(0.43, '#e3c36d');
  brass.addColorStop(0.62, '#9d6d22');
  brass.addColorStop(0.84, '#d4aa4b');
  brass.addColorStop(1, '#513515');
  ctx.fillStyle = brass;
  ctx.fill();
  ctx.strokeStyle = '#4e3215';
  ctx.lineWidth = Math.max(1.6, w * 0.0045);
  ctx.stroke();

  const rivetRadius = Math.max(2.2, w * 0.010);
  [0.22, 0.78].forEach(position => {
    const cx = x + width * 0.5;
    const cy = y + height * position;
    const rivet = ctx.createRadialGradient(cx - rivetRadius * 0.3, cy - rivetRadius * 0.3, 1, cx, cy, rivetRadius);
    rivet.addColorStop(0, '#f5dda0');
    rivet.addColorStop(0.45, '#c38b32');
    rivet.addColorStop(1, '#5f3c15');
    ctx.fillStyle = rivet;
    ctx.beginPath();
    ctx.arc(cx, cy, rivetRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(58,35,12,.78)';
    ctx.lineWidth = Math.max(1, w * 0.0025);
    ctx.stroke();
  });
}

function roundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawText(ctx, w, h, person) {
  const max = w * 0.61;
  let fontSize = w * 0.069;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(25,14,7,.72)';
  ctx.shadowBlur = w * 0.006;
  ctx.shadowOffsetY = w * 0.003;
  ctx.fillStyle = '#f3dfac';
  ctx.font = `700 ${fontSize}px Georgia, serif`;
  while (ctx.measureText(person.name).width > max && fontSize > w * 0.047) {
    fontSize -= 1;
    ctx.font = `700 ${fontSize}px Georgia, serif`;
  }
  ctx.fillText(person.name, w * 0.5, h * 0.758);
  const dates = `${person.birth?.date || '?'}${person.death?.date ? ` – ${person.death.date}` : ' –'}`;
  ctx.fillStyle = '#dbc28a';
  ctx.font = `600 ${w * 0.043}px Georgia, serif`;
  ctx.fillText(dates, w * 0.5, h * 0.833);
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
