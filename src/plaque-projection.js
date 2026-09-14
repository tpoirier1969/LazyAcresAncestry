export function rigidPlaquePlacement(frame, textureWidth, textureHeight) {
  if (
    !frame
    || !frame.center
    || !frame.xAxis
    || !frame.yAxis
    || !textureWidth
    || !textureHeight
  ) return null;

  const halfTextureWidth = textureWidth / 2;
  const halfTextureHeight = textureHeight / 2;
  const halfWidth = Math.hypot(frame.xAxis.x, frame.xAxis.y);
  const halfHeight = Math.hypot(frame.yAxis.x, frame.yAxis.y);
  const width = halfWidth * 2;
  const height = halfHeight * 2;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;

  // Map the native plaque artwork onto the projected physical surface plane.
  // Both projected axes are preserved so plaques naturally foreshorten with
  // the sphere rather than turning into screen-facing badges.
  const a = frame.xAxis.x / halfTextureWidth;
  const b = frame.xAxis.y / halfTextureWidth;
  const c = frame.yAxis.x / halfTextureHeight;
  const d = frame.yAxis.y / halfTextureHeight;
  const e = frame.center.x;
  const f = frame.center.y;
  const determinant = a * d - b * c;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-10) return null;

  return {
    width,
    height,
    a,
    b,
    c,
    d,
    e,
    f,
    determinant,
    center: frame.center,
    anchor: frame.anchor || frame.center,
  };
}
