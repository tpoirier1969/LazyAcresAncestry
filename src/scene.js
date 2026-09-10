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
import {
  ATLAS_COMPASS,
  ATLAS_DETAIL_PATHS,
  ATLAS_HACHURES,
  ATLAS_ISLANDS,
  ATLAS_LABELS,
  ATLAS_LANDMASSES,
  ATLAS_MOUNTAINS,
  ATLAS_RHUMB_LINES,
  ATLAS_RIVERS,
  ATLAS_SHIP,
} from './atlas-map.js';

const POPULATION = 9099;
const PLAQUE = { width: 1, height: 0.86 };
const RADIUS = Math.max(50, requiredSphereRadius({ count: POPULATION, plaqueWidth: 1, plaqueHeight: 0.75, spacingFactor: 1.8 }));
const HOME_PITCH = 0.15;
const DEFAULT_GAP = 6.2;
const MIN_GAP = 4;
const MAX_GAP = 24;

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
    return {
      cx: w / 2,
      cy: projectedRadius + horizonY,
      focal,
      centerZ,
      near: 0.1,
      dpr,
    };
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
      this.targetYaw = this.drag.yaw - dx * 0.003;
      this.targetPitch = clamp(this.drag.pitch - dy * 0.003, -0.95, 1.25);
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
      this.targetCameraGap = clamp(this.targetCameraGap + Math.sign(event.deltaY) * 1.15, MIN_GAP, MAX_GAP);
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
      this.yaw += yawDelta * 0.24;
      this.pitch += pitchDelta * 0.24;
      this.cameraGap += gapDelta * 0.22;

      const settled = Math.abs(yawDelta) < 0.00035 && Math.abs(pitchDelta) < 0.00035 && Math.abs(gapDelta) < 0.01;
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
      this.yaw = target.yaw;
      this.pitch = target.pitch;
      this.targetYaw = this.yaw;
      this.targetPitch = this.pitch;
      this.requestDraw();
      return;
    }
    const from = { yaw: this.yaw, pitch: this.pitch };
    const start = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - start) / 650);
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
    ctx.lineJoin = 'round';

    ATLAS_LANDMASSES.forEach(path => {
      const points = this.projectMapPath(path, camera, 5);
      fillProjectedPolygon(ctx, points, 'rgba(79,50,25,.075)');
      ctx.strokeStyle = 'rgba(242,218,165,.16)';
      ctx.lineWidth = 3.4;
      strokeSegments(ctx, points);
      ctx.strokeStyle = 'rgba(61,38,20,.58)';
      ctx.lineWidth = 1.18;
      strokeSegments(ctx, points);
    });

    ATLAS_ISLANDS.forEach(path => {
      const points = this.projectMapPath(path, camera, 4);
      fillProjectedPolygon(ctx, points, 'rgba(75,47,24,.09)');
      ctx.strokeStyle = 'rgba(66,41,21,.50)';
      ctx.lineWidth = 0.95;
      strokeSegments(ctx, points);
    });

    ATLAS_DETAIL_PATHS.forEach(path => {
      ctx.strokeStyle = 'rgba(67,42,22,.31)';
      ctx.lineWidth = 0.72;
      strokeSegments(ctx, this.projectMapPath(path, camera, 4));
    });

    ATLAS_RIVERS.forEach(path => {
      ctx.strokeStyle = 'rgba(74,52,35,.34)';
      ctx.lineWidth = 0.78;
      strokeSegments(ctx, this.projectMapPath(path, camera, 5));
    });

    ctx.setLineDash([5, 6]);
    ATLAS_RHUMB_LINES.forEach(path => {
      ctx.strokeStyle = 'rgba(64,41,23,.20)';
      ctx.lineWidth = 0.72;
      strokeSegments(ctx, this.projectMapPath(path, camera, 4));
    });
    ctx.setLineDash([]);

    ATLAS_HACHURES.forEach(path => {
      ctx.strokeStyle = 'rgba(73,45,23,.28)';
      ctx.lineWidth = 0.68;
      strokeSegments(ctx, this.projectMapPath(path, camera, 3));
    });

    ATLAS_MOUNTAINS.forEach(mountain => this.drawMountain(mountain, camera));
    this.drawCompassRose(ATLAS_COMPASS, camera);
    this.drawShip(ATLAS_SHIP, camera);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(58,37,21,.46)';
    ATLAS_LABELS.forEach(label => {
      const projected = this.projectAtlasPoint(label.x, label.y, camera);
      if (!projected) return;
      ctx.save();
      ctx.translate(projected.x, projected.y);
      ctx.rotate(label.rotation || 0);
      ctx.font = `italic ${label.size || 12}px Georgia, serif`;
      ctx.fillText(label.text, 0, 0);
      ctx.restore();
    });
    ctx.restore();
  }

  projectMapPath(path, camera, samplesPerSegment = 4) {
    const moving = Boolean(this.drag || this.motionFrame || this.focusFrame);
    const samples = moving ? Math.max(2, samplesPerSegment - 2) : samplesPerSegment;
    const sampled = [];
    for (let segment = 0; segment < path.length - 1; segment += 1) {
      const a = path[segment];
      const b = path[segment + 1];
      for (let i = 0; i <= samples; i += 1) {
        if (segment > 0 && i === 0) continue;
        const t = i / samples;
        const point = this.projectAtlasPoint(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, camera);
        sampled.push(point);
      }
    }
    return sampled;
  }

  projectAtlasPoint(x, y, camera) {
    const local = tangentPoint(x, y, RADIUS);
    const unit = rotatePoint(local, this.yaw, this.pitch);
    const projected = projectSpherePoint(unit, camera, RADIUS);
    return isVisible(unit, projected) ? projected : null;
  }

  drawMountain({ x, y, size }, camera) {
    const stroke = 'rgba(66,41,22,.34)';
    this.drawSurfacePolyline([[x - size, y - size * .30], [x, y + size], [x + size, y - size * .30]], camera, 0.66, stroke);
    this.drawSurfacePolyline([[x - size * .44, y + size * .16], [x, y + size * .58], [x + size * .40, y + size * .10]], camera, 0.52, stroke);
  }

  drawCompassRose({ x, y, size }, camera) {
    const ring = [];
    for (let i = 0; i <= 32; i += 1) {
      const angle = Math.PI * 2 * i / 32;
      ring.push([x + Math.cos(angle) * size * .72, y + Math.sin(angle) * size * .72]);
    }
    this.drawSurfacePolyline(ring, camera, 0.72, 'rgba(61,38,20,.42)');
    for (let i = 0; i < 8; i += 1) {
      const angle = Math.PI * 2 * i / 8;
      const length = size * (i % 2 ? .52 : .95);
      this.drawSurfacePolyline([[x, y], [x + Math.cos(angle) * length, y + Math.sin(angle) * length]], camera, i % 2 ? 0.55 : 0.82, 'rgba(61,38,20,.48)');
    }
    const labels = [
      ['N', x, y + size * 1.18], ['E', x + size * 1.18, y], ['S', x, y - size * 1.18], ['W', x - size * 1.18, y],
    ];
    const ctx = this.ctx;
    ctx.save();
    ctx.font = 'italic 10px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(58,37,21,.48)';
    labels.forEach(([text, px, py]) => {
      const point = this.projectAtlasPoint(px, py, camera);
      if (point) ctx.fillText(text, point.x, point.y);
    });
    ctx.restore();
  }

  drawShip({ x, y, size }, camera) {
    const ink = 'rgba(61,38,20,.40)';
    this.drawSurfacePolyline([[x - size, y - .15 * size], [x - .62 * size, y - .55 * size], [x + .72 * size, y - .55 * size], [x + size, y - .12 * size], [x - size, y - .15 * size]], camera, 0.76, ink);
    this.drawSurfacePolyline([[x, y - .5 * size], [x, y + .95 * size]], camera, 0.72, ink);
    this.drawSurfacePolyline([[x, y + .78 * size], [x - .68 * size, y + .08 * size], [x, y + .08 * size]], camera, 0.66, ink);
    this.drawSurfacePolyline([[x + .08 * size, y + .66 * size], [x + .72 * size, y + .04 * size], [x + .08 * size, y + .04 * size]], camera, 0.66, ink);
    this.drawSurfacePolyline([[x - 1.15 * size, y - .78 * size], [x - .55 * size, y - .70 * size], [x, y - .78 * size], [x + .6 * size, y - .70 * size], [x + 1.15 * size, y - .78 * size]], camera, 0.48, 'rgba(61,38,20,.26)');
  }

  drawGrid(camera) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(91,61,36,.12)';
    ctx.lineWidth = 0.62;
    for (let x = -24; x <= 24; x += 4) this.drawSurfacePolyline([[x, -20], [x, 20]], camera);
    for (let y = -20; y <= 20; y += 4) this.drawSurfacePolyline([[-26, y], [26, y]], camera);
    ctx.restore();
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
    children.forEach(child => {
      this.drawSurfacePolyline([[child.x, railY], [child.x, child.y]], camera, 1.48, 'rgba(63,39,22,.82)');
    });
  }

  drawSurfacePolyline(xyPoints, camera, width = 0.7, stroke = null) {
    const sampled = [];
    const steps = this.drag || this.motionFrame || this.focusFrame ? 10 : 16;
    for (let segment = 0; segment < xyPoints.length - 1; segment += 1) {
      const a = xyPoints[segment];
      const b = xyPoints[segment + 1];
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
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
    ctx.globalAlpha = clamp((apparentWidth - 7) / 48, 0.13, 1);
    const a = frame.xAxis.x / (tex.width / 2);
    const b = frame.xAxis.y / (tex.width / 2);
    const c = frame.yAxis.x / (tex.height / 2);
    const d = frame.yAxis.y / (tex.height / 2);
    ctx.setTransform(camera.dpr * a, camera.dpr * b, camera.dpr * c, camera.dpr * d, camera.dpr * frame.center.x, camera.dpr * frame.center.y);
    if (apparentWidth >= 44) ctx.drawImage(tex, -tex.width / 2, -tex.height / 2);
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
    parentSets: [...groupedChildren.values()].map(group => ({
      parents: group.parents,
      children: [...new Set(group.children)].sort(),
    })),
  };
}

function drawBackdrop(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#cdb586');
  g.addColorStop(0.34, '#a8875d');
  g.addColorStop(1, '#5c4631');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = '#f1deb1';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 30; i += 1) {
    const y = hash(i * 31 + 5) * Math.min(h * 0.30, 250);
    const x = hash(i * 17 + 9) * w;
    const len = 24 + hash(i * 23 + 4) * 90;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(Math.min(w, x + len), y + (hash(i * 13 + 7) - 0.5) * 7);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSphere(ctx, camera, radius) {
  const pr = apparentSphereRadius(camera, radius);
  const g = ctx.createRadialGradient(camera.cx - pr * 0.15, camera.cy - pr * 0.34, pr * 0.08, camera.cx, camera.cy, pr);
  g.addColorStop(0, '#f0dcad');
  g.addColorStop(0.52, '#d5b47b');
  g.addColorStop(0.83, '#987148');
  g.addColorStop(1, '#503a28');
  ctx.save();
  ctx.shadowColor = 'rgba(45,29,18,.42)';
  ctx.shadowBlur = 46;
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(camera.cx, camera.cy, pr, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(248,224,166,.64)';
  ctx.lineWidth = 2.0;
  ctx.stroke();
  ctx.restore();
}

function drawMiniMedallion(ctx, w, h) {
  const rx = w * 0.18, ry = h * 0.235;
  ctx.fillStyle = '#684728';
  ctx.beginPath(); ctx.ellipse(0, -h * 0.035, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#c69a4b'; ctx.lineWidth = w * 0.012; ctx.stroke();
  const glass = ctx.createRadialGradient(-rx * 0.55, -ry * 0.78, 0, 0, 0, rx * 1.42);
  glass.addColorStop(0, 'rgba(255,253,231,.62)');
  glass.addColorStop(0.23, 'rgba(255,255,255,.13)');
  glass.addColorStop(0.72, 'rgba(255,255,255,.015)');
  glass.addColorStop(1, 'rgba(20,12,7,.30)');
  ctx.fillStyle = glass; ctx.fill();
  ctx.strokeStyle = 'rgba(255,248,222,.50)';
  ctx.lineWidth = w * 0.004;
  ctx.beginPath();
  ctx.ellipse(-rx * 0.12, -ry * 0.16, rx * 0.62, ry * 0.68, -0.16, Math.PI * 1.08, Math.PI * 1.58);
  ctx.stroke();
}

function fillProjectedPolygon(ctx, points, fillStyle) {
  if (!points.length || points.some(point => !point)) return;
  ctx.save();
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
  ctx.closePath();
  ctx.fill();
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

function shortestAngle(from, to) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function hash(value) { const x = Math.sin(value * 12.9898) * 43758.5453; return x - Math.floor(x); }
