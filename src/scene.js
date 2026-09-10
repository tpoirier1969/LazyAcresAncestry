import {
  apparentSphereRadius,
  fibonacciSphere,
  isVisible,
  projectSpherePoint,
  projectedTangentFrame,
  requiredSphereRadius,
  rotatePoint,
  slerpUnit,
  yawPitchToFront,
} from './geometry.js';
import { plaqueTexture } from './plaque.js';
import { layoutSample } from './layout.js';

const POPULATION = 9099;
const PLAQUE = { width: 1, height: 0.86 };
const RADIUS = Math.max(40, requiredSphereRadius({ count: POPULATION, plaqueWidth: 1, plaqueHeight: 0.75, spacingFactor: 1.8 }));

export class GlobeScene {
  constructor(canvas, onSelect) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onSelect = onSelect;
    this.population = fibonacciSphere(POPULATION);
    this.people = [];
    this.relationships = [];
    this.positions = new Map();
    this.hitAreas = [];
    this.yaw = 0;
    this.pitch = 0;
    this.cameraGap = 7.5;
    this.drag = null;
    this.needsDraw = false;
    this.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    window.addEventListener('ancestry-photo-loaded', () => this.requestDraw());
    this.bind();
    this.resize();
  }

  setFamily(people, relationships = []) {
    this.people = people;
    this.relationships = relationships;
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
    return {
      cx: w / 2,
      cy: h / 2,
      focal: Math.min(w, h) * 1.08,
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
      // Drag the surface in the same direction as the pointer.
      this.yaw = this.drag.yaw - dx * 0.0033;
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

  resetView() {
    this.yaw = 0;
    this.pitch = 0;
    this.cameraGap = 7.5;
    this.requestDraw();
  }

  focus(id, { resetZoom = false } = {}) {
    const local = this.positions.get(id);
    if (!local) return;
    if (resetZoom) this.cameraGap = 7.5;
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
    this.drawRelationships(camera);
    this.drawPeople(camera);
  }

  drawAtlasGrid(camera) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(95,66,36,.12)';
    ctx.lineWidth = 0.7;
    for (let lat = -60; lat <= 60; lat += 20) this.drawParallel(camera, lat * Math.PI / 180);
    for (let lon = 0; lon < 360; lon += 20) this.drawMeridian(camera, lon * Math.PI / 180);
    ctx.restore();
  }

  drawParallel(camera, lat) {
    const points = [];
    for (let i = 0; i <= 140; i += 1) {
      const lon = i / 140 * Math.PI * 2;
      let p = { x: Math.cos(lat) * Math.cos(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.sin(lon) };
      p = rotatePoint(p, this.yaw, this.pitch);
      const q = projectSpherePoint(p, camera, RADIUS);
      points.push(isVisible(p, q) ? q : null);
    }
    strokeSegments(this.ctx, points);
  }

  drawMeridian(camera, lon) {
    const points = [];
    for (let i = 0; i <= 100; i += 1) {
      const lat = -Math.PI / 2 + i / 100 * Math.PI;
      let p = { x: Math.cos(lat) * Math.cos(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.sin(lon) };
      p = rotatePoint(p, this.yaw, this.pitch);
      const q = projectSpherePoint(p, camera, RADIUS);
      points.push(isVisible(p, q) ? q : null);
    }
    strokeSegments(this.ctx, points);
  }

  drawPopulation(camera) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(74,50,28,.30)';
    for (let i = 0; i < POPULATION; i += 1) {
      let p = { x: this.population[i * 3], y: this.population[i * 3 + 1], z: this.population[i * 3 + 2] };
      p = rotatePoint(p, this.yaw, this.pitch);
      const q = projectSpherePoint(p, camera, RADIUS);
      if (!isVisible(p, q)) continue;
      const tangent = projectedTangentFrame(p, camera, RADIUS, PLAQUE.width, PLAQUE.height);
      if (!tangent) continue;
      const rw = Math.max(0.55, Math.hypot(tangent.xAxis.x, tangent.xAxis.y) * 0.20);
      if (rw < 0.7) continue;
      ctx.globalAlpha = clamp((rw - 0.5) / 8, 0.04, 0.22);
      ctx.beginPath();
      ctx.ellipse(q.x, q.y, rw, rw * 1.18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawRelationships(camera) {
    const spousePairs = this.relationships.filter(r => r.type === 'spouse');
    const parentLinks = this.relationships.filter(r => r.type === 'parent');
    const parentsByChild = new Map();
    parentLinks.forEach(link => {
      if (!parentsByChild.has(link.to)) parentsByChild.set(link.to, []);
      parentsByChild.get(link.to).push(link.from);
    });

    const drawnSpouses = new Set();
    spousePairs.forEach(link => {
      const key = pairKey(link.from, link.to);
      if (drawnSpouses.has(key)) return;
      drawnSpouses.add(key);
      this.drawSurfaceArc(link.from, link.to, camera, 'rgba(86,57,30,.72)', 1.55);
    });

    parentsByChild.forEach((parents, childId) => {
      const unique = [...new Set(parents)].filter(id => this.positions.has(id));
      if (!unique.length || !this.positions.has(childId)) return;
      if (unique.length === 1) {
        this.drawSurfaceArc(unique[0], childId, camera, 'rgba(86,57,30,.68)', 1.5);
        return;
      }

      const [a, b] = unique;
      const pair = spousePairs.some(link => pairKey(link.from, link.to) === pairKey(a, b));
      if (!pair) this.drawSurfaceArc(a, b, camera, 'rgba(86,57,30,.72)', 1.55);
      const midpoint = slerpUnit(this.positions.get(a), this.positions.get(b), 0.5);
      this.drawUnitArc(midpoint, this.positions.get(childId), camera, 'rgba(86,57,30,.72)', 1.6);
    });
  }

  drawSurfaceArc(fromId, toId, camera, stroke, width) {
    const from = this.positions.get(fromId), to = this.positions.get(toId);
    if (!from || !to) return;
    this.drawUnitArc(from, to, camera, stroke, width);
  }

  drawUnitArc(from, to, camera, stroke, width) {
    const ctx = this.ctx;
    const points = [];
    for (let i = 0; i <= 30; i += 1) {
      const local = slerpUnit(from, to, i / 30);
      const unit = rotatePoint(local, this.yaw, this.pitch);
      const projected = projectSpherePoint(unit, camera, RADIUS);
      points.push(isVisible(unit, projected) ? projected : null);
    }
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    strokeSegments(ctx, points);
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
    if (apparentWidth < 8) return;

    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = clamp((apparentWidth - 6) / 50, 0.12, 1);
    const a = frame.xAxis.x / (tex.width / 2);
    const b = frame.xAxis.y / (tex.width / 2);
    const c = frame.yAxis.x / (tex.height / 2);
    const d = frame.yAxis.y / (tex.height / 2);
    ctx.setTransform(camera.dpr * a, camera.dpr * b, camera.dpr * c, camera.dpr * d, camera.dpr * frame.center.x, camera.dpr * frame.center.y);
    if (apparentWidth >= 58) ctx.drawImage(tex, -tex.width / 2, -tex.height / 2);
    else drawMiniMedallion(ctx, tex.width, tex.height);
    ctx.restore();

    this.hitAreas.push({ id: person.id, x: frame.center.x, y: frame.center.y, r: Math.max(12, Math.max(xLen, yLen) * 1.3), z: frame.center.z });
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
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = '#6d4c29';
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 36; i += 1) {
    const y = hash(i * 13) * h;
    const start = hash(i * 19 + 1) * w * 0.4;
    ctx.beginPath();
    ctx.moveTo(start, y);
    for (let x = start; x < w; x += 42) ctx.lineTo(x, y + Math.sin(x * 0.012 + i) * (2 + hash(i * 7) * 5));
    ctx.stroke();
  }
  ctx.restore();
}

function drawMiniMedallion(ctx, w, h) {
  const rx = w * 0.15, ry = h * 0.19;
  ctx.fillStyle = '#66503a';
  ctx.beginPath(); ctx.ellipse(0, -h * 0.04, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#a97c43'; ctx.lineWidth = w * 0.008; ctx.stroke();
  const glass = ctx.createRadialGradient(-rx * 0.55, -h * 0.11 - ry * 0.5, 0, 0, -h * 0.04, rx);
  glass.addColorStop(0, 'rgba(255,248,218,.42)'); glass.addColorStop(0.3, 'rgba(255,255,255,.08)'); glass.addColorStop(1, 'rgba(25,15,8,.18)');
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

function pairKey(a, b) { return [a, b].sort().join('|'); }
function shortestAngle(from, to) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function hash(value) { const x = Math.sin(value * 12.9898) * 43758.5453; return x - Math.floor(x); }
