import {
  apparentSphereRadius,
  fibonacciSphere,
  isVisible,
  projectSpherePoint,
  projectedTangentFrame,
  requiredSphereRadius,
  rotatePoint,
  yawPitchToFront,
} from './geometry.js';
import { plaqueTexture } from './plaque.js';
import { layoutSample } from './layout.js';

const POPULATION = 9099;
const PLAQUE = { width: 1, height: 0.82 };
const RADIUS = Math.max(40, requiredSphereRadius({ count: POPULATION, plaqueWidth: 1, plaqueHeight: 0.75, spacingFactor: 1.8 }));

export class GlobeScene {
  constructor(canvas, onSelect) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onSelect = onSelect;
    this.population = fibonacciSphere(POPULATION);
    this.people = [];
    this.positions = new Map();
    this.hitAreas = [];
    this.yaw = 0;
    this.pitch = 0;
    this.cameraGap = 7.5;
    this.drag = null;
    this.needsDraw = true;
    this.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.bind();
    this.resize();
  }

  setPeople(people) {
    this.people = people;
    this.positions = layoutSample(people, RADIUS);
    this.requestDraw();
  }

  get radius() { return RADIUS; }
  get diameter() { return RADIUS * 2; }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.canvas.dataset.dpr = String(dpr);
    this.requestDraw();
  }

  camera() {
    const dpr = Number(this.canvas.dataset.dpr || 1);
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;
    const focal = Math.min(w, h) * 1.08;
    return {
      cx: w / 2,
      cy: h / 2,
      focal,
      centerZ: RADIUS + this.cameraGap,
      near: 0.1,
      dpr,
    };
  }

  bind() {
    this.canvas.addEventListener('pointerdown', event => {
      this.canvas.setPointerCapture(event.pointerId);
      this.drag = { x: event.clientX, y: event.clientY, yaw: this.yaw, pitch: this.pitch, moved: false };
    });
    this.canvas.addEventListener('pointermove', event => {
      if (!this.drag) return;
      const dx = event.clientX - this.drag.x;
      const dy = event.clientY - this.drag.y;
      if (Math.hypot(dx, dy) > 3) this.drag.moved = true;
      this.yaw = this.drag.yaw + dx * 0.0033;
      this.pitch = clamp(this.drag.pitch - dy * 0.0033, -1.22, 1.22);
      this.requestDraw();
    });
    this.canvas.addEventListener('pointerup', event => {
      if (!this.drag?.moved) this.pick(event.offsetX, event.offsetY);
      this.drag = null;
    });
    this.canvas.addEventListener('wheel', event => {
      event.preventDefault();
      this.cameraGap = clamp(this.cameraGap + Math.sign(event.deltaY) * 0.9, 3.5, 18);
      this.requestDraw();
    }, { passive: false });
  }

  focus(id) {
    const local = this.positions.get(id);
    if (!local) return;
    const target = yawPitchToFront(local);
    if (this.reduceMotion) {
      this.yaw = target.yaw;
      this.pitch = target.pitch;
      this.requestDraw();
      return;
    }
    const start = performance.now();
    const from = { yaw: this.yaw, pitch: this.pitch };
    const duration = 520;
    const tick = now => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      this.yaw = from.yaw + shortestAngle(from.yaw, target.yaw) * eased;
      this.pitch = from.pitch + (target.pitch - from.pitch) * eased;
      this.requestDraw();
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  requestDraw() {
    if (this.needsDraw) return;
    this.needsDraw = true;
    requestAnimationFrame(() => this.draw());
  }

  draw() {
    this.needsDraw = false;
    const camera = this.camera();
    const { ctx } = this;
    const dpr = camera.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = this.canvas.width / dpr, h = this.canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);
    drawBackdrop(ctx, w, h);
    drawSphere(ctx, camera, RADIUS, w, h);
    this.drawAtlasGrid(camera);
    this.drawPopulation(camera);
    this.drawPeople(camera);
  }

  drawAtlasGrid(camera) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(95,66,36,.20)';
    ctx.lineWidth = 0.8;
    for (let lat = -60; lat <= 60; lat += 15) this.drawParallel(camera, lat * Math.PI / 180);
    for (let lon = 0; lon < 360; lon += 15) this.drawMeridian(camera, lon * Math.PI / 180);
    ctx.restore();
  }

  drawParallel(camera, lat) {
    const points = [];
    for (let i = 0; i <= 160; i += 1) {
      const lon = i / 160 * Math.PI * 2;
      let p = { x: Math.cos(lat) * Math.cos(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.sin(lon) };
      p = rotatePoint(p, this.yaw, this.pitch);
      const q = projectSpherePoint(p, camera, RADIUS);
      if (isVisible(p, q)) points.push(q); else points.push(null);
    }
    strokeSegments(this.ctx, points);
  }

  drawMeridian(camera, lon) {
    const points = [];
    for (let i = 0; i <= 120; i += 1) {
      const lat = -Math.PI / 2 + i / 120 * Math.PI;
      let p = { x: Math.cos(lat) * Math.cos(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.sin(lon) };
      p = rotatePoint(p, this.yaw, this.pitch);
      const q = projectSpherePoint(p, camera, RADIUS);
      if (isVisible(p, q)) points.push(q); else points.push(null);
    }
    strokeSegments(this.ctx, points);
  }

  drawPopulation(camera) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(74,50,28,.43)';
    for (let i = 0; i < POPULATION; i += 1) {
      let p = {
        x: this.population[i * 3],
        y: this.population[i * 3 + 1],
        z: this.population[i * 3 + 2],
      };
      p = rotatePoint(p, this.yaw, this.pitch);
      const q = projectSpherePoint(p, camera, RADIUS);
      if (!isVisible(p, q)) continue;
      const tangent = projectedTangentFrame(p, camera, RADIUS, PLAQUE.width, PLAQUE.height);
      if (!tangent) continue;
      const rw = Math.max(0.65, Math.hypot(tangent.xAxis.x, tangent.xAxis.y) * 0.32);
      if (rw < 0.85) continue;
      const alpha = clamp((rw - 0.7) / 7, 0.08, 0.38);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.ellipse(q.x, q.y, rw, rw * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawPeople(camera) {
    const ordered = [];
    this.people.forEach(person => {
      const local = this.positions.get(person.id);
      if (!local) return;
      const unit = rotatePoint(local, this.yaw, this.pitch);
      const projected = projectSpherePoint(unit, camera, RADIUS);
      if (!isVisible(unit, projected)) return;
      ordered.push({ person, unit, projected });
    });
    ordered.sort((a, b) => b.projected.z - a.projected.z);
    this.hitAreas = [];
    ordered.forEach(entry => this.drawPlaque(entry, camera));
  }

  drawPlaque({ person, unit }, camera) {
    const frame = projectedTangentFrame(unit, camera, RADIUS, PLAQUE.width, PLAQUE.height);
    if (!frame) return;
    const tex = plaqueTexture(person);
    const xLen = Math.hypot(frame.xAxis.x, frame.xAxis.y);
    const yLen = Math.hypot(frame.yAxis.x, frame.yAxis.y);
    const apparentWidth = xLen * 2;
    if (apparentWidth < 7) return;

    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = clamp((apparentWidth - 5) / 45, 0.10, 1);
    const a = frame.xAxis.x / (tex.width / 2);
    const b = frame.xAxis.y / (tex.width / 2);
    const c = frame.yAxis.x / (tex.height / 2);
    const d = frame.yAxis.y / (tex.height / 2);
    ctx.setTransform(camera.dpr * a, camera.dpr * b, camera.dpr * c, camera.dpr * d, camera.dpr * frame.center.x, camera.dpr * frame.center.y);
    if (apparentWidth >= 42) {
      ctx.drawImage(tex, -tex.width / 2, -tex.height / 2);
    } else {
      drawMiniMedallion(ctx, tex.width, tex.height);
    }
    ctx.restore();

    this.hitAreas.push({
      id: person.id,
      x: frame.center.x,
      y: frame.center.y,
      r: Math.max(12, Math.max(xLen, yLen) * 1.25),
      z: frame.center.z,
    });
  }

  pick(x, y) {
    const candidates = this.hitAreas.filter(hit => Math.hypot(x - hit.x, y - hit.y) <= hit.r);
    if (!candidates.length) return;
    candidates.sort((a, b) => a.z - b.z);
    this.onSelect?.(candidates[0].id);
  }
}

function drawBackdrop(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#d7bd82');
  g.addColorStop(0.23, '#b5915b');
  g.addColorStop(1, '#5c472e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,248,220,.16)';
  for (let i = 0; i < 160; i += 1) {
    const x = hash(i * 17) * w;
    const y = hash(i * 31 + 7) * h;
    const r = 8 + hash(i * 53 + 4) * 30;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
}

function drawSphere(ctx, camera, radius, w, h) {
  const projectedRadius = apparentSphereRadius(camera, radius);
  const g = ctx.createRadialGradient(camera.cx - projectedRadius * 0.22, camera.cy - projectedRadius * 0.28, projectedRadius * 0.05, camera.cx, camera.cy, projectedRadius);
  g.addColorStop(0, '#efd9a3');
  g.addColorStop(0.5, '#c8a36b');
  g.addColorStop(0.86, '#997445');
  g.addColorStop(1, '#563c25');
  ctx.save();
  ctx.shadowColor = 'rgba(62,38,17,.42)';
  ctx.shadowBlur = 60;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(camera.cx, camera.cy, projectedRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.clip();

  ctx.globalAlpha = 0.17;
  ctx.strokeStyle = '#6d4c29';
  ctx.lineWidth = 1;
  for (let i = 0; i < 120; i += 1) {
    const y = hash(i * 13) * h;
    const start = hash(i * 19 + 1) * w * 0.4;
    ctx.beginPath();
    ctx.moveTo(start, y);
    for (let x = start; x < w; x += 24) {
      ctx.lineTo(x, y + Math.sin(x * 0.016 + i) * (3 + hash(i * 7) * 8));
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawMiniMedallion(ctx, w, h) {
  const rx = w * 0.20, ry = h * 0.23;
  ctx.fillStyle = '#5d452e';
  ctx.beginPath(); ctx.ellipse(0, -h * 0.06, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#b58a4c'; ctx.lineWidth = w * 0.01; ctx.stroke();
  const glass = ctx.createRadialGradient(-rx * 0.55, -h * 0.12 - ry * 0.5, 0, 0, -h * 0.06, rx);
  glass.addColorStop(0, 'rgba(255,248,218,.48)'); glass.addColorStop(0.3, 'rgba(255,255,255,.10)'); glass.addColorStop(1, 'rgba(25,15,8,.20)');
  ctx.fillStyle = glass; ctx.fill();
}

function strokeSegments(ctx, points) {
  ctx.beginPath();
  let active = false;
  points.forEach(point => {
    if (!point) { active = false; return; }
    if (!active) { ctx.moveTo(point.x, point.y); active = true; }
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
}

function shortestAngle(from, to) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function hash(value) { const x = Math.sin(value * 12.9898) * 43758.5453; return x - Math.floor(x); }
