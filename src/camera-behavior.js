export function normalizedLogZoom(gap, minGap, maxGap) {
  const min = Math.max(1e-6, Math.min(minGap, maxGap));
  const max = Math.max(min + 1e-6, Math.max(minGap, maxGap));
  const value = clamp(gap, min, max);
  return clamp((Math.log(value) - Math.log(min)) / (Math.log(max) - Math.log(min)), 0, 1);
}

export function cameraBehavior(gap, minGap, maxGap) {
  const zoomT = normalizedLogZoom(gap, minGap, maxGap);
  const angleT = smootherstep(zoomT);
  // Keep close and medium inspection deliberately slow, then let speed rise
  // more strongly toward the wide overview. This prevents a modest drag from
  // throwing the user away from the family they were inspecting without making
  // large-scale navigation painfully slow.
  const speedT = Math.pow(smootherstep(zoomT), 1.55);

  return {
    zoomT,
    angleT,
    speedT,
    // Camera pitch is applied around the front/focused surface point, not by
    // rotating the globe underneath it. The person therefore stays put while
    // the horizon and visible amount of sphere change continuously.
    viewTilt: lerp(0.01, 0.24, angleT),
    // Zoom itself must not masquerade as panning. The canonical focused point
    // keeps one stable screen height throughout the zoom range.
    targetYRatio: 0.58,
    // The upper bound stays unchanged for broad navigation, but the curved
    // response makes the close and medium ranges substantially less twitchy.
    dragSensitivity: lerp(0.00014, 0.00058, speedT),
    motionEase: lerp(0.064, 0.100, speedT),
    focusDuration: lerp(1320, 1050, speedT),
  };
}

export function cameraCenterY({ height, targetYRatio }) {
  return height * targetYRatio;
}

function smootherstep(t) {
  const x = clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
