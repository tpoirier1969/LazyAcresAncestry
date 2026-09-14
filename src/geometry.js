export const TAU = Math.PI * 2;

export function requiredSphereRadius({
  count,
  plaqueWidth = 1,
  plaqueHeight = 0.75,
  spacingFactor = 1.6,
  packingEfficiency = 0.65,
}) {
  const areaPerPerson = plaqueWidth * plaqueHeight * spacingFactor;
  return Math.sqrt((count * areaPerPerson) / (4 * Math.PI * packingEfficiency));
}

export function tangentPoint(x, y, radius) {
  const distance = Math.hypot(x, y);
  if (!distance) return { x: 0, y: 0, z: -1 };
  const theta = distance / radius;
  const s = Math.sin(theta);
  return {
    x: s * (x / distance),
    y: s * (y / distance),
    z: -Math.cos(theta),
  };
}

export function tangentBasis(unit) {
  let ux = -unit.z;
  let uy = 0;
  let uz = unit.x;
  let len = Math.hypot(ux, uy, uz);
  if (len < 1e-8) {
    ux = 1;
    uy = 0;
    uz = 0;
    len = 1;
  }
  ux /= len;
  uy /= len;
  uz /= len;
  const vx = unit.y * uz - unit.z * uy;
  const vy = unit.z * ux - unit.x * uz;
  const vz = unit.x * uy - unit.y * ux;
  return { u: { x: ux, y: uy, z: uz }, v: { x: vx, y: vy, z: vz } };
}

export function rotatePoint(p, yaw, pitch) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const x1 = cy * p.x + sy * p.z;
  const z1 = -sy * p.x + cy * p.z;
  return {
    x: x1,
    y: cp * p.y - sp * z1,
    z: sp * p.y + cp * z1,
  };
}

export function projectLocalPoint(local, camera) {
  const world = {
    x: local.x,
    y: local.y,
    z: camera.centerZ + local.z,
  };
  if (world.z <= camera.near) return null;
  const scale = camera.focal / world.z;
  return {
    x: camera.cx + world.x * scale,
    y: camera.cy - world.y * scale,
    z: world.z,
    scale,
    world,
  };
}

// The zoom-dependent view angle is a camera transform, not a second globe
// rotation. It pivots around the front surface point so the focused person can
// remain stationary while the visible amount of sphere changes around them.
export function viewTiltPoint(world, camera, radius) {
  const tilt = camera.viewTilt || 0;
  if (!tilt) return { ...world };
  const pivotZ = camera.centerZ - radius;
  const cp = Math.cos(tilt);
  const sp = Math.sin(tilt);
  const dz = world.z - pivotZ;
  return {
    x: world.x,
    y: cp * world.y - sp * dz,
    z: pivotZ + sp * world.y + cp * dz,
  };
}

export function viewTiltVector(vector, camera) {
  const tilt = camera.viewTilt || 0;
  if (!tilt) return { ...vector };
  const cp = Math.cos(tilt);
  const sp = Math.sin(tilt);
  return {
    x: vector.x,
    y: cp * vector.y - sp * vector.z,
    z: sp * vector.y + cp * vector.z,
  };
}

export function projectSpherePoint(unit, camera, radius) {
  const unpitchedWorld = {
    x: radius * unit.x,
    y: radius * unit.y,
    z: camera.centerZ + radius * unit.z,
  };
  const world = viewTiltPoint(unpitchedWorld, camera, radius);
  if (world.z <= camera.near) return null;
  const scale = camera.focal / world.z;
  const normal = viewTiltVector(unit, camera);
  const projected = {
    x: camera.cx + world.x * scale,
    y: camera.cy - world.y * scale,
    z: world.z,
    scale,
    world,
    normal,
  };

  const toCamera = {
    x: -world.x,
    y: -world.y,
    z: -world.z,
  };
  if (normal.x * toCamera.x + normal.y * toCamera.y + normal.z * toCamera.z <= 0) return null;
  return projected;
}

export function isVisible(unit, projected) {
  if (!projected) return false;
  const normal = projected.normal || unit;
  const toCamera = {
    x: -projected.world.x,
    y: -projected.world.y,
    z: -projected.world.z,
  };
  return normal.x * toCamera.x + normal.y * toCamera.y + normal.z * toCamera.z > 0;
}

// Exact top/bottom silhouette for the projected sphere in the vertical camera
// plane. Camera framing, the Canvas fallback, and zoom-limit calculations all
// use this same geometry so no decorative circle can drift away from WebGL.
export function projectedSphereVerticalBounds(camera, radius) {
  const center = viewTiltPoint({ x: 0, y: 0, z: camera.centerZ }, camera, radius);
  const y = center.y;
  const z = center.z;
  const r2 = radius * radius;
  const d2 = y * y + z * z;
  if (d2 <= r2 + 1e-8 || z <= 0) return null;

  const denominator = z * z - r2;
  if (Math.abs(denominator) < 1e-9) return null;
  const tangent = radius * Math.sqrt(Math.max(0, d2 - r2));
  const slopeA = (y * z + tangent) / denominator;
  const slopeB = (y * z - tangent) / denominator;
  const screenA = camera.cy - camera.focal * slopeA;
  const screenB = camera.cy - camera.focal * slopeB;

  return {
    top: Math.min(screenA, screenB),
    bottom: Math.max(screenA, screenB),
    centerY: (screenA + screenB) / 2,
  };
}

export function apparentSphereRadius(camera, radius) {
  const bounds = projectedSphereVerticalBounds(camera, radius);
  return bounds ? (bounds.bottom - bounds.top) / 2 : 0;
}

export function fibonacciSphere(count) {
  const out = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - ((i + 0.5) / count) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const a = golden * i;
    out[i * 3] = Math.cos(a) * r;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = Math.sin(a) * r;
  }
  return out;
}

export function projectedTangentFrame(unit, camera, radius, width, height) {
  const center = projectSpherePoint(unit, camera, radius);
  if (!center) return null;
  const { u, v } = tangentBasis(unit);
  const halfW = width / 2;
  const halfH = height / 2;
  const pu = normalize({
    x: unit.x + u.x * halfW / radius,
    y: unit.y + u.y * halfW / radius,
    z: unit.z + u.z * halfW / radius,
  });
  const pv = normalize({
    x: unit.x + v.x * halfH / radius,
    y: unit.y + v.y * halfH / radius,
    z: unit.z + v.z * halfH / radius,
  });
  const su = projectSpherePoint(pu, camera, radius);
  const sv = projectSpherePoint(pv, camera, radius);
  if (!su || !sv) return null;
  return {
    center,
    xAxis: { x: su.x - center.x, y: su.y - center.y },
    yAxis: { x: sv.x - center.x, y: sv.y - center.y },
  };
}

export function slerpUnit(a, b, t) {
  const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
  const angle = Math.acos(dot);
  if (angle < 1e-8) {
    return normalize({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
    });
  }
  const sinAngle = Math.sin(angle);
  const wa = Math.sin((1 - t) * angle) / sinAngle;
  const wb = Math.sin(t * angle) / sinAngle;
  return normalize({
    x: a.x * wa + b.x * wb,
    y: a.y * wa + b.y * wb,
    z: a.z * wa + b.z * wb,
  });
}

export function normalize(p) {
  const len = Math.hypot(p.x, p.y, p.z) || 1;
  return { x: p.x / len, y: p.y / len, z: p.z / len };
}

export function yawPitchToFront(unit) {
  const yaw = Math.atan2(unit.x, -unit.z);
  const afterYaw = rotatePoint(unit, yaw, 0);
  const pitch = -Math.atan2(afterYaw.y, -afterYaw.z);
  return { yaw, pitch };
}
