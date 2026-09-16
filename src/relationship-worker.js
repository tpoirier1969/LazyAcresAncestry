import { planFamilyRoutes } from './scene-core.js';

self.onmessage = event => {
  const { token, familyGroups = [], positions = [], radius } = event.data || {};
  try {
    const byId = new Map(positions);
    const routes = planFamilyRoutes(
      familyGroups,
      id => surfaceXY(byId.get(id), radius),
    );
    self.postMessage({ token, routes });
  } catch (error) {
    self.postMessage({
      token,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

function surfaceXY(unit, radius) {
  if (!unit) return null;
  const r = Math.max(1e-6, Number(radius) || 1);
  const theta = Math.acos(clamp(-unit.z, -1, 1));
  const s = Math.sin(theta);
  if (Math.abs(s) < 1e-7) return { x: 0, y: 0 };
  const d = r * theta;
  return { x: d * unit.x / s, y: d * unit.y / s };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
