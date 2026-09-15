import { plaqueMetalForSex } from './plaque-metal.js';

const CACHE = new Map();
const IMAGES = new Map();

export function plaqueTexture(person, size = 520) {
  const metal = plaqueMetalForSex(person.sex);
  const key = [
    person.id,
    person.photo || '',
    person.name || '',
    person.sex || 'U',
    person.birth?.date || '',
    person.death?.date || '',
    size,
  ].join('|');
  if (CACHE.has(key)) return CACHE.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = Math.round(size * 0.92);
  const ctx = canvas.getContext('2d');
  drawWoodPlaque(ctx, canvas.width, canvas.height, metal);
  drawPortrait(ctx, canvas.width, canvas.height, person, metal);
  drawText(ctx, canvas.width, canvas.height, person);
  CACHE.set(key, canvas);
  return canvas;
}

function drawPortrait(ctx, w, h, person, metal) {
  const cx = w * 0.5;
  const cy = h * 0.34;
  const rx = w * 0.225;
  const ry = h * 0.28;
  drawMetalFrame(ctx, cx, cy, rx, ry, w, metal);

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.845, ry * 0.845, 0, 0, Math.PI * 2);
  ctx.clip();
  const image = person.photo ? loadImage(person.photo) : null;
  if (image?.complete && image.naturalWidth) {
    drawCover(ctx, image, cx - rx * 0.845, cy - ry * 0.845, rx * 1.69, ry * 1.69);
  } else {
    drawFallbackPortrait(ctx, cx, cy, rx * 0.845, ry * 0.845, person.sex);
  }

  const vignette = ctx.createRadialGradient(
    cx - rx * 0.12,
    cy - ry * 0.15,
    rx * 0.18,
    cx,
    cy,
    rx * 1.16,
  );
  vignette.addColorStop(0.48, 'rgba(35,22,12,0)');
  vignette.addColorStop(0.82, 'rgba(40,24,12,.08)');
  vignette.addColorStop(1, 'rgba(24,13,7,.40)');
  ctx.fillStyle = vignette;
  ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);

  const glass = ctx.createRadialGradient(
    cx - rx * 0.48,
    cy - ry * 0.58,
    0,
    cx - rx * 0.02,
    cy - ry * 0.02,
    rx * 1.38,
  );
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

function drawMetalFrame(ctx, cx, cy, rx, ry, w, metal) {
  ctx.save();
  ctx.shadowColor = 'rgba(55,31,12,.48)';
  ctx.shadowBlur = w * 0.032;
  ctx.shadowOffsetY = w * 0.016;

  const gradient = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
  gradient.addColorStop(0, metal.dark);
  gradient.addColorStop(0.18, metal.mid);
  gradient.addColorStop(0.42, metal.bright);
  gradient.addColorStop(0.65, metal.mid);
  gradient.addColorStop(0.84, metal.light);
  gradient.addColorStop(1, metal.edge);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 1.10, ry * 1.075, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.855, ry * 0.855, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  ctx.strokeStyle = metal.bright;
  ctx.globalAlpha = 0.78;
  ctx.lineWidth = Math.max(1.8, w * 0.0045);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 1.015, ry * 0.995, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = metal.edge;
  ctx.lineWidth = Math.max(1.2, w * 0.003);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.90, ry * 0.90, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  drawOrnament(ctx, cx, cy - ry * 1.02, 0, w, metal);
  drawOrnament(ctx, cx, cy + ry * 1.02, Math.PI, w, metal);
  drawOrnament(ctx, cx - rx * 1.02, cy, -Math.PI / 2, w * 0.72, metal);
  drawOrnament(ctx, cx + rx * 1.02, cy, Math.PI / 2, w * 0.72, metal);
}

function drawOrnament(ctx, x, y, rotation, w, metal) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.strokeStyle = metal.edge;
  ctx.fillStyle = metal.mid;
  ctx.lineWidth = Math.max(2, w * 0.005);
  ctx.beginPath();
  ctx.moveTo(0, -w * 0.028);
  ctx.bezierCurveTo(-w * 0.018, -w * 0.010, -w * 0.038, w * 0.006, -w * 0.055, w * 0.025);
  ctx.bezierCurveTo(-w * 0.024, w * 0.018, -w * 0.014, w * 0.045, 0, w * 0.060);
  ctx.bezierCurveTo(w * 0.014, w * 0.045, w * 0.024, w * 0.018, w * 0.055, w * 0.025);
  ctx.bezierCurveTo(w * 0.038, w * 0.006, w * 0.018, -w * 0.010, 0, -w * 0.028);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawFallbackPortrait(ctx, cx, cy, rx, ry, sex) {
  const paper = ctx.createRadialGradient(cx - rx * 0.35, cy - ry * 0.45, 4, cx, cy, rx * 1.25);
  paper.addColorStop(0, '#ead8ae');
  paper.addColorStop(0.62, '#9c805a');
  paper.addColorStop(1, '#4d3e2e');
  ctx.fillStyle = paper;
  ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
  ctx.fillStyle = 'rgba(49,39,29,.82)';
  ctx.beginPath();
  ctx.ellipse(cx, cy - ry * 0.16, rx * 0.29, ry * 0.30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy + ry * 0.72, rx * 0.74, ry * 0.58, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  if (String(sex).toUpperCase() === 'F') {
    ctx.beginPath();
    ctx.ellipse(cx, cy - ry * 0.2, rx * 0.42, ry * 0.39, 0, Math.PI, Math.PI * 2);
    ctx.fill();
  }
}

function drawWoodPlaque(ctx, w, h, metal) {
  const x = w * 0.06;
  const y = h * 0.625;
  const width = w * 0.88;
  const height = h * 0.31;
  const radius = w * 0.028;
  const capWidth = w * 0.062;

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

  ctx.globalAlpha = 0.20;
  ctx.strokeStyle = '#d4a66e';
  ctx.lineWidth = Math.max(0.8, w * 0.0024);
  for (let i = 0; i < 5; i += 1) {
    const gy = y + height * (0.18 + i * 0.16);
    ctx.beginPath();
    ctx.moveTo(x + capWidth * 0.70, gy);
    ctx.bezierCurveTo(
      x + width * 0.34,
      gy - h * 0.010,
      x + width * 0.62,
      gy + h * 0.012,
      x + width - capWidth * 0.70,
      gy - h * 0.004,
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  drawMetalCap(ctx, x - capWidth * 0.45, y - h * 0.006, capWidth, height + h * 0.012, w, metal);
  drawMetalCap(ctx, x + width - capWidth * 0.55, y - h * 0.006, capWidth, height + h * 0.012, w, metal);
  ctx.restore();
}

function drawMetalCap(ctx, x, y, width, height, w, metal) {
  const radius = width * 0.32;
  roundedRectPath(ctx, x, y, width, height, radius);
  const gradient = ctx.createLinearGradient(x, y, x + width, y);
  gradient.addColorStop(0, metal.dark);
  gradient.addColorStop(0.18, metal.mid);
  gradient.addColorStop(0.43, metal.bright);
  gradient.addColorStop(0.62, metal.mid);
  gradient.addColorStop(0.84, metal.light);
  gradient.addColorStop(1, metal.edge);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = metal.edge;
  ctx.lineWidth = Math.max(1.6, w * 0.0045);
  ctx.stroke();

  const rivetRadius = Math.max(2.2, w * 0.010);
  [0.22, 0.78].forEach(position => {
    const cx = x + width * 0.5;
    const cy = y + height * position;
    const rivet = ctx.createRadialGradient(cx - rivetRadius * 0.3, cy - rivetRadius * 0.3, 1, cx, cy, rivetRadius);
    rivet.addColorStop(0, metal.bright);
    rivet.addColorStop(0.45, metal.mid);
    rivet.addColorStop(1, metal.dark);
    ctx.fillStyle = rivet;
    ctx.beginPath();
    ctx.arc(cx, cy, rivetRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = metal.edge;
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
  const maxWidth = w * 0.74;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(25,14,7,.72)';
  ctx.shadowBlur = w * 0.006;
  ctx.shadowOffsetY = w * 0.003;

  const name = fitWrappedText(ctx, person.name || 'Unknown', {
    maxWidth,
    maxLines: 2,
    startSize: w * 0.061,
    minSize: w * 0.035,
    weight: 700,
  });
  ctx.fillStyle = '#f3dfac';
  ctx.font = `700 ${name.fontSize}px Georgia, serif`;
  const nameLineHeight = name.fontSize * 1.02;
  const nameCenterY = h * 0.735;
  const firstNameY = nameCenterY - ((name.lines.length - 1) * nameLineHeight) / 2;
  name.lines.forEach((line, index) => {
    ctx.fillText(line, w * 0.5, firstNameY + index * nameLineHeight);
  });

  const dates = `${person.birth?.date || '?'}${person.death?.date ? ` – ${person.death.date}` : ' –'}`;
  const date = fitWrappedText(ctx, dates, {
    maxWidth: w * 0.80,
    maxLines: 1,
    startSize: w * 0.054,
    minSize: w * 0.038,
    weight: 600,
  });
  ctx.fillStyle = '#ead5a0';
  ctx.font = `600 ${date.fontSize}px Georgia, serif`;
  const dateCenterY = h * 0.862;
  ctx.fillText(date.lines[0] || '', w * 0.5, dateCenterY);
}

function fitWrappedText(ctx, text, { maxWidth, maxLines, startSize, minSize, weight }) {
  let fontSize = startSize;
  let lines = [String(text || '')];
  while (fontSize >= minSize) {
    ctx.font = `${weight} ${fontSize}px Georgia, serif`;
    lines = wrapWords(ctx, String(text || ''), maxWidth);
    if (lines.length <= maxLines && lines.every(line => ctx.measureText(line).width <= maxWidth)) {
      return { lines, fontSize };
    }
    fontSize -= 1;
  }

  ctx.font = `${weight} ${minSize}px Georgia, serif`;
  lines = wrapWords(ctx, String(text || ''), maxWidth);
  while (lines.length > maxLines) {
    const tail = lines.pop();
    lines[lines.length - 1] = `${lines[lines.length - 1]} ${tail}`.trim();
  }

  let fallbackSize = minSize;
  while (fallbackSize > 8 && lines.some(line => ctx.measureText(line).width > maxWidth)) {
    fallbackSize -= 1;
    ctx.font = `${weight} ${fallbackSize}px Georgia, serif`;
  }
  return { lines, fontSize: fallbackSize };
}

function wrapWords(ctx, text, maxWidth) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines;
}

function loadImage(src) {
  if (IMAGES.has(src)) return IMAGES.get(src);
  const image = new Image();
  image.decoding = 'async';
  image.onload = () => {
    CACHE.clear();
    window.dispatchEvent(new Event('ancestry-photo-loaded'));
  };
  image.src = src;
  IMAGES.set(src, image);
  return image;
}

function drawCover(ctx, image, x, y, w, h) {
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (image.naturalWidth - sw) / 2;
  const sy = Math.max(0, (image.naturalHeight - sh) * 0.25);
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}
