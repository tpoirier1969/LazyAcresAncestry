import {
  apparentSphereRadius,
  isVisible,
  projectedSphereVerticalBounds,
  projectSpherePoint,
  projectedTangentFrame,
  requiredSphereRadius,
  rotatePoint,
  tangentPoint,
  yawPitchToFront,
} from './geometry.js';
import { cameraBehavior } from './camera-behavior.js';
import { plaqueTexture } from './plaque.js';
import { rigidPlaquePlacement } from './plaque-projection.js';
import { layoutSample } from './layout.js';
import { ATLAS_TEXTURE_URL } from './atlas-map.js';
import { GlobeWebGLRenderer } from './globe-webgl.js';

const POPULATION = 9099;
const PLAQUE = { width: 1.20, height: 1.08 };
const RADIUS = Math.max(225, requiredSphereRadius({
  count: POPULATION,
  plaqueWidth: 1,
  plaqueHeight: 0.75,
  spacingFactor: 1.8,
}));
const DEFAULT_GAP = 7.2;
const MIN_GAP = 3.8;
const OVERVIEW_GAP = 155;
const ABSOLUTE_MAX_GAP = 520;
const RELATIONSHIP_COLORS = Object.freeze({
  couple: 'rgba(119,55,47,.97)',
  descent: 'rgba(132,62,52,.97)',
  rail: 'rgba(143,70,58,.94)',
  stem: 'rgba(151,78,64,.92)',
  cluster: 'rgba(151,78,64,.82)',
  halo: 'rgba(247,225,190,.50)',
  shadow: 'rgba(43,28,20,.42)',
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
    this.homeId = null;
    this.focusedId = null;
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
    this.homeId = people.find(person => person.role === 'root')?.id || people[0]?.id || null;
    this.positions = layoutSample(people, RADIUS, relationships);
    this.requestDraw();
  }

  get radius() { return RADIUS; }
  get diameter() { return RADIUS * 2; }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 3);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.canvas.dataset.dpr = String(dpr);
    this.globeRenderer?.resize(rect.width, rect.height, dpr);
    this.requestDraw();
  }

  cameraAt(gap) {
    const dpr = Number(this.canvas.dataset.dpr || 1);
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;
    const focal = Math.min(w, h) * 1.04;
    const centerZ = RADIUS + gap;
    const behavior = cameraBehavior(gap, MIN_GAP, OVERVIEW_GAP);

    // The globe is never translated in screen space. First project it with a
    // zero vertical principal point, then compensate for the zoom-dependent
    // camera tilt so the exact projected sphere silhouette remains centered in
    // the viewport. This invariant applies to every zoom, drag and focus state.
    const probe = {
      cx: w / 2,
      cy: 0,
      focal,
      centerZ,
      near: 0.1,
      dpr,
      ...behavior,
    };
    const bounds = projectedSphereVerticalBounds(probe, RADIUS);
    const cy = bounds ? h / 2 - bounds.centerY : h / 2;

    return {
      ...probe,
      cy,
    };
  }

  camera() {
    return this.cameraAt(this.cameraGap);
  }

  bind() {
    this.canvas.addEventListener('pointerdown', event => {
      this.cancelFocus();
      this.stopMotion();
      this.canvas.setPointerCapture(event.pointerId);
      this.drag = {
        x: event.clientX,
        y: event.clientY,
        yaw: this.yaw,
        pitch: this.pitch,
        moved: false,
      };
    });

    this.canvas.addEventListener('pointermove', event => {
      if (!this.drag) return;
      const dx = event.clientX - this.drag.x;
      const dy = event.clientY - this.drag.y;
      if (Math.hypot(dx, dy) > 3) this.drag.moved = true;
      const sensitivity = cameraBehavior(this.cameraGap, MIN_GAP, OVERVIEW_GAP).dragSensitivity;
      this.targetYaw = this.drag.yaw - dx * sensitivity;
      this.targetPitch = clamp(this.drag.pitch - dy * sensitivity, -1.08, 1.08);
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

      // Wheel zoom changes distance only. It never changes selection, rotates
      // to Home, or translates the globe away from the center of the viewport.
      this.targetCameraGap = clamp(
        this.targetCameraGap * Math.exp(direction * 0.13),
        MIN_GAP,
        ABSOLUTE_MAX_GAP,
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
      const behavior = cameraBehavior(this.cameraGap, MIN_GAP, OVERVIEW_GAP);

      this.yaw += yawDelta * behavior.motionEase;
      this.pitch += pitchDelta * behavior.motionEase;
      this.cameraGap += gapDelta * 0.14;

      const settled = Math.abs(yawDelta) < 0.00028
        && Math.abs(pitchDelta) < 0.00028
        && Math.abs(gapDelta) < 0.007;

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
    this.focusedId = id;

    const target = yawPitchToFront(local);
    const targetGap = resetZoom ? DEFAULT_GAP : this.cameraGap;
    const behavior = cameraBehavior(this.cameraGap, MIN_GAP, OVERVIEW_GAP);
    const from = {
      yaw: this.yaw,
      pitch: this.pitch,
      gap: this.cameraGap,
    };

    if (this.reduceMotion) {
      this.yaw = this.targetYaw = target.yaw;
      this.pitch = this.targetPitch = target.pitch;
      this.cameraGap = this.targetCameraGap = targetGap;
      this.requestDraw();
      return;
    }

    const start = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - start) / behavior.focusDuration);
      const eased = t * t * (3 - 2 * t);
      this.yaw = from.yaw + shortestAngle(from.yaw, target.yaw) * eased;
      this.pitch = from.pitch + (target.pitch - from.pitch) * eased;
      this.cameraGap = from.gap + (targetGap - from.gap) * eased;
      this.targetYaw = this.yaw;
      this.targetPitch = this.pitch;
      this.targetCameraGap = this.cameraGap;
      this.requestDraw();

      if (t < 1) {
        this.focusFrame = requestAnimationFrame(tick);
      } else {
        this.yaw = this.targetYaw = target.yaw;
        this.pitch = this.targetPitch = target.pitch;
        this.cameraGap = this.targetCameraGap = targetGap;
        this.focusFrame = null;
        this.requestDraw();
      }
    };
    this.focusFrame = requestAnimationFrame(tick);
  }

  focusedScreenPoint(camera = this.camera()) {
    const local = this.positions.get(this.focusedId);
    if (!local) return null;
    const unit = rotatePoint(local, this.yaw, this.pitch);
    return projectSpherePoint(unit, camera, RADIUS);
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
    if (!globeDrawn) {
      drawSphereBase(ctx, camera, RADIUS);
      drawSphereShade(ctx, camera, RADIUS);
    }
    this.drawRelationships(camera);
    this.drawPeople(camera);
  }

  drawRelationships(camera) {
    const knownIds = new Set(this.positions.keys());
    const { spousePairs, parentSets, siblingClusters } = buildRelationshipGroups(
      this.relationships,
      knownIds,
      this.people,
    );
    siblingClusters.forEach(ids => this.drawImportedSiblingCluster(ids, camera));
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

  drawImportedSiblingCluster(ids, camera) {
    const members = ids
      .map(id => ({ id, point: this.surfaceXY(this.positions.get(id)) }))
      .filter(entry => entry.point)
      .sort((a, b) => a.point.x - b.point.x);
    if (members.length < 2) return;
    const averageY = members.reduce((sum, entry) => sum + entry.point.y, 0) / members.length;
    const railY = averageY - 0.52;
    this.drawSurfacePolyline(
      [[members[0].point.x, railY], [members[members.length - 1].point.x, railY]],
      camera,
      1.28,
      RELATIONSHIP_COLORS.cluster,
    );
    members.forEach(({ point }) => this.drawSurfacePolyline(
      [[point.x, point.y], [point.x, railY]],
      camera,
      1.16,
      RELATIONSHIP_COLORS.cluster,
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
        const local = tangentPoint(
          a[0] + (b[0] - a[0]) * t,
          a[1] + (b[1] - a[1]) * t,
          RADIUS,
        );
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
    ctx.shadowColor = RELATIONSHIP_COLORS.shadow;
    ctx.shadowBlur = 2.4;
    ctx.shadowOffsetX = 0.6;
    ctx.shadowOffsetY = 1.1;
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
    const frame = projectedTangentFrame(unit, camera, RADIUS, PLAQUE.width, PLAQUE.height);
    if (!frame) return;

    const apparentWidth = Math.hypot(frame.xAxis.x, frame.xAxis.y) * 2;
    const apparentHeight = Math.hypot(frame.yAxis.x, frame.yAxis.y) * 2;
    if (apparentWidth < 8 || apparentHeight < 3) return;

    const textureSize = apparentWidth < 26 ? 260 : 520;
    const tex = plaqueTexture(person, textureSize);
    const placement = rigidPlaquePlacement(frame, tex.width, tex.height);
    if (!placement) return;

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

export function buildRelationshipGroups(relationships, knownIds = null, people = []) {
  const isKnown = id => Boolean(id) && (!knownIds || knownIds.has(id));
  const parentLinks = relationships.filter(link => link.type === 'parent' && isKnown(link.from) && isKnown(link.to));
  const spousePairs = uniquePairs(
    relationships.filter(link => link.type === 'spouse' && isKnown(link.from) && isKnown(link.to)),
  );
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

  // Cluster rails are only a fallback for old prototype people whose actual
  // parents are absent. Once the GEDCOM parent graph is present, drawing both
  // would duplicate and visually contradict the real family connectors.
  const peopleWithParents = new Set(parentLinks.map(link => link.to));
  const clusters = new Map();
  people.forEach(person => {
    if (!isKnown(person.id) || !person.cluster || peopleWithParents.has(person.id)) return;
    if (!['grandparent', 'grandparent-sibling'].includes(person.role)) return;
    if (!clusters.has(person.cluster)) clusters.set(person.cluster, []);
    clusters.get(person.cluster).push(person.id);
  });
  const siblingClusters = [...clusters.values()]
    .map(ids => [...new Set(ids)].sort())
    .filter(ids => ids.length > 1);

  return {
    spousePairs,
    parentSets: [...groupedChildren.values()].map(group => ({
      parents: group.parents,
      children: [...new Set(group.children)].sort(),
    })),
    siblingClusters,
  };
}

function drawSphereBase(ctx, camera, radius) {
  const bounds = projectedSphereVerticalBounds(camera, radius);
  if (!bounds) return;
  const pr = apparentSphereRadius(camera, radius);
  ctx.save();
  ctx.shadowColor = 'rgba(45,29,18,.42)';
  ctx.shadowBlur = 46;
  ctx.fillStyle = '#dec48d';
  ctx.beginPath();
  ctx.arc(camera.cx, bounds.centerY, pr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSphereShade(ctx, camera, radius) {
  const bounds = projectedSphereVerticalBounds(camera, radius);
  if (!bounds) return;
  const pr = apparentSphereRadius(camera, radius);
  const centerY = bounds.centerY;
  const g = ctx.createRadialGradient(
    camera.cx - pr * 0.10,
    centerY - pr * 0.28,
    pr * 0.10,
    camera.cx,
    centerY,
    pr,
  );
  g.addColorStop(0, 'rgba(255,244,207,.06)');
  g.addColorStop(0.64, 'rgba(106,71,39,.015)');
  g.addColorStop(0.86, 'rgba(78,49,28,.10)');
  g.addColorStop(1, 'rgba(41,27,18,.34)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(camera.cx, centerY, pr, 0, Math.PI * 2);
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
    if (!point) {
      active = false;
      return;
    }
    if (!active) {
      ctx.moveTo(point.x, point.y);
      active = true;
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  ctx.stroke();
}

function shortestAngle(from, to) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
