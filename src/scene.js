import {
  apparentSphereRadius,
  isVisible,
  projectSpherePoint,
  projectedRaisedFrame,
  requiredSphereRadius,
  rotatePoint,
  tangentPoint,
  yawPitchToFront,
} from './geometry.js';
import { plaqueTexture } from './plaque.js';
import { rigidPlaquePlacement } from './plaque-projection.js';
import { layoutSample } from './layout.js';
import { ATLAS_TEXTURE_URL } from './atlas-map.js';
import { GlobeWebGLRenderer } from './globe-webgl.js';

const POPULATION = 9099;
const PLAQUE = { width: 1.20, height: 1.08 };
const RADIUS = Math.max(150, requiredSphereRadius({ count: POPULATION, plaqueWidth: 1, plaqueHeight: 0.75, spacingFactor: 1.8 }));
const HOME_PITCH = 0.14;
const DEFAULT_GAP = 7.2;
const MIN_GAP = 3.8;
const MAX_GAP = 120;
const RELATIONSHIP_COLORS = Object.freeze({
  couple: 'rgba(119,55,47,.97)',
  descent: 'rgba(132,62,52,.97)',
  rail: 'rgba(143,70,58,.94)',
  stem: 'rgba(151,78,64,.92)',
  halo: 'rgba(247,225,190,.50)',
});

export class GlobeScene {
  constructor(canvas, onSelect) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mapCanvas = document.getElementById('mapCanvas');
    this.globeRenderer = this.mapCanvas
      ? new GlobeWebGLRenderer(this.mapCanvas, ATLAS_TEXTURE_URL, () => this.requestDraw())
      : null;
    this.onSelect = onSelect;
    this.people = [];
    this.relationships = [];
    this.positions = new Map();
    this.hitAreas = [];
    this.yaw = 0;
    this.pitch = 0;
    this.cameraGap = DEFAULT_GAP;
    this.targetYaw = this.yaw;
    this.targetPitch = this.pitch;
    this.targetCameraGap = this.cameraGap;
    this.drag = null;
    this.needsDraw = false;
    this.motionFrame = null;
    this.focusFrame = null;
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
    this.globeRenderer?.resize(rect.width, rect.height, dpr);
    this.requestDraw();
  }

  camera() {
    const dpr = Number(this.canvas.dataset.dpr || 1);
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;
    const focal = Math.min(w, h) * 1.04;
    const centerZ = RADIUS + this.cameraGap;
    const projectedRadius = focal * RADIUS / Math.sqrt(Math.max(1e-6, centerZ * centerZ - RADIUS * RADIUS));
    const zoomT = smoothstep01(normalizedZoom(this.cameraGap));

    // Close views look almost straight down at the focused family patch.
    // As the camera pulls back, the view eases toward the horizon so more of
    // the globe becomes visible instead of keeping the same grazing angle.
    const closeCenterY = h * 0.56;
    const horizonY = Math.max(40, h * 0.055);
    const wideCenterY = projectedRadius + horizonY;
    const cy = lerp(closeCenterY, wideCenterY, zoomT);

    return { cx: w / 2, cy, focal, centerZ, near: 0.1, dpr, zoomT };
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
      this.targetYaw = this.drag.yaw - dx * 0.00165;
      this.targetPitch = clamp(this.drag.pitch - dy * 0.00165, -1.08, 1.08);
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
      const direction = Math.sign(event.deltaY);
      if (!direction) return;
      this.targetCameraGap = clamp(
        this.targetCameraGap * Math.exp(direction * 0.13),
        MIN_GAP,
        MAX_GAP,
      );
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
      this.yaw += yawDelta * 0.13;
      this.pitch += pitchDelta * 0.13;
      this.cameraGap += gapDelta * 0.14;
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
    target.pitch += HOME_PITCH * smoothstep01(normalizedZoom(this.cameraGap));
    if (this.reduceMotion) {
      this.yaw = this.targetYaw = target.yaw;
      this.pitch = this.targetPitch = target.pitch;
      this.requestDraw();
      return;
    }
    const from = { yaw: this.yaw, pitch: this.pitch };
    const start = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - start) / 1050);
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

    const globeDrawn = this.globeRenderer?.render(camera, this.yaw, this.pitch, RADIUS);
    if (!globeDrawn) drawSphereBase(ctx, camera, RADIUS);
    drawSphereShade(ctx, camera, RADIUS);
    this.drawRelationships(camera);
    this.drawPeople(camera);
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
    this.drawSurfacePolyline([[a.x, y], [b.x, y]], camera, 1.85, RELATIONSHIP_COLORS.couple);
  }

  drawDescent(parentIds, childId, camera) {
    if (!childId) return;
    const child = this.surfaceXY(this.positions.get(childId));
    const parents = parentIds.map(id => this.surfaceXY(this.positions.get(id))).filter(Boolean);
    if (!child || !parents.length) return;
    const source = averagePoint(parents);
    const bendY = source.y + (child.y - source.y) * 0.48;
    this.drawSurfacePolyline(
      [[source.x, source.y], [source.x, bendY], [child.x, bendY], [child.x, child.y]],
      camera,
      1.95,
      RELATIONSHIP_COLORS.descent,
    );
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
    this.drawSurfacePolyline([[source.x, source.y], [source.x, railY]], camera, 1.95, RELATIONSHIP_COLORS.descent);
    this.drawSurfacePolyline([[minX, railY], [maxX, railY]], camera, 1.80, RELATIONSHIP_COLORS.rail);
    children.forEach(child => this.drawSurfacePolyline(
      [[child.x, railY], [child.x, child.y]],
      camera,
      1.66,
      RELATIONSHIP_COLORS.stem,
    ));
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
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = RELATIONSHIP_COLORS.halo;
    ctx.lineWidth = width + 1.35;
    strokeSegments(ctx, sampled);
    ctx.strokeStyle = stroke || RELATIONSHIP_COLORS.descent;
    ctx.lineWidth = width;
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

  drawPlaque({ person, unit, projected }, camera) {
    const cameraFacing = lerp(0.22, 0.38, camera.zoomT || 0);
    const frame = projectedRaisedFrame(
      unit,
      camera,
      RADIUS,
      PLAQUE.width,
      PLAQUE.height,
      cameraFacing,
    );
    if (!frame) return;

    const tex = plaqueTexture(person);
    const placement = rigidPlaquePlacement(frame, tex.width, tex.height);
    if (!placement) return;
    const apparentWidth = placement.width;
    const apparentHeight = placement.height;
    if (apparentWidth < 8 || apparentHeight < 3) return;

    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = clamp((apparentWidth - 6) / 34, 0.28, 1);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.transform(
      placement.a,
      placement.b,
      placement.c,
      placement.d,
      placement.e,
      placement.f,
    );
    ctx.drawImage(tex, -tex.width / 2, -tex.height / 2);
    ctx.restore();

    this.hitAreas.push({
      id: person.id,
      x: placement.center.x,
      y: placement.center.y,
      r: Math.max(13, Math.max(apparentWidth, apparentHeight) * 0.56),
      z: projected.z,
    });
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
  return {
    spousePairs,
    parentSets: [...groupedChildren.values()].map(group => ({ parents: group.parents, children: [...new Set(group.children)].sort() })),
  };
}

function drawSphereBase(ctx, camera, radius) {
  const pr = apparentSphereRadius(camera, radius);
  ctx.save();
  ctx.shadowColor = 'rgba(45,29,18,.42)';
  ctx.shadowBlur = 46;
  ctx.fillStyle = '#dec48d';
  ctx.beginPath();
  ctx.arc(camera.cx, camera.cy, pr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSphereShade(ctx, camera, radius) {
  const pr = apparentSphereRadius(camera, radius);
  const g = ctx.createRadialGradient(camera.cx - pr * 0.10, camera.cy - pr * 0.28, pr * 0.10, camera.cx, camera.cy, pr);
  g.addColorStop(0, 'rgba(255,244,207,.06)');
  g.addColorStop(0.64, 'rgba(106,71,39,.015)');
  g.addColorStop(0.86, 'rgba(78,49,28,.10)');
  g.addColorStop(1, 'rgba(41,27,18,.34)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(camera.cx, camera.cy, pr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(248,224,166,.70)';
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.restore();
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

function averagePoint(points) {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
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

function normalizedZoom(gap) {
  return clamp((gap - MIN_GAP) / (MAX_GAP - MIN_GAP), 0, 1);
}

function smoothstep01(value) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function shortestAngle(from, to) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
