import {
  apparentSphereRadius,
  isVisible,
  projectSpherePoint,
  requiredSphereRadius,
  rotatePoint,
  tangentPoint,
  yawPitchToFront,
} from './geometry.js';
import { plaqueTexture } from './plaque.js';
import { layoutSample } from './layout.js';
import { getAtlasTexture } from './atlas-map.js';
import { atlasUnitFromUv, drawTexturedTriangle } from './sphere-texture.js';

const POPULATION = 9099;
const PLAQUE = { width: 0.96, height: 0.84 };
const RADIUS = Math.max(120, requiredSphereRadius({ count: POPULATION, plaqueWidth: 1, plaqueHeight: 0.75, spacingFactor: 1.8 }));
const HOME_PITCH = 0.14;
const DEFAULT_GAP = 7.2;
const MIN_GAP = 4.8;
const MAX_GAP = 27;
const PLAQUE_TOP_LIFT = 0.09;

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
    this.targetYaw = this.yaw;
    this.targetPitch = this.pitch;
    this.targetCameraGap = this.cameraGap;
    this.drag = null;
    this.needsDraw = false;
    this.motionFrame = null;
    this.focusFrame = null;
    this.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.atlasTexture = getAtlasTexture(() => this.requestDraw());
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
    const focal = Math.min(w, h) * 1.04;
    const centerZ = RADIUS + this.cameraGap;
    const projectedRadius = focal * RADIUS / Math.sqrt(Math.max(1e-6, centerZ * centerZ - RADIUS * RADIUS));
    const horizonY = Math.max(42, h * 0.06);
    return { cx: w / 2, cy: projectedRadius + horizonY, focal, centerZ, near: 0.1, dpr };
  }

  bind() {
    this.canvas.addEventListener('pointerdown', event => {
      this.cancelFocus();
      this.stopMotion();
      this.canvas.setPointerCapture(event.pointerId);
      this.drag = { x: event.clientX, y: event.clientY, yaw: this.yaw, pitch: this.pitch, moved: false };
    });
    this.canvas.addEventListener('pointermove', event => {
      if (!this.drag) return;
      const dx = event.clientX - this.drag.x;
      const dy = event.clientY - this.drag.y;
      if (Math.hypot(dx, dy) > 3) this.drag.moved = true;
      this.targetYaw = this.drag.yaw - dx * 0.00255;
      this.targetPitch = clamp(this.drag.pitch - dy * 0.00255, -1.08, 1.08);
      if (this.reduceMotion) {
        this.yaw = this.targetYaw;
        this.pitch = this.targetPitch;
        this.requestDraw();
      } else {
        this.requestMotion();
      }
    });
    this.canvas.addEventListener('pointerup', event => {
      if (!this.drag?.moved) this.pick(event.offsetX, event.offsetY);
      this.drag = null;
    });
    this.canvas.addEventListener('pointercancel', () => { this.drag = null; });
    this.canvas.addEventListener('wheel', event => {
      event.preventDefault();
      this.targetCameraGap = clamp(this.targetCameraGap + Math.sign(event.deltaY) * 0.76, MIN_GAP, MAX_GAP);
      if (this.reduceMotion) {
        this.cameraGap = this.targetCameraGap;
        this.requestDraw();
      } else {
        this.requestMotion();
      }
    }, { passive: false });
  }

  requestMotion() {
    if (this.motionFrame) return;
    const tick = () => {
      const yawDelta = shortestAngle(this.yaw, this.targetYaw);
      const pitchDelta = this.targetPitch - this.pitch;
      const gapDelta = this.targetCameraGap - this.cameraGap;
      this.yaw += yawDelta * 0.18;
      this.pitch += pitchDelta * 0.18;
      this.cameraGap += gapDelta * 0.16;
      const settled = Math.abs(yawDelta) < 0.00028 && Math.abs(pitchDelta) < 0.00028 && Math.abs(gapDelta) < 0.007;
      if (settled) {
        this.yaw = this.targetYaw;
        this.pitch = this.targetPitch;
        this.cameraGap = this.targetCameraGap;
        this.motionFrame = null;
        this.requestDraw();
        return;
      }
      this.requestDraw();
      this.motionFrame = requestAnimationFrame(tick);
    };
    this.motionFrame = requestAnimationFrame(tick);
  }

  stopMotion() {
    if (this.motionFrame) cancelAnimationFrame(this.motionFrame);
    this.motionFrame = null;
    this.targetYaw = this.yaw;
    this.targetPitch = this.pitch;
    this.targetCameraGap = this.cameraGap;
  }

  cancelFocus() {
    if (this.focusFrame) cancelAnimationFrame(this.focusFrame);
    this.focusFrame = null;
  }

  focus(id, { resetZoom = false } = {}) {
    const local = this.positions.get(id);
    if (!local) return;
    this.stopMotion();
    this.cancelFocus();
    if (resetZoom) {
      this.cameraGap = DEFAULT_GAP;
      this.targetCameraGap = DEFAULT_GAP;
    }
    const target = yawPitchToFront(local);
    target.pitch += HOME_PITCH;
    if (this.reduceMotion) {
      this.yaw = this.targetYaw = target.yaw;
      this.pitch = this.targetPitch = target.pitch;
      this.requestDraw();
      return;
    }
    const from = { yaw: this.yaw, pitch: this.pitch };
    const start = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - start) / 760);
      const eased = t * t * (3 - 2 * t);
      this.yaw = from.yaw + shortestAngle(from.yaw, target.yaw) * eased;
      this.pitch = from.pitch + (target.pitch - from.pitch) * eased;
      this.targetYaw = this.yaw;
      this.targetPitch = this.pitch;
      this.requestDraw();
      if (t < 1) this.focusFrame = requestAnimationFrame(tick);
      else this.focusFrame = null;
    };
    this.focusFrame = requestAnimationFrame(tick);
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
    drawSphereBase(ctx, camera, RADIUS);
    this.drawMapTexture(camera);
    drawSphereShade(ctx, camera, RADIUS);
    this.drawRelationships(camera);
    this.drawPeople(camera);
  }

  drawMapTexture(camera) {
    const image = this.atlasTexture;
    if (!image?.complete || !image.naturalWidth) return;
    const moving = Boolean(this.drag || this.motionFrame || this.focusFrame);
    const columns = moving ? 34 : 64;
    const rows = moving ? 17 : 32;
    const iw = image.naturalWidth;
    const ih = image.naturalHeight;
    const ctx = this.ctx;
    const pr = apparentSphereRadius(camera, RADIUS);

    ctx.save();
    ctx.beginPath();
    ctx.arc(camera.cx, camera.cy, pr - 0.5, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = 0.80;
    ctx.globalCompositeOperation = 'multiply';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    for (let row = 0; row < rows; row += 1) {
      const v0 = row / rows;
      const v1 = (row + 1) / rows;
      const sy0 = v0 * ih;
      const sy1 = v1 * ih;
      for (let col = 0; col < columns; col += 1) {
        const u0 = col / columns;
        const u1 = (col + 1) / columns;
        const sx0 = u0 * iw;
        const sx1 = u1 * iw;
        const centerUnit = rotatePoint(atlasUnitFromUv((u0 + u1) / 2, (v0 + v1) / 2), this.yaw, this.pitch);
        const centerProjected = projectSpherePoint(centerUnit, camera, RADIUS);
        if (!isVisible(centerUnit, centerProjected)) continue;

        const p00 = this.projectAtlasUv(u0, v0, camera);
        const p10 = this.projectAtlasUv(u1, v0, camera);
        const p11 = this.projectAtlasUv(u1, v1, camera);
        const p01 = this.projectAtlasUv(u0, v1, camera);
        if (!p00 || !p10 || !p11 || !p01) continue;

        const sourceBounds = { sx: sx0, sy: sy0, sw: sx1 - sx0, sh: sy1 - sy0 };
        drawTexturedTriangle(ctx, image,
          [{ x: sx0, y: sy0 }, { x: sx1, y: sy0 }, { x: sx1, y: sy1 }],
          [p00, p10, p11], sourceBounds);
        drawTexturedTriangle(ctx, image,
          [{ x: sx0, y: sy0 }, { x: sx1, y: sy1 }, { x: sx0, y: sy1 }],
          [p00, p11, p01], sourceBounds);
      }
    }
    ctx.restore();
  }

  projectAtlasUv(u, v, camera) {
    const unit = rotatePoint(atlasUnitFromUv(u, v), this.yaw, this.pitch);
    return projectSpherePoint(unit, camera, RADIUS);
  }

  drawRelationships(camera) {
    const knownIds = new Set(this.positions.keys());
    const { spousePairs, parentSets } = buildRelationshipGroups(this.relationships, knownIds);
    spousePairs.forEach(([a, b]) => this.drawCoupleBar(a, b, camera));
    parentSets.forEach(group => {
      if (group.children.length > 1) this.drawSiblingGroup(group.parents, group.children, camera);
      else this.drawDescent(group.parents, group.children[0], camera);
    });
  }

  drawCoupleBar(aId, bId, camera) {
    const a = this.surfaceXY(this.positions.get(aId));
    const b = this.surfaceXY(this.positions.get(bId));
    if (!a || !b) return;
    const y = (a.y + b.y) / 2;
    this.drawSurfacePolyline([[a.x, y], [b.x, y]], camera, 1.65, 'rgba(63,39,22,.88)');
  }

  drawDescent(parentIds, childId, camera) {
    if (!childId) return;
    const child = this.surfaceXY(this.positions.get(childId));
    const parents = parentIds.map(id => this.surfaceXY(this.positions.get(id))).filter(Boolean);
    if (!child || !parents.length) return;
    const source = averagePoint(parents);
    const bendY = source.y + (child.y - source.y) * 0.48;
    this.drawSurfacePolyline([[source.x, source.y], [source.x, bendY], [child.x, bendY], [child.x, child.y]], camera, 1.78, 'rgba(63,39,22,.90)');
  }

  drawSiblingGroup(parentIds, childIds, camera) {
    const parents = parentIds.map(id => this.surfaceXY(this.positions.get(id))).filter(Boolean);
    const children = childIds.map(id => this.surfaceXY(this.positions.get(id))).filter(Boolean);
    if (!parents.length || children.length < 2) return;
    const source = averagePoint(parents);
    const averageChildY = children.reduce((sum, point) => sum + point.y, 0) / children.length;
    const railY = source.y + (averageChildY - source.y) * 0.48;
    const minX = Math.min(...children.map(point => point.x));
    const maxX = Math.max(...children.map(point => point.x));
    this.drawSurfacePolyline([[source.x, source.y], [source.x, railY]], camera, 1.78, 'rgba(63,39,22,.90)');
    this.drawSurfacePolyline([[minX, railY], [maxX, railY]], camera, 1.62, 'rgba(63,39,22,.86)');
    children.forEach(child => this.drawSurfacePolyline([[child.x, railY], [child.x, child.y]], camera, 1.48, 'rgba(63,39,22,.82)'));
  }

  drawSurfacePolyline(xyPoints, camera, width = 0.7, stroke = null) {
    const sampled = [];
    const steps = this.drag || this.motionFrame || this.focusFrame ? 8 : 14;
    for (let segment = 0; segment < xyPoints.length - 1; segment += 1) {
      const a = xyPoints[segment];
      const b = xyPoints[segment + 1];
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const local = tangentPoint(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, RADIUS);
        const unit = rotatePoint(local, this.yaw, this.pitch);
        const q = projectSpherePoint(unit, camera, RADIUS + 0.012);
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
      if (isVisible(unit, projected)) ordered.push({ person, local, projected });
    });
    ordered.sort((a, b) => b.projected.z - a.projected.z);
    this.hitAreas = [];
    ordered.forEach(entry => this.drawPlaque(entry, camera));
  }

  drawPlaque({ person, local, projected }, camera) {
    const centerXY = this.surfaceXY(local);
    if (!centerXY) return;
    const tex = plaqueTexture(person);
    const left = this.projectPlaqueVertex(centerXY, 0, 0.5, camera);
    const right = this.projectPlaqueVertex(centerXY, 1, 0.5, camera);
    const top = this.projectPlaqueVertex(centerXY, 0.5, 0, camera);
    const bottom = this.projectPlaqueVertex(centerXY, 0.5, 1, camera);
    if (!left || !right || !top || !bottom) return;
    const apparentWidth = Math.hypot(right.x - left.x, right.y - left.y);
    const apparentHeight = Math.hypot(bottom.x - top.x, bottom.y - top.y);
    if (apparentWidth < 7 || apparentHeight < 5) return;

    const moving = Boolean(this.drag || this.motionFrame || this.focusFrame);
    const cols = moving ? 2 : 4;
    const rows = moving ? 3 : 5;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = clamp((apparentWidth - 5) / 34, 0.22, 1);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    for (let row = 0; row < rows; row += 1) {
      const v0 = row / rows;
      const v1 = (row + 1) / rows;
      const sy0 = v0 * tex.height;
      const sy1 = v1 * tex.height;
      for (let col = 0; col < cols; col += 1) {
        const u0 = col / cols;
        const u1 = (col + 1) / cols;
        const sx0 = u0 * tex.width;
        const sx1 = u1 * tex.width;
        const p00 = this.projectPlaqueVertex(centerXY, u0, v0, camera);
        const p10 = this.projectPlaqueVertex(centerXY, u1, v0, camera);
        const p11 = this.projectPlaqueVertex(centerXY, u1, v1, camera);
        const p01 = this.projectPlaqueVertex(centerXY, u0, v1, camera);
        if (!p00 || !p10 || !p11 || !p01) continue;
        const bounds = { sx: sx0, sy: sy0, sw: sx1 - sx0, sh: sy1 - sy0 };
        drawTexturedTriangle(ctx, tex,
          [{ x: sx0, y: sy0 }, { x: sx1, y: sy0 }, { x: sx1, y: sy1 }],
          [p00, p10, p11], bounds);
        drawTexturedTriangle(ctx, tex,
          [{ x: sx0, y: sy0 }, { x: sx1, y: sy1 }, { x: sx0, y: sy1 }],
          [p00, p11, p01], bounds);
      }
    }
    ctx.restore();

    this.hitAreas.push({ id: person.id, x: projected.x, y: projected.y, r: Math.max(12, Math.max(apparentWidth, apparentHeight) * 0.58), z: projected.z });
  }

  projectPlaqueVertex(centerXY, u, v, camera) {
    const x = centerXY.x + (u - 0.5) * PLAQUE.width;
    const y = centerXY.y + (0.5 - v) * PLAQUE.height;
    const local = tangentPoint(x, y, RADIUS);
    const unit = rotatePoint(local, this.yaw, this.pitch);
    const topFraction = clamp((0.22 - v) / 0.22, 0, 1);
    const lift = PLAQUE_TOP_LIFT * topFraction * topFraction;
    const projected = projectSpherePoint(unit, camera, RADIUS + lift);
    return isVisible(unit, projected) ? projected : null;
  }

  pick(x, y) {
    const candidates = this.hitAreas.filter(hit => Math.hypot(x - hit.x, y - hit.y) <= hit.r);
    if (!candidates.length) return;
    candidates.sort((a, b) => a.z - b.z);
    this.onSelect?.(candidates[0].id);
  }
}

export function buildRelationshipGroups(relationships, knownIds = null) {
  const isKnown = id => Boolean(id) && (!knownIds || knownIds.has(id));
  const parentLinks = relationships.filter(link => link.type === 'parent' && isKnown(link.from) && isKnown(link.to));
  const spousePairs = uniquePairs(relationships.filter(link => link.type === 'spouse' && isKnown(link.from) && isKnown(link.to)));
  const parentsByChild = new Map();
  parentLinks.forEach(link => {
    if (!parentsByChild.has(link.to)) parentsByChild.set(link.to, new Set());
    parentsByChild.get(link.to).add(link.from);
  });
  const groupedChildren = new Map();
  parentsByChild.forEach((parents, childId) => {
    const parentIds = [...parents].sort();
    const key = parentIds.join('|');
    if (!groupedChildren.has(key)) groupedChildren.set(key, { parents: parentIds, children: [] });
    groupedChildren.get(key).children.push(childId);
  });
  return { spousePairs, parentSets: [...groupedChildren.values()].map(group => ({ parents: group.parents, children: [...new Set(group.children)].sort() })) };
}

function drawBackdrop(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#cdb586');
  g.addColorStop(0.34, '#a8875d');
  g.addColorStop(1, '#5c4631');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
function drawSphereBase(ctx, camera, radius) {
  const pr = apparentSphereRadius(camera, radius);
  ctx.save(); ctx.shadowColor = 'rgba(45,29,18,.42)'; ctx.shadowBlur = 46; ctx.fillStyle = '#dec48d';
  ctx.beginPath(); ctx.arc(camera.cx, camera.cy, pr, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
function drawSphereShade(ctx, camera, radius) {
  const pr = apparentSphereRadius(camera, radius);
  const g = ctx.createRadialGradient(camera.cx - pr * 0.10, camera.cy - pr * 0.28, pr * 0.10, camera.cx, camera.cy, pr);
  g.addColorStop(0, 'rgba(255,244,207,.15)'); g.addColorStop(0.60, 'rgba(106,71,39,.035)'); g.addColorStop(0.84, 'rgba(78,49,28,.22)'); g.addColorStop(1, 'rgba(41,27,18,.64)');
  ctx.save(); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(camera.cx, camera.cy, pr, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(248,224,166,.72)'; ctx.lineWidth = 2.0; ctx.stroke(); ctx.restore();
}
function uniquePairs(links) { const seen = new Set(); const out = []; links.forEach(link => { const key = [link.from, link.to].sort().join('|'); if (seen.has(key)) return; seen.add(key); out.push([link.from, link.to]); }); return out; }
function averagePoint(points) { return { x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length }; }
function strokeSegments(ctx, points) { ctx.beginPath(); let active = false; points.forEach(point => { if (!point) { active = false; return; } if (!active) { ctx.moveTo(point.x, point.y); active = true; } else ctx.lineTo(point.x, point.y); }); ctx.stroke(); }
function shortestAngle(from, to) { let diff = (to - from) % (Math.PI * 2); if (diff > Math.PI) diff -= Math.PI * 2; if (diff < -Math.PI) diff += Math.PI * 2; return diff; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
