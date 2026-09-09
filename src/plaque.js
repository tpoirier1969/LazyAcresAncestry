const CACHE = new Map();

export function plaqueTexture(person, size = 360) {
  const key = `${person.sex}|${person.name}|${person.birth?.date || ''}|${person.death?.date || ''}|${size}`;
  if (CACHE.has(key)) return CACHE.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = Math.round(size * 0.82);
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  drawRibbon(ctx, w, h);
  drawPortrait(ctx, w, h, person.sex);
  drawText(ctx, w, h, person);
  CACHE.set(key, canvas);
  return canvas;
}

function drawPortrait(ctx, w, h, sex) {
  const cx = w * 0.5, cy = h * 0.35, rx = w * 0.22, ry = h * 0.27;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();

  const paper = ctx.createRadialGradient(cx - rx * 0.35, cy - ry * 0.45, 4, cx, cy, rx * 1.2);
  paper.addColorStop(0, '#f3e4bd');
  paper.addColorStop(0.58, '#a98d62');
  paper.addColorStop(1, '#4f4131');
  ctx.fillStyle = paper;
  ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);

  ctx.fillStyle = 'rgba(50,40,30,.82)';
  ctx.beginPath();
  ctx.ellipse(cx, cy - ry * 0.16, rx * 0.30, ry * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy + ry * 0.72, rx * 0.74, ry * 0.58, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  if (sex === 'F') {
    ctx.beginPath();
    ctx.ellipse(cx, cy - ry * 0.20, rx * 0.42, ry * 0.40, 0, Math.PI, Math.PI * 2);
    ctx.fill();
  }

  const glass = ctx.createRadialGradient(cx - rx * 0.55, cy - ry * 0.62, 0, cx - rx * 0.1, cy - ry * 0.05, rx * 1.25);
  glass.addColorStop(0, 'rgba(255,255,245,.56)');
  glass.addColorStop(0.18, 'rgba(255,255,245,.18)');
  glass.addColorStop(0.52, 'rgba(255,255,255,.02)');
  glass.addColorStop(0.88, 'rgba(45,30,18,.12)');
  glass.addColorStop(1, 'rgba(20,12,8,.34)');
  ctx.fillStyle = glass;
  ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);

  ctx.strokeStyle = '#7f5528';
  ctx.lineWidth = Math.max(3, w * 0.012);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,228,164,.55)';
  ctx.lineWidth = Math.max(1, w * 0.004);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.94, ry * 0.94, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawRibbon(ctx, w, h) {
  const y = h * 0.64, rh = h * 0.26;
  const left = w * 0.13, right = w * 0.87;
  ctx.save();
  ctx.shadowColor = 'rgba(55,31,12,.35)';
  ctx.shadowBlur = w * 0.025;
  ctx.shadowOffsetY = w * 0.018;
  ctx.fillStyle = '#d8b875';
  ctx.strokeStyle = '#765028';
  ctx.lineWidth = Math.max(2, w * 0.007);
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.bezierCurveTo(left - w * 0.08, y - rh * 0.08, left - w * 0.12, y + rh * 0.16, left - w * 0.07, y + rh * 0.34);
  ctx.lineTo(left - w * 0.12, y + rh * 0.58);
  ctx.bezierCurveTo(left - w * 0.03, y + rh * 0.55, left + w * 0.02, y + rh * 0.72, left + w * 0.04, y + rh * 0.92);
  ctx.lineTo(right - w * 0.04, y + rh * 0.92);
  ctx.bezierCurveTo(right - w * 0.02, y + rh * 0.72, right + w * 0.03, y + rh * 0.55, right + w * 0.12, y + rh * 0.58);
  ctx.lineTo(right + w * 0.07, y + rh * 0.34);
  ctx.bezierCurveTo(right + w * 0.12, y + rh * 0.16, right + w * 0.08, y - rh * 0.08, right, y);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  const shade = ctx.createLinearGradient(0, y, 0, y + rh);
  shade.addColorStop(0, 'rgba(255,246,210,.45)');
  shade.addColorStop(0.48, 'rgba(255,255,255,.05)');
  shade.addColorStop(1, 'rgba(93,57,22,.20)');
  ctx.fillStyle = shade;
  ctx.fill();
  ctx.restore();
}

function drawText(ctx, w, h, person) {
  const max = w * 0.58;
  let fontSize = w * 0.052;
  ctx.fillStyle = '#342516';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${fontSize}px Georgia, serif`;
  while (ctx.measureText(person.name).width > max && fontSize > w * 0.036) {
    fontSize -= 1;
    ctx.font = `600 ${fontSize}px Georgia, serif`;
  }
  ctx.fillText(person.name, w * 0.5, h * 0.755);
  const dates = `${person.birth?.date || '?'}${person.death?.date ? ` – ${person.death.date}` : ' –'}`;
  ctx.font = `${w * 0.032}px Georgia, serif`;
  ctx.fillText(dates, w * 0.5, h * 0.835);
}
