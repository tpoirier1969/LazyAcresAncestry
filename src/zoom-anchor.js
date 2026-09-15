import { projectSpherePoint, rotatePoint } from './geometry.js';

const DEFAULT_PITCH_MIN = -1.08;
const DEFAULT_PITCH_MAX = 1.08;
const EPSILON = 0.00045;
const MAX_STEP = 0.08;

/**
 * Rotate the globe just enough to keep a selected surface point at the same
 * screen coordinate after the camera distance changes. The camera principal
 * point is never translated, so the sphere itself remains centered.
 */
export function solveFocusedZoomAnchor({
  local,
  yaw,
  pitch,
  camera,
  radius,
  target,
  pitchMin = DEFAULT_PITCH_MIN,
  pitchMax = DEFAULT_PITCH_MAX,
  iterations = 6,
}) {
  if (!local || !camera || !target || !Number.isFinite(radius)) return { yaw, pitch, solved: false };
  let nextYaw = Number(yaw) || 0;
  let nextPitch = clamp(Number(pitch) || 0, pitchMin, pitchMax);
  let solved = false;

  for (let i = 0; i < iterations; i += 1) {
    const base = project(local, nextYaw, nextPitch, camera, radius);
    if (!base) break;
    const ex = target.x - base.x;
    const ey = target.y - base.y;
    if (Math.hypot(ex, ey) < 0.025) {
      solved = true;
      break;
    }

    const yawProbe = project(local, nextYaw + EPSILON, nextPitch, camera, radius);
    const pitchProbe = project(local, nextYaw, nextPitch + EPSILON, camera, radius);
    if (!yawProbe || !pitchProbe) break;

    const j00 = (yawProbe.x - base.x) / EPSILON;
    const j10 = (yawProbe.y - base.y) / EPSILON;
    const j01 = (pitchProbe.x - base.x) / EPSILON;
    const j11 = (pitchProbe.y - base.y) / EPSILON;
    const determinant = j00 * j11 - j01 * j10;
    if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-6) break;

    let dyaw = (ex * j11 - ey * j01) / determinant;
    let dpitch = (j00 * ey - j10 * ex) / determinant;
    dyaw = clamp(dyaw, -MAX_STEP, MAX_STEP);
    dpitch = clamp(dpitch, -MAX_STEP, MAX_STEP);
    nextYaw += dyaw;
    nextPitch = clamp(nextPitch + dpitch, pitchMin, pitchMax);
    solved = true;
  }

  return { yaw: nextYaw, pitch: nextPitch, solved };
}

function project(local, yaw, pitch, camera, radius) {
  const unit = rotatePoint(local, yaw, pitch);
  return projectSpherePoint(unit, camera, radius);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
