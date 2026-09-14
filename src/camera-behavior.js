export function normalizedLogZoom(gap, minGap, maxGap) {
  const min = Math.max(1e-6, Math.min(minGap, maxGap));
  const max = Math.max(min + 1e-6, Math.max(minGap, maxGap));
  const value = clamp(gap, min, max);
  return clamp((Math.log(value) - Math.log(min)) / (Math.log(max) - Math.log(min)), 0, 1);
}

export function cameraBehavior(gap, minGap, maxGap) {
  const zoomT = normalizedLogZoom(gap, minGap, maxGap);
  const angleT = smootherstep(zoomT);
  const speedT = smoothstep(zoomT);
  const overviewT = smoothRange(zoomT, 0.56, 1);

  return {
    zoomT,
    angleT,
    overviewT,
    // The close view is nearly perpendicular to the selected patch. The
    // camera then leans progressively as distance increases, with no mode
    // switch or early jump in angle.
    viewTilt: lerp(0.01, 0.28, angleT),
    // This is the natural focused-person framing before user-controlled zoom
    // anchoring is applied. Wide-view sphere framing is handled separately so
    // it does not masquerade as panning.
    targetYRatio: lerp(0.58, 0.52, angleT),
    // Rotation stays deliberately restrained at every zoom level. Wide views
    // are a little quicker than close inspection, but never become twitchy.
    dragSensitivity: lerp(0.00018, 0.00058, speedT),
    motionEase: lerp(0.070, 0.100, speedT),
    focusDuration: lerp(1280, 1050, speedT),
  };
}

export function cameraCenterY({ height, focal, centerZ, radius, viewTilt, targetYRatio }) {
  const focusWorldY = radius * Math.sin(viewTilt);
  const focusWorldZ = -radius * Math.cos(viewTilt);
  const depth = Math.max(1e-6, centerZ + focusWorldZ);
  const projectedOffset = focusWorldY * focal / depth;
  return height * targetYRatio + projectedOffset;
}

export function blendOverviewCenter(focusedCenterY, sphereRadius, overviewT, topInset = 14) {
  return lerp(focusedCenterY, sphereRadius + topInset, clamp(overviewT, 0, 1));
}

function smoothstep(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function smootherstep(t) {
  const x = clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function smoothRange(value, start, end) {
  if (end <= start) return value >= end ? 1 : 0;
  return smoothstep((value - start) / (end - start));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
