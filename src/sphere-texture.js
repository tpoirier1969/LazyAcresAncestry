import { isVisible, projectSpherePoint, rotatePoint } from './geometry.js';

export function atlasUnitFromUv(u, v) {
  const lon = (u - 0.5) * Math.PI * 2;
  const lat = (0.5 - v) * Math.PI;
  const cosLat = Math.cos(lat);
  return { x: Math.sin(lon) * cosLat, y: Math.sin(lat), z: -Math.cos(lon) * cosLat };
}

export function projectAtlasVertex(u, v, yaw, pitch, camera, radius) {
  const local = atlasUnitFromUv(u, v);
  const unit = rotatePoint(local, yaw, pitch);
  const projected = projectSpherePoint(unit, camera, radius);
  return { local, unit, projected, visible: isVisible(unit, projected) };
}

export function triangleAffine(source, destination) {
  const [s0, s1, s2] = source;
  const [d0, d1, d2] = destination;
  const det = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(det) < 1e-9) return null;
  const a = (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / det;
  const c = (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / det;
  const e = (d0.x * (s1.x * s2.y - s2.x * s1.y) + d1.x * (s2.x * s0.y - s0.x * s2.y) + d2.x * (s0.x * s1.y - s1.x * s0.y)) / det;
  const b = (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / det;
  const d = (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / det;
  const f = (d0.y * (s1.x * s2.y - s2.x * s1.y) + d1.y * (s2.x * s0.y - s0.x * s2.y) + d2.y * (s0.x * s1.y - s1.x * s0.y)) / det;
  return { a, b, c, d, e, f };
}

export function drawTexturedTriangle(ctx, image, source, destination, sourceBounds = null) {
  if (destination.some(point => !point)) return false;
  const affine = triangleAffine(source, destination);
  if (!affine) return false;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(destination[0].x, destination[0].y);
  ctx.lineTo(destination[1].x, destination[1].y);
  ctx.lineTo(destination[2].x, destination[2].y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(affine.a, affine.b, affine.c, affine.d, affine.e, affine.f);
  if (sourceBounds) {
    const { sx, sy, sw, sh } = sourceBounds;
    ctx.drawImage(image, sx, sy, sw, sh, sx, sy, sw, sh);
  } else {
    ctx.drawImage(image, 0, 0);
  }
  ctx.restore();
  return true;
}
