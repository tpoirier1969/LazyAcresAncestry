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
    ux = 1; uy = 0; uz = 0; len = 1;
  }
  ux /= len; uy /= len; uz /= len;
  const vx = unit.y * uz - unit.z * uy;
  const vy = unit.z * ux - unit.x * uz;
  const vz = unit.x * uy - unit.y * ux;
  return { u: { x: ux, y: uy, z: uz }, v: { x: vx, y: vy, z: vz } };
}

export function rotatePoint(p, yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
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

export function projectSpherePoint(unit, camera, radius) {
  return projectLocalPoint({
    x: radius * unit.x,
    y: radius * unit.y,
    z: radius * unit.z,
  }, camera);
}

export function isVisible(unit, projected) {
  if (!projected) return false;
  const toCamera = {
    x: -projected.world.x,
    y: -projected.world.y,
    z: -projected.world.z,
  };
  return unit.x * toCamera.x + unit.y * toCamera.y + unit.z * toCamera.z > 0;
}

export function apparentSphereRadius(camera, radius) {
  const d = camera.centerZ;
  return camera.focal * radius / Math.sqrt(Math.max(1e-6, d * d - radius * radius));
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
  const pu = normalize({ x: unit.x + u.x * halfW / radius, y: unit.y + u.y * halfW / radius, z: unit.z + u.z * halfW / radius });
  const pv = normalize({ x: unit.x + v.x * halfH / radius, y: unit.y + v.y * halfH / radius, z: unit.z + v.z * halfH / radius });
  const su = projectSpherePoint(pu, camera, radius);
  const sv = projectSpherePoint(pv, camera, radius);
  if (!su || !sv) return null;
  return {
    center,
    xAxis: { x: su.x - center.x, y: su.y - center.y },
    yAxis: { x: sv.x - center.x, y: sv.y - center.y },
  };
}

// Models a fixed-size physical plaque hinged at its lower edge. The lower edge
// stays attached to the sphere, while the plaque rotates around its horizontal
// axis toward the camera. That keeps portraits legible away from the viewing
// apex without turning the plaque into a screen-space overlay.
export function projectedRaisedFrame(unit, camera, radius, width, height, cameraFacing = 0.88) {
  const { u } = tangentBasis(unit);
  const halfW = width / 2;
  const halfH = height / 2;
  const anchor = { x: unit.x * radius, y: unit.y * radius, z: unit.z * radius };
  const cameraPoint = { x: 0, y: 0, z: -camera.centerZ };
  const toCamera = normalize({
    x: cameraPoint.x - anchor.x,
    y: cameraPoint.y - anchor.y,
    z: cameraPoint.z - anchor.z,
  });

  // Constrain the camera-facing normal to a hinge rotation around the plaque's
  // horizontal tangent axis. Blending keeps a little of the globe's local
  // orientation so distant plaques still feel planted on the atlas.
  const tangentNormal = unit;
  const viewDotU = toCamera.x * u.x + toCamera.y * u.y + toCamera.z * u.z;
  const hingedViewNormal = normalize({
    x: toCamera.x - u.x * viewDotU,
    y: toCamera.y - u.y * viewDotU,
    z: toCamera.z - u.z * viewDotU,
  });
  const normal = normalize({
    x: tangentNormal.x * (1 - cameraFacing) + hingedViewNormal.x * cameraFacing,
    y: tangentNormal.y * (1 - cameraFacing) + hingedViewNormal.y * cameraFacing,
    z: tangentNormal.z * (1 - cameraFacing) + hingedViewNormal.z * cameraFacing,
  });

  let down = normalize(cross(normal, u));
  const tangentDown = tangentBasis(unit).v;
  if (down.x * tangentDown.x + down.y * tangentDown.y + down.z * tangentDown.z < 0) {
    down = { x: -down.x, y: -down.y, z: -down.z };
  }

  const centerLocal = {
    x: anchor.x - down.x * halfH,
    y: anchor.y - down.y * halfH,
    z: anchor.z - down.z * halfH,
  };
  const sideLocal = {
    x: centerLocal.x + u.x * halfW,
    y: centerLocal.y + u.y * halfW,
    z: centerLocal.z + u.z * halfW,
  };
  const lowerLocal = {
    x: centerLocal.x + down.x * halfH,
    y: centerLocal.y + down.y * halfH,
    z: centerLocal.z + down.z * halfH,
  };

  const center = projectLocalPoint(centerLocal, camera);
  const side = projectLocalPoint(sideLocal, camera);
  const lower = projectLocalPoint(lowerLocal, camera);
  const anchorProjected = projectLocalPoint(anchor, camera);
  if (!center || !side || !lower || !anchorProjected) return null;

  return {
    center,
    anchor: anchorProjected,
    xAxis: { x: side.x - center.x, y: side.y - center.y },
    yAxis: { x: lower.x - center.x, y: lower.y - center.y },
    normal,
  };
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function slerpUnit(a, b, t) {
  const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
  const angle = Math.acos(dot);
  if (angle < 1e-8) return normalize({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
  const sinAngle = Math.sin(angle);
  const wa = Math.sin((1 - t) * angle) / sinAngle;
  const wb = Math.sin(t * angle) / sinAngle;
  return normalize({ x: a.x * wa + b.x * wb, y: a.y * wa + b.y * wb, z: a.z * wa + b.z * wb });
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
