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
import { solveFocusedZoomAnchor } from './zoom-anchor.js';
import { extractSavedRecords } from './gedcom.js';
import { describeRelationship } from './relationships.js';

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

export const HOVER_DELAY_MS = 2000;
export const RELATIONSHIP_LINE_WIDTH = 3.35;
export const RELATIONSHIP_OVERVIEW_LINE_WIDTH = 1.55;
export const ANCESTRY_CONTINUATION_LINE_WIDTH = 3.0;
export const ANCESTRY_CONTINUATION_OVERVIEW_WIDTH = 1.35;
export const ANCESTRY_STUB_LENGTH = PLAQUE.height * 1.10;
export const SURFACE_LINE_STATIC_TARGET_PX = 6;
export const SURFACE_LINE_MOVING_TARGET_PX = 14;
export const SURFACE_LINE_STATIC_MAX_STEPS = 240;
export const SURFACE_LINE_MOVING_MAX_STEPS = 96;

export const FAMILY_CHILD_STEM_PREFERRED = PLAQUE.height * 1.45;
export const FAMILY_CHILD_STEM_MIN = PLAQUE.height * 1.05;
export const FAMILY_PARALLEL_GAP = PLAQUE.height * 0.42;
export const FAMILY_VERTICAL_CLEARANCE = PLAQUE.width * 0.42;
export const FAMILY_SINGLE_CHILD_SNAP_MAX = PLAQUE.width * 0.52;
const FAMILY_PARENT_CLEARANCE = PLAQUE.height * 0.72;
const FAMILY_ROUTE_OVERLAP_MARGIN = PLAQUE.width * 0.12;
const FAMILY_CROSSING_MARGIN = PLAQUE.width * 0.08;

export const RELATIONSHIP_COLORS = Object.freeze({
  couple: 'rgba(108,48,42,.98)',
  descent: 'rgba(137,58,48,.98)',
  rail: 'rgba(154,70,55,.97)',
  continuation: 'rgba(158,96,80,.86)',
  halo: 'rgba(247,225,190,.56)',
  shadow: 'rgba(43,28,20,.44)',
});

export function relationshipLineMetrics(gap) {
  const zoomT = cameraBehavior(gap, MIN_GAP, OVERVIEW_GAP).zoomT;
  const thinT = smoothstep(zoomT);
  return {
    primary: lerp(RELATIONSHIP_LINE_WIDTH, RELATIONSHIP_OVERVIEW_LINE_WIDTH, thinT),
    continuation: lerp(
      ANCESTRY_CONTINUATION_LINE_WIDTH,
      ANCESTRY_CONTINUATION_OVERVIEW_WIDTH,
      thinT,
    ),
    haloExtra: lerp(1.35, 0.62, thinT),
  };
}

export function surfaceLineStepCount(surfaceDistance, camera, radius = RADIUS, moving = false) {
  const distance = Math.max(0, Number(surfaceDistance) || 0);
  const focal = Math.max(1, Number(camera?.focal) || 1);
  const near = Math.max(0.001, Number(camera?.near) || 0.1);
  const centerZ = Number(camera?.centerZ) || radius + DEFAULT_GAP;
  const frontGap = Math.max(near, centerZ - radius);
  const projectedLength = distance * focal / frontGap;
  const targetPixels = moving ? SURFACE_LINE_MOVING_TARGET_PX : SURFACE_LINE_STATIC_TARGET_PX;
  const minimumSteps = moving ? 8 : 16;
  const maximumSteps = moving ? SURFACE_LINE_MOVING_MAX_STEPS : SURFACE_LINE_STATIC_MAX_STEPS;
  return Math.max(minimumSteps, Math.min(maximumSteps, Math.ceil(projectedLength / targetPixels)));
}

export function familyLaneBand(lane = 0) {
  const index = Math.max(0, Number(lane) || 0);
  if (index === 0) return 0;
  const magnitude = Math.ceil(index / 2);
  return index % 2 ? magnitude : -magnitude;
}

export function familyStemRange(generationSpan) {
  const span = Math.max(0, Number(generationSpan) || 0);
  const availableBeforeParents = Math.max(0, span - FAMILY_PARENT_CLEARANCE);
  const emergencyMinimum = PLAQUE.height * 0.70;
  const minimum = Math.max(
    emergencyMinimum,
    Math.min(FAMILY_CHILD_STEM_MIN, availableBeforeParents || emergencyMinimum),
  );
  const preferred = Math.max(
    minimum,
    Math.min(FAMILY_CHILD_STEM_PREFERRED, availableBeforeParents || minimum),
  );
  const maximum = Math.max(preferred, availableBeforeParents);
  return { minimum, preferred, maximum };
}

export function shouldSnapSingleChildRoute(route) {
  if (route.children?.length !== 1 || route.parentPoints?.length < 2) return false;
  const child = route.children[0].point;
  if (!child) return false;
  if (Math.abs(child.x - route.source.x) > FAMILY_SINGLE_CHILD_SNAP_MAX) return false;
  return child.x >= route.parentMinX - FAMILY_ROUTE_OVERLAP_MARGIN
    && child.x <= route.parentMaxX + FAMILY_ROUTE_OVERLAP_MARGIN;
}

export function familyRouteConflictScore(route, railY, plannedRoutes = []) {
  const candidate = routeSegmentsForConflict({ ...route, railY });
  let score = 0;
  for (const other of plannedRoutes) {
    const existing = routeSegmentsForConflict(other);
    for (const a of candidate) {
      for (const b of existing) {
        if (a.kind === 'horizontal' && b.kind === 'horizontal') {
          const overlap = intervalOverlapLength(a.x1, a.x2, b.x1, b.x2);
          if (overlap > 0 && Math.abs(a.y1 - b.y1) < FAMILY_PARALLEL_GAP) {
            score += 80 + overlap * 8;
          }
          continue;
        }
        if (a.kind === 'vertical' && b.kind === 'vertical') {
          const overlap = intervalOverlapLength(a.y1, a.y2, b.y1, b.y2);
          const xGap = Math.abs(a.x1 - b.x1);
          if (overlap > 0 && xGap < FAMILY_VERTICAL_CLEARANCE) {
            score += 30 * (1 - xGap / FAMILY_VERTICAL_CLEARANCE) + overlap * 5;
          }
          continue;
        }
        const horizontal = a.kind === 'horizontal' ? a : b.kind === 'horizontal' ? b : null;
        const vertical = a.kind === 'vertical' ? a : b.kind === 'vertical' ? b : null;
        if (!horizontal || !vertical) continue;
        if (
          between(vertical.x1, horizontal.x1 - FAMILY_CROSSING_MARGIN, horizontal.x2 + FAMILY_CROSSING_MARGIN)
          && between(horizontal.y1, vertical.y1 - FAMILY_CROSSING_MARGIN, vertical.y2 + FAMILY_CROSSING_MARGIN)
        ) score += 14;
      }
    }
  }
  return score;
}

export function planFamilyRoutes(familyGroups, pointForId) {
  const candidates = [];

  familyGroups.forEach(group => {
    const parentPoints = group.parents.map(pointForId).filter(Boolean);
    const children = group.children
      .map(id => ({ id, point: pointForId(id) }))
      .filter(entry => entry.point);
    if (!parentPoints.length || !children.length) return;

    const source = averagePoint(parentPoints);
    const childYs = children.map(entry => entry.point.y);
    const averageChildY = average(childYs);
    const direction = source.y >= averageChildY ? 1 : -1;
    const childAnchorY = direction > 0 ? Math.min(...childYs) : Math.max(...childYs);
    const parentMinX = Math.min(...parentPoints.map(point => point.x));
    const parentMaxX = Math.max(...parentPoints.map(point => point.x));
    const minX = Math.min(source.x, ...children.map(entry => entry.point.x));
    const maxX = Math.max(source.x, ...children.map(entry => entry.point.x));
    const generationSpan = Math.abs(source.y - childAnchorY);
    const stemRange = familyStemRange(generationSpan);

    candidates.push({
      ...group,
      source,
      parentPoints,
      parentMinX,
      parentMaxX,
      children,
      direction,
      childAnchorY,
      minX,
      maxX,
      generationSpan,
      stemRange,
    });
  });

  candidates.sort((a, b) => (
    a.childAnchorY - b.childAnchorY
    || (Number(a.lane) || 0) - (Number(b.lane) || 0)
    || a.minX - b.minX
    || a.maxX - b.maxX
    || String(a.familyId).localeCompare(String(b.familyId))
  ));

  const planned = [];
  candidates.forEach(route => {
    const directSingleChild = shouldSnapSingleChildRoute(route);
    if (directSingleChild) {
      planned.push({
        ...route,
        directSingleChild: true,
        stemLength: route.generationSpan,
        routeSlot: 0,
        railY: route.children[0].point.y,
      });
      return;
    }

    const options = familyStemCandidates(route.stemRange).map((stemLength, index) => {
      const railY = railYForStem(route, stemLength);
      const collision = familyRouteConflictScore(route, railY, planned);
      const deviation = Math.abs(stemLength - route.stemRange.preferred);
      return { stemLength, railY, routeSlot: index, cost: collision + deviation * 1.5 };
    });
    options.sort((a, b) => a.cost - b.cost || a.routeSlot - b.routeSlot);
    const selected = options[0];
    planned.push({ ...route, directSingleChild: false, ...selected });
  });

  return planned;
}

export class GlobeScene {
  constructor(canvas, onSelect) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mapCanvas = document.getElementById('mapCanvas');
    this.hoverCard = document.getElementById('personHover');
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
    this.hoveredId = null;
    this.hoverCandidateId = null;
    this.hoverTimer = null;
    this.hoverPointer = null;
    this.yaw = 0;
    this.pitch = 0;
    this.cameraGap = DEFAULT_GAP;
    this.targetYaw = this.yaw;
    this.targetPitch = this.pitch;
    this.targetCameraGap = this.cameraGap;
    this.zoomAnchor = null;
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
    this.clearHover();
    this.people = people;
    this.relationships = relationships;
    this.homeId = people.find(person => person.role === 'root')?.id || people[0]?.id || null;
    this.positions = layoutSample(people, RADIUS, relationships);
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
    this.clearHover();
    this.requestDraw();
  }

  cameraAt(gap) {
    const dpr = Number(this.canvas.dataset.dpr || 1);
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;
    const focal = Math.min(w, h) * 1.04;
    const centerZ = RADIUS + gap;
    const behavior = cameraBehavior(gap, MIN_GAP, OVERVIEW_GAP);
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
    return { ...probe, cy };
  }

  camera() {
    return this.cameraAt(this.cameraGap);
  }

  bind() {
    this.canvas.addEventListener('pointerdown', event => {
      this.clearHover();
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
      if (!this.drag) {
        this.updateHover(event);
        return;
      }
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
    this.canvas.addEventListener('pointercancel', () => {
      this.drag = null;
      this.clearHover();
    });
    this.canvas.addEventListener('pointerleave', () => this.clearHover());

    this.canvas.addEventListener('wheel', event => {
      event.preventDefault();
      const direction = Math.sign(event.deltaY);
      if (!direction) return;
      this.clearHover();
      const focused = this.focusedScreenPoint();
      if (focused && this.focusedId) {
        this.zoomAnchor = { id: this.focusedId, x: focused.x, y: focused.y };
      }
      this.targetCameraGap = clamp(
        this.targetCameraGap * Math.exp(direction * 0.13),
        MIN_GAP,
        ABSOLUTE_MAX_GAP,
      );
      if (this.reduceMotion) {
        this.cameraGap = this.targetCameraGap;
        this.applyZoomAnchor();
        this.zoomAnchor = null;
        this.requestDraw();
      } else {
        this.requestMotion();
      }
    }, { passive: false });
  }

  applyZoomAnchor(camera = this.camera()) {
    if (!this.zoomAnchor || this.zoomAnchor.id !== this.focusedId) return false;
    const local = this.positions.get(this.zoomAnchor.id);
    if (!local) return false;
    const solved = solveFocusedZoomAnchor({
      local,
      yaw: this.yaw,
      pitch: this.pitch,
      camera,
      radius: RADIUS,
      target: this.zoomAnchor,
    });
    if (!solved.solved) return false;
    this.yaw = solved.yaw;
    this.pitch = solved.pitch;
    this.targetYaw = solved.yaw;
    this.targetPitch = solved.pitch;
    return true;
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
      if (this.zoomAnchor) this.applyZoomAnchor();
      const settled = Math.abs(yawDelta) < 0.00028
        && Math.abs(pitchDelta) < 0.00028
        && Math.abs(gapDelta) < 0.007;
      if (settled) {
        this.yaw = this.targetYaw;
        this.pitch = this.targetPitch;
        this.cameraGap = this.targetCameraGap;
        if (this.zoomAnchor) this.applyZoomAnchor(this.cameraAt(this.cameraGap));
        this.zoomAnchor = null;
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
    this.zoomAnchor = null;
    this.targetYaw = this.yaw;
    this.targetPitch = this.pitch;
    this.targetCameraGap = this.cameraGap;
  }

  cancelFocus() {
    if (this.focusFrame) cancelAnimationFrame(this.focusFrame);
    this.focusFrame = null;
  }

  focus(id, { resetZoom = false, targetPoint = null } = {}) {
    const local = this.positions.get(id);
    if (!local) return;
    this.clearHover();
    this.stopMotion();
    this.cancelFocus();
    this.focusedId = id;
    const targetGap = resetZoom ? DEFAULT_GAP : this.cameraGap;
    const targetCamera = this.cameraAt(targetGap);
    const dpr = targetCamera.dpr || 1;
    const viewportWidth = this.canvas.width / dpr;
    const viewportHeight = this.canvas.height / dpr;
    const desiredPoint = {
      x: clamp(Number(targetPoint?.x) || targetCamera.cx, 0, viewportWidth),
      y: clamp(Number(targetPoint?.y) || viewportHeight / 2, 0, viewportHeight),
    };
    const front = yawPitchToFront(local);
    const centered = solveFocusedZoomAnchor({
      local,
      yaw: front.yaw,
      pitch: front.pitch,
      camera: targetCamera,
      radius: RADIUS,
      target: desiredPoint,
      iterations: 10,
    });
    const target = centered.solved ? centered : front;
    const behavior = cameraBehavior(this.cameraGap, MIN_GAP, OVERVIEW_GAP);
    const from = { yaw: this.yaw, pitch: this.pitch, gap: this.cameraGap };
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
    const { spousePairs, familyGroups, ancestryStubs } = buildRelationshipGroups(
      this.relationships,
      knownIds,
      this.people,
    );
    const familyRoutes = planFamilyRoutes(
      familyGroups,
      id => this.surfaceXY(this.positions.get(id)),
    );
    const familyPairKeys = new Set(
      familyGroups
        .filter(group => group.parents.length >= 2)
        .map(group => pairKey(group.parents[0], group.parents[1])),
    );
    ancestryStubs.forEach(id => this.drawAncestryStub(id, camera));
    spousePairs
      .filter(([a, b]) => !familyPairKeys.has(pairKey(a, b)))
      .forEach(([a, b]) => this.drawCoupleBar(a, b, camera));
    familyRoutes.forEach(route => this.drawFamilyRoute(route, camera));
  }

  drawCoupleBar(aId, bId, camera) {
    const a = this.surfaceXY(this.positions.get(aId));
    const b = this.surfaceXY(this.positions.get(bId));
    if (!a || !b) return;
    const metrics = relationshipLineMetrics(camera.centerZ - RADIUS);
    const y = (a.y + b.y) / 2;
    this.drawSurfacePolyline(
      [[a.x, y], [b.x, y]],
      camera,
      RELATIONSHIP_COLORS.couple,
      metrics.primary,
      metrics.haloExtra,
    );
  }

  drawFamilyRoute(route, camera) {
    const metrics = relationshipLineMetrics(camera.centerZ - RADIUS);
    const moving = Boolean(this.drag || this.motionFrame || this.focusFrame);
    const parts = [];
    if (route.parentPoints.length >= 2) {
      parts.push({
        points: [[route.parentMinX, route.source.y], [route.parentMaxX, route.source.y]],
        color: RELATIONSHIP_COLORS.couple,
        width: metrics.primary,
      });
    }

    if (route.directSingleChild) {
      const child = route.children[0].point;
      parts.push({
        points: [[child.x, route.source.y], [child.x, child.y]],
        color: RELATIONSHIP_COLORS.descent,
        width: metrics.primary,
      });
    } else {
      parts.push(
        {
          points: [[route.source.x, route.source.y], [route.source.x, route.railY]],
          color: RELATIONSHIP_COLORS.descent,
          width: metrics.primary,
        },
        {
          points: [[route.minX, route.railY], [route.maxX, route.railY]],
          color: RELATIONSHIP_COLORS.rail,
          width: metrics.primary,
        },
        ...route.children.map(({ point }) => ({
          points: [[point.x, route.railY], [point.x, point.y]],
          color: RELATIONSHIP_COLORS.descent,
          width: metrics.primary,
        })),
      );
    }

    const sampledParts = parts.map(part => ({
      ...part,
      sampled: this.sampleSurfacePolyline(part.points, camera, moving),
    }));
    sampledParts.forEach(part => this.strokeSampledSurfacePolyline(
      part.sampled,
      RELATIONSHIP_COLORS.halo,
      part.width + metrics.haloExtra,
      moving,
    ));
    sampledParts.forEach(part => this.strokeSampledSurfacePolyline(
      part.sampled,
      part.color,
      part.width,
      moving,
      { shadow: true },
    ));
  }

  drawAncestryStub(id, camera) {
    const point = this.surfaceXY(this.positions.get(id));
    if (!point) return;
    const metrics = relationshipLineMetrics(camera.centerZ - RADIUS);
    this.drawSurfacePolyline(
      [[point.x, point.y], [point.x, point.y + ANCESTRY_STUB_LENGTH]],
      camera,
      RELATIONSHIP_COLORS.continuation,
      metrics.continuation,
      metrics.haloExtra,
    );
  }

  sampleSurfacePolyline(xyPoints, camera, moving = Boolean(this.drag || this.motionFrame || this.focusFrame)) {
    const sampled = [];
    for (let segment = 0; segment < xyPoints.length - 1; segment += 1) {
      const a = xyPoints[segment];
      const b = xyPoints[segment + 1];
      const surfaceDistance = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const steps = surfaceLineStepCount(surfaceDistance, camera, RADIUS, moving);
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
    return sampled;
  }

  strokeSampledSurfacePolyline(sampled, stroke, width, moving, { shadow = false } = {}) {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    if (shadow && !moving) {
      ctx.shadowColor = RELATIONSHIP_COLORS.shadow;
      ctx.shadowBlur = 2.2;
      ctx.shadowOffsetX = 0.5;
      ctx.shadowOffsetY = 0.9;
    }
    strokeSegments(ctx, sampled);
    ctx.restore();
  }

  drawSurfacePolyline(
    xyPoints,
    camera,
    stroke = null,
    width = RELATIONSHIP_LINE_WIDTH,
    haloExtra = 1.35,
  ) {
    const moving = Boolean(this.drag || this.motionFrame || this.focusFrame);
    const sampled = this.sampleSurfacePolyline(xyPoints, camera, moving);
    this.strokeSampledSurfacePolyline(
      sampled,
      RELATIONSHIP_COLORS.halo,
      width + haloExtra,
      moving,
    );
    this.strokeSampledSurfacePolyline(
      sampled,
      stroke || RELATIONSHIP_COLORS.descent,
      width,
      moving,
      { shadow: true },
    );
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

  personAt(x, y) {
    const candidates = this.hitAreas.filter(hit => Math.hypot(x - hit.x, y - hit.y) <= hit.r);
    if (!candidates.length) return null;
    candidates.sort((a, b) => a.z - b.z);
    return candidates[0];
  }

  pick(x, y) {
    const hit = this.personAt(x, y);
    if (!hit) return;
    this.clearHover();
    this.onSelect?.(hit.id);
  }

  updateHover(event) {
    if (!this.hoverCard || event.pointerType === 'touch') {
      this.clearHover();
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    const x = Number.isFinite(event.offsetX) ? event.offsetX : (Number(event.clientX) || 0) - (rect.left || 0);
    const y = Number.isFinite(event.offsetY) ? event.offsetY : (Number(event.clientY) || 0) - (rect.top || 0);
    const hit = this.personAt(x, y);
    if (!hit) {
      this.clearHover();
      return;
    }
    const person = this.people.find(candidate => candidate.id === hit.id);
    if (!person) {
      this.clearHover();
      return;
    }
    const clientX = Number.isFinite(event.clientX) ? event.clientX : (rect.left || 0) + x;
    const clientY = Number.isFinite(event.clientY) ? event.clientY : (rect.top || 0) + y;
    this.hoverPointer = { x: clientX, y: clientY };

    if (this.hoveredId === person.id && !this.hoverCard.hidden) {
      this.positionHoverCard(clientX, clientY);
      return;
    }
    if (this.hoverCandidateId === person.id) return;

    this.cancelHoverTimer();
    this.hoverCard.hidden = true;
    this.hoveredId = null;
    this.hoverCandidateId = person.id;
    this.hoverTimer = setTimeout(() => {
      this.hoverTimer = null;
      if (this.hoverCandidateId !== person.id) return;
      this.renderHoverCard(person);
      this.hoveredId = person.id;
      if (this.hoverPointer) this.positionHoverCard(this.hoverPointer.x, this.hoverPointer.y);
    }, HOVER_DELAY_MS);
  }

  renderHoverCard(person) {
    if (!this.hoverCard) return;
    const relationship = describeRelationship(this.homeId, person.id, this.people, this.relationships);
    const records = extractSavedRecords(person.rawGedcom);
    const connections = connectionCounts(person.id, this.relationships);
    const birth = eventLine(person.birth);
    const death = eventLine(person.death);
    const birthYear = yearFrom(person.birth?.date) || '?';
    const deathYear = person.death?.date ? (yearFrom(person.death.date) || '?') : 'Living';
    const profile = person.photo
      ? `<div class="hover-profile"><img src="${escapeHtml(person.photo)}" alt=""></div>`
      : `<div class="hover-profile hover-profile-initial" aria-hidden="true">${escapeHtml((person.name || '?').trim().charAt(0).toUpperCase() || '?')}</div>`;
    const recordMarkup = records.length
      ? `<div class="hover-records"><span>${records.length} saved record${records.length === 1 ? '' : 's'}</span><ul>${records.slice(0, 2).map(record => `<li>${escapeHtml(record.title)}</li>`).join('')}</ul></div>`
      : '';
    this.hoverCard.innerHTML = `
      <div class="hover-person-head">
        ${profile}
        <div>
          <div class="hover-kicker">${escapeHtml(relationship)}</div>
          <strong class="hover-name">${escapeHtml(person.name)}</strong>
          <div class="hover-lifespan">${escapeHtml(birthYear)}–${escapeHtml(deathYear)}</div>
        </div>
      </div>
      <div class="hover-events">
        <div class="hover-event"><span>Born</span><div>${escapeHtml(birth || 'Unknown')}</div></div>
        <div class="hover-event"><span>Died</span><div>${escapeHtml(death || 'No death recorded')}</div></div>
      </div>
      <div class="hover-kin">${connections.parents} parent${connections.parents === 1 ? '' : 's'} · ${connections.spouses} spouse${connections.spouses === 1 ? '' : 's'} · ${connections.children} child${connections.children === 1 ? '' : 'ren'}</div>
      ${recordMarkup}
      <div class="hover-more">Click for full person details</div>`;
    this.hoverCard.hidden = false;
  }

  positionHoverCard(clientX, clientY) {
    if (!this.hoverCard || this.hoverCard.hidden) return;
    const card = this.hoverCard.getBoundingClientRect();
    const canvasRect = this.canvas.getBoundingClientRect();
    const viewportWidth = Number(globalThis.innerWidth) || canvasRect.width || 1200;
    const viewportHeight = Number(globalThis.innerHeight) || canvasRect.height || 800;
    const margin = 10;
    const gap = 16;
    let left = clientX + gap;
    let top = clientY + gap;
    if (left + card.width > viewportWidth - margin) left = clientX - card.width - gap;
    if (top + card.height > viewportHeight - margin) top = clientY - card.height - gap;
    this.hoverCard.style.left = `${Math.max(margin, left)}px`;
    this.hoverCard.style.top = `${Math.max(margin, top)}px`;
  }

  cancelHoverTimer() {
    if (this.hoverTimer !== null) clearTimeout(this.hoverTimer);
    this.hoverTimer = null;
  }

  clearHover() {
    this.cancelHoverTimer();
    this.hoverCandidateId = null;
    this.hoveredId = null;
    this.hoverPointer = null;
    if (this.hoverCard) this.hoverCard.hidden = true;
  }
}

export function buildRelationshipGroups(relationships, knownIds = null, people = []) {
  const isKnown = id => Boolean(id) && (!knownIds || knownIds.has(id));
  const parentLinks = relationships.filter(link => link.type === 'parent' && isKnown(link.from) && isKnown(link.to));
  const spouseLinks = relationships.filter(link => link.type === 'spouse' && isKnown(link.from) && isKnown(link.to));
  const spousePairs = uniquePairs(spouseLinks);

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

  const familyMap = new Map();
  const ensureFamily = familyId => {
    const key = familyId || null;
    if (!key) return null;
    if (!familyMap.has(key)) {
      familyMap.set(key, { familyId: key, parents: new Set(), children: new Set(), lane: 0 });
    }
    return familyMap.get(key);
  };

  spouseLinks.forEach(link => {
    const family = ensureFamily(link.familyId);
    if (!family) return;
    family.parents.add(link.from);
    family.parents.add(link.to);
  });
  parentLinks.forEach(link => {
    const family = ensureFamily(link.familyId);
    if (!family) return;
    family.parents.add(link.from);
    family.children.add(link.to);
  });

  const familyGroups = [...familyMap.values()]
    .filter(group => group.parents.size && group.children.size)
    .map(group => ({
      familyId: group.familyId,
      parents: [...group.parents].sort(),
      children: [...group.children].sort(),
      lane: 0,
    }));

  const childrenCoveredByFamily = new Set(familyGroups.flatMap(group => group.children));
  [...groupedChildren.values()].forEach((group, index) => {
    const children = [...new Set(group.children)].filter(id => !childrenCoveredByFamily.has(id)).sort();
    if (!children.length) return;
    familyGroups.push({
      familyId: `fallback:${group.parents.join('|')}:${index}`,
      parents: group.parents,
      children,
      lane: 0,
    });
  });

  familyGroups.sort((a, b) => a.familyId.localeCompare(b.familyId));
  const usedLanesByParent = new Map();
  familyGroups.forEach(group => {
    const used = new Set();
    group.parents.forEach(parentId => {
      for (const lane of usedLanesByParent.get(parentId) || []) used.add(lane);
    });
    let lane = 0;
    while (used.has(lane)) lane += 1;
    group.lane = lane;
    group.parents.forEach(parentId => {
      if (!usedLanesByParent.has(parentId)) usedLanesByParent.set(parentId, new Set());
      usedLanesByParent.get(parentId).add(lane);
    });
  });

  const peopleWithVisibleParents = new Set(parentLinks.map(link => link.to));
  const ancestryStubs = people
    .filter(person => isKnown(person.id) && person.cluster && !peopleWithVisibleParents.has(person.id))
    .map(person => person.id)
    .sort();

  return {
    spousePairs,
    parentSets: [...groupedChildren.values()].map(group => ({
      parents: group.parents,
      children: [...new Set(group.children)].sort(),
    })),
    familyGroups,
    ancestryStubs,
  };
}

function familyStemCandidates(range) {
  const values = [range.preferred];
  for (
    let length = range.preferred + FAMILY_PARALLEL_GAP;
    length <= range.maximum + 1e-9;
    length += FAMILY_PARALLEL_GAP
  ) values.push(Math.min(length, range.maximum));
  for (
    let length = range.preferred - FAMILY_PARALLEL_GAP;
    length >= range.minimum - 1e-9;
    length -= FAMILY_PARALLEL_GAP
  ) values.push(Math.max(length, range.minimum));
  if (!values.some(value => Math.abs(value - range.maximum) < 1e-9)) values.push(range.maximum);
  if (!values.some(value => Math.abs(value - range.minimum) < 1e-9)) values.push(range.minimum);
  return [...new Set(values.map(value => Math.round(value * 1000000) / 1000000))];
}

function railYForStem(route, stemLength) {
  return route.childAnchorY + route.direction * stemLength;
}

function routeSegmentsForConflict(route) {
  if (route.directSingleChild) {
    const child = route.children?.[0]?.point;
    if (!child) return [];
    return [{ kind: 'vertical', x1: child.x, x2: child.x, y1: route.source.y, y2: child.y }];
  }
  const railY = route.railY;
  const segments = [
    { kind: 'horizontal', x1: route.minX, x2: route.maxX, y1: railY, y2: railY },
    { kind: 'vertical', x1: route.source.x, x2: route.source.x, y1: route.source.y, y2: railY },
  ];
  route.children?.forEach(({ point }) => {
    segments.push({ kind: 'vertical', x1: point.x, x2: point.x, y1: point.y, y2: railY });
  });
  return segments;
}

function intervalOverlapLength(a1, a2, b1, b2) {
  const aMin = Math.min(a1, a2);
  const aMax = Math.max(a1, a2);
  const bMin = Math.min(b1, b2);
  const bMax = Math.max(b1, b2);
  return Math.max(0, Math.min(aMax, bMax) - Math.max(aMin, bMin));
}

function between(value, a, b) {
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  return value >= min && value <= max;
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
    const key = pairKey(link.from, link.to);
    if (seen.has(key)) return;
    seen.add(key);
    out.push([link.from, link.to]);
  });
  return out;
}

function pairKey(a, b) {
  return [a, b].sort().join('|');
}

function averagePoint(points) {
  return {
    x: average(points.map(point => point.x)),
    y: average(points.map(point => point.y)),
  };
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function connectionCounts(personId, relationships) {
  const parents = new Set();
  const spouses = new Set();
  const children = new Set();
  relationships.forEach(link => {
    if (link.type === 'parent') {
      if (link.to === personId) parents.add(link.from);
      if (link.from === personId) children.add(link.to);
    } else if (link.type === 'spouse') {
      if (link.from === personId) spouses.add(link.to);
      if (link.to === personId) spouses.add(link.from);
    }
  });
  return { parents: parents.size, spouses: spouses.size, children: children.size };
}

function eventLine(event = {}) {
  return [event.date, event.place].filter(Boolean).join(' · ');
}

function yearFrom(value = '') {
  return String(value).match(/\b(1[0-9]{3}|20[0-9]{2}|21[0-9]{2})\b/)?.[1] || '';
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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

function smoothstep(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
