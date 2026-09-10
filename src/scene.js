import {
  apparentSphereRadius,
  isVisible,
  projectSpherePoint,
  projectedTangentFrame,
  requiredSphereRadius,
  rotatePoint,
  tangentPoint,
  yawPitchToFront,
} from './geometry.js';
import { plaqueTexture } from './plaque.js';
import { layoutSample } from './layout.js';

const POPULATION = 9099;
const PLAQUE = { width: 1, height: 0.86 };
const RADIUS = Math.max(40, requiredSphereRadius({ count: POPULATION, plaqueWidth: 1, plaqueHeight: 0.75, spacingFactor: 1.8 }));
const HOME_PITCH = 0.40;
const DEFAULT_GAP = 30;

export class GlobeScene {
  constructor(canvas, onSelect) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onSelect = onSelect;
    this.people = [];
    this.relationships = [];
    this.positions = new Map();
    this.hitAreas = [];
    this.yaw = 0;
    this.pitch = HOME_PITCH;
    this.cameraGap = DEFAULT_GAP;
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
    const focal = Math.min(w, h) * 1.02;
    const centerZ = RADIUS + this.cameraGap;
    const projectedRadius = focal * RADIUS / Math.sqrt(Math.max(1e-6, centerZ * centerZ - RADIUS * RADIUS));
    return {
      cx: w / 2,
      cy: projectedRadius + Math.max(42, h * 0.055),
      focal,
      centerZ,
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
      this.yaw = this.drag.yaw - dx * 0.003;
      this.pitch = clamp(this.drag.pitch - dy * 0.003, -0.95, 1.25);
      this.requestDraw();
    });
    this.canvas.addEventListener('pointerup', event => {
      if (!this.drag?.moved) this.pick(event.offsetX, event.offsetY);
      this.drag = null;
    });
    this.canvas.addEventListener('wheel', event => {
      event.preventDefault();
      this.cameraGap = clamp(this.cameraGap + Math.sign(event.deltaY) * 2, 16, 52);
      this.requestDraw();
    }, { passive: false });
  }

  focus(id, { resetZoom = false } = {}) {
    const local = this.positions.get(id);
    if (!local) return;
    if (resetZoom) this.cameraGap = DEFAULT_GAP;
    const target = yawPitchToFront(local);
    target.pitch += HOME_PITCH;
    if (this.reduceMotion) {
      this.yaw = target.yaw;
      this.pitch = target.pitch;
      this.requestDraw();
      return;
    }
    const from = { yaw: this.yaw, pitch: this.pitch };
    const start = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - start) / 520);
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
    const ctx = this.ctx;
    const dpr = camera.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);
    drawBackdrop(ctx, w, h);
    drawSphere(ctx, camera, RADIUS);
    this.drawMap(camera);
    this.drawGrid(camera);
    this.drawRelationships(camera);
    this.drawPeople(camera);
  }

  drawMap(camera) {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineCap = 'round';
    MAP_PATHS.forEach((path, index) => {
      const points = path.map(([x, y]) => {
        const local = tangentPoint(x, y, RADIUS);
        const unit = rotatePoint(local, this.yaw, this.pitch);
        const q = projectSpherePoint(unit, camera, RADIUS);
        return isVisible(unit, q) ? q : null;
      });
      ctx.strokeStyle = index < 4 ? 'rgba(77,55,34,.25)' : 'rgba(77,55,34,.14)';
      ctx.lineWidth = index < 4 ? 1.2 : 0.7;
      strokeSegments(ctx, points);
    });
    ctx.restore();
  }

  drawGrid(camera) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(96,68,40,.08)';
    ctx.lineWidth = 0.65;
    for (let x = -22; x <= 22; x += 4) this.drawSurfacePolyline([[x, -18], [x, 18]], camera);
    for (let y = -18; y <= 18; y += 4) this.drawSurfacePolyline([[-24, y], [24, y]], camera);
    ctx.restore();
  }

  drawRelationships(camera) {
    const parentLinks = this.relationships.filter(r => r.type === 'parent');
    const spousePairs = uniquePairs(this.relationships.filter(r => r.type === 'spouse'));
    const parentsByChild = new Map();
    parentLinks.forEach(link => {
      if (!parentsByChild.has(link.to)) parentsByChild.set(link.to, []);
      parentsByChild.get(link.to).push(link.from);
    });

    spousePairs.forEach(([a, b]) => this.drawCoupleBar(a, b, camera));
    parentsByChild.forEach((parents, childId) => this.drawDescent(parents, childId, camera));
    this.drawClusterRails(camera, parentLinks);
  }

  drawCoupleBar(aId, bId, camera) {
    const a = this.surfaceXY(this.positions.get(aId));
    const b = this.surfaceXY(this.positions.get(bId));
    if (!a || !b) return;
    const y = (a.y + b.y) / 2;
    this.drawSurfacePolyline([[a.x, y], [b.x, y]], camera, 1.6, 'rgba(78,52,30,.78)');
  }

  drawDescent(parentIds, childId, camera) {
    const child = this.surfaceXY(this.positions.get(childId));
    const parents = [...new Set(parentIds)].map(id => this.surfaceXY(this.positions.get(id))).filter(Boolean);
    if (!child || !parents.length) return;
    const source = parents.length > 1
      ? { x: (parents[0].x + parents[1].x) / 2, y: (parents[0].y + parents[1].y) / 2 }
      : parents[0];
    const bendY = source.y + (child.y - source.y) * 0.48;
    this.drawSurfacePolyline([[source.x, source.y], [source.x, bendY], [child.x, bendY], [child.x, child.y]], camera, 1.7, 'rgba(78,52,30,.82)');
  }

  drawClusterRails(camera, parentLinks) {
    const hasVisibleParent = new Set(parentLinks.map(link => link.to));
    const groups = new Map();
    this.people.filter(p => p.cluster).forEach(person => {
      if (!groups.has(person.cluster)) groups.set(person.cluster, []);
      groups.get(person.cluster).push(person);
    });
    groups.forEach(group => {
      const orphans = group.filter(person => !hasVisibleParent.has(person.id));
      if (orphans.length < 2) return;
      const points = orphans.map(person => ({ xy: this.surfaceXY(this.positions.get(person.id)) })).filter(item => item.xy);
      if (points.length < 2) return;
      const railY = Math.min(...points.map(item => item.xy.y)) - 0.5;
      const minX = Math.min(...points.map(item => item.xy.x));
      const maxX = Math.max(...points.map(item => item.xy.x));
      this.drawSurfacePolyline([[minX, railY], [maxX, railY]], camera, 1.25, 'rgba(91,64,38,.50)');
      points.forEach(item => this.drawSurfacePolyline([[item.xy.x, railY], [item.xy.x, item.xy.y]], camera, 1.05, 'rgba(91,64,38,.44)'));
    });
  }

  drawSurfacePolyline(xyPoints, camera, width = 0.7, stroke = null) {
    const sampled = [];
    for (let segment = 0; segment < xyPoints.length - 1; segment += 1) {
      const a = xyPoints[segment];
      const b = xyPoints[segment + 1];
      for (let i = 0; i <= 18; i += 1) {
        const t = i / 18;
        const local = tangentPoint(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, RADIUS);
        const unit = rotatePoint(local, this.yaw, this.pitch);
        const q = projectSpherePoint(unit, camera, RADIUS);
        sampled.push(isVisible(unit, q) ? q : null);
      }
    }
    const ctx = this.ctx;
    ctx.save();
    if (stroke) ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    strokeSegments(ctx, sampled);
    ctx.restore();
  }

  surfaceXY(unit) {
    if (!unit) return null;
    const theta = Math.acos(clamp(-unit.z, -1, 1));
    const s = Math.sin(theta);
    if (Math.abs(s) < 1e-7) return { x: 0, y: 0 };
    const d = RADIUS * theta;
    return { x: d * unit.x / s, y: d * unit.y / s };
  }

  drawPeople(camera) {
    const ordered = [];
    this.people.forEach(person => {
      const local = this.positions.get(person.id);
      if (!local) return;
      const unit = rotatePoint(local, this.yaw, this.pitch);
      const projected = projectSpherePoint(unit, camera, RADIUS);
      if (isVisible(unit, projected)) ordered.push({ person, unit, projected });
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
    ctx.globalAlpha = clamp((apparentWidth - 7) / 55, 0.10, 1);
    const a = frame.xAxis.x / (tex.width / 2);
    const b = frame.xAxis.y / (tex.width / 2);
    const c = frame.yAxis.x / (tex.height / 2);
    const d = frame.yAxis.y / (tex.height / 2);
    ctx.setTransform(camera.dpr * a, camera.dpr * b, camera.dpr * c, camera.dpr * d, camera.dpr * frame.center.x, camera.dpr * frame.center.y);
    if (apparentWidth >= 62) ctx.drawImage(tex, -tex.width / 2, -tex.height / 2);
    else drawMiniMedallion(ctx, tex.width, tex.height);
    ctx.restore();
    this.hitAreas.push({ id: person.id, x: frame.center.x, y: frame.center.y, r: Math.max(12, Math.max(xLen, yLen) * 1.35), z: frame.center.z });
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
  g.addColorStop(0, '#c8ad78');
  g.addColorStop(0.35, '#9a7850');
  g.addColorStop(1, '#5d4732');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(248,232,189,.10)';
  for (let i = 0; i < 45; i += 1) {
    const x = hash(i * 19) * w;
    const y = hash(i * 31 + 2) * h * 0.35;
    const r = 30 + hash(i * 11 + 4) * 95;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
}

function drawSphere(ctx, camera, radius) {
  const pr = apparentSphereRadius(camera, radius);
  const g = ctx.createRadialGradient(camera.cx - pr * 0.18, camera.cy - pr * 0.40, pr * 0.08, camera.cx, camera.cy, pr);
  g.addColorStop(0, '#ead49f');
  g.addColorStop(0.52, '#c4a06b');
  g.addColorStop(0.84, '#8e6842');
  g.addColorStop(1, '#4e3827');
  ctx.save();
  ctx.shadowColor = 'rgba(45,29,18,.48)';
  ctx.shadowBlur = 52;
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(camera.cx, camera.cy, pr, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(248,224,166,.55)';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.restore();
}

function drawMiniMedallion(ctx, w, h) {
  const rx = w * 0.17, ry = h * 0.22;
  ctx.fillStyle = '#684728';
  ctx.beginPath(); ctx.ellipse(0, -h * 0.03, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#b58a4c'; ctx.lineWidth = w * 0.011; ctx.stroke();
  const glass = ctx.createRadialGradient(-rx * 0.55, -ry * 0.8, 0, 0, 0, rx * 1.4);
  glass.addColorStop(0, 'rgba(255,250,224,.50)');
  glass.addColorStop(0.25, 'rgba(255,255,255,.10)');
  glass.addColorStop(1, 'rgba(20,12,7,.20)');
  ctx.fillStyle = glass; ctx.fill();
}

function uniquePairs(links) {
  const seen = new Set();
  const out = [];
  links.forEach(link => {
    const key = [link.from, link.to].sort().join('|');
    if (seen.has(key)) return;
    seen.add(key);
    out.push([link.from, link.to]);
  });
  return out;
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

const MAP_PATHS = [
  [[-21,11],[-19,12],[-17,11],[-16,9],[-14,8],[-13,6],[-11,5],[-9,3],[-8,1],[-9,-2],[-7,-4],[-5,-6],[-3,-7],[-2,-10]],
  [[-12,14],[-9,15],[-7,14],[-5,13],[-3,11],[-2,8],[-4,6],[-3,4],[-1,2],[1,1],[3,2],[5,4],[6,6]],
  [[7,13],[9,14],[12,13],[14,11],[15,8],[13,6],[12,4],[14,2],[13,-1],[11,-2],[10,-5],[8,-7],[7,-10]],
  [[5,8],[7,7],[9,5],[8,3],[6,2],[5,0],[4,-2],[3,-4],[1,-5],[-1,-4]],
  [[-18,4],[-16,3],[-15,1],[-13,0],[-12,-2],[-10,-3],[-9,-5]],
  [[-2,12],[0,11],[2,10],[3,8],[2,6],[0,5],[-1,3],[-2,1]],
  [[10,2],[9,0],[8,-2],[7,-3],[6,-5],[5,-7]],
  [[-6,-7],[-4,-9],[-2,-11],[1,-12],[4,-11],[6,-9]],
  [[14,9],[16,8],[18,6],[19,4],[18,2],[17,0]],
];
