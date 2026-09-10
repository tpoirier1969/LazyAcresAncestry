export function rigidPlaquePlacement(frame, textureWidth, textureHeight) {
  if (!frame || !frame.anchor || !frame.xAxis || !textureWidth || !textureHeight) return null;

  const halfWidth = Math.hypot(frame.xAxis.x, frame.xAxis.y);
  const width = halfWidth * 2;
  if (!Number.isFinite(width) || width <= 0) return null;

  // Preserve the plaque artwork's native aspect ratio. The plaque is a rigid
  // physical object whose lower-center hinge remains attached to the sphere.
  // Sphere curvature/orientation changes the plaque's position and rotation,
  // but never stretches a portrait into an egg.
  const scale = width / textureWidth;
  const height = textureHeight * scale;
  const angle = Math.atan2(frame.xAxis.y, frame.xAxis.x);
  const down = { x: -Math.sin(angle), y: Math.cos(angle) };
  const center = {
    x: frame.anchor.x - down.x * height * 0.5,
    y: frame.anchor.y - down.y * height * 0.5,
  };

  return { width, height, scale, angle, center, down, anchor: frame.anchor };
}
