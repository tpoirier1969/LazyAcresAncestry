export function normalizedLogZoom(gap, minGap, maxGap) {
  const min = Math.max(1e-6, Math.min(minGap, maxGap));
  const max = Math.max(min + 1e-6, Math.max(minGap, maxGap));
  const value = clamp(gap, min, max);
  return clamp((Math.log(value) - Math.log(min)) / (Math.log(max) - Math.log(min)), 0, 1);
}

export function cameraBehavior(gap, minGap, maxGap) {
  const zoomT = normalizedLogZoom(gap, minGap, maxGap);
  const angleT = Math.pow(zoomT, 0.46);
  const speedT = Math.pow(zoomT, 0.72);

  return {
    zoomT,
    angleT,
    // Close inspection is nearly perpendicular to the surface. Pulling back
    // deliberately tilts the view toward the horizon so the globe reads as a
    // sphere instead of merely shrinking under an unchanged camera.
    viewTilt: lerp(0.035, 0.56, angleT),
    // Fine work needs much slower angular motion than a broad overview.
    dragSensitivity: lerp(0.00035, 0.00100, speedT),
    motionEase: lerp(0.085, 0.115, speedT),
    targetYRatio: lerp(0.58, 0.68, angleT),
    plaqueFacing: lerp(0.16, 0.27, angleT),
    focusDuration: lerp(1220, 1020, speedT),
  };
}

export function cameraCenterY({ height, focal, centerZ, radius, viewTilt, targetYRatio }) {
  const focusWorldY = radius * Math.sin(viewTilt);
  const focusWorldZ = -radius * Math.cos(viewTilt);
  const depth = Math.max(1e-6, centerZ + focusWorldZ);
  const projectedOffset = focusWorldY * focal / depth;
  return height * targetYRatio + projectedOffset;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
