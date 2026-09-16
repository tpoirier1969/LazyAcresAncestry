import { tangentPoint } from './geometry.js';

export const FAMILY_VIEW_SPACING = Object.freeze({
  COUPLE_GAP: 1.58,
  SIBLING_UNIT_GAP: 2.32,
  FAMILY_BLOCK_GAP: 4.65,
  MIN_PERSON_GAP: 1.52,
});

export function spreadFamilyLayout(positions, people, relationships, radius) {
  if (!positions?.size || !people?.length) return positions;

  const planar = new Map();
  positions.forEach((unit, id) => {
    const point = surfaceXY(unit, radius);
    if (point) planar.set(id, point);
  });

  const byId = new Map(people.map(person => [person.id, person]));
  const rowIds = new Map();
  planar.forEach((point, id) => {
    const key = rowKey(point.y);
    if (!rowIds.has(key)) rowIds.set(key, []);
    rowIds.get(key).push(id);
  });

  const spouseAdjacency = buildSpouseAdjacency(relationships);
  const originFamily = buildOriginFamilyMap(relationships);

  rowIds.forEach(ids => {
    if (ids.length < 2) return;
    const anchorIds = ids.filter(id => Number.isFinite(byId.get(id)?.directAncestorDepth));
    const anchorBefore = anchorIds.length
      ? average(anchorIds.map(id => planar.get(id).x))
      : null;
    const rowSet = new Set(ids);
    const components = buildSpouseComponents(ids, rowSet, spouseAdjacency, planar, byId, originFamily);
    const blocks = buildOriginBlocks(components);
    if (!blocks.length) return;

    const centers = packCenters(blocks, FAMILY_VIEW_SPACING.FAMILY_BLOCK_GAP);
    blocks.forEach((block, blockIndex) => {
      let cursor = centers[blockIndex] - block.width / 2;
      block.components.forEach((component, componentIndex) => {
        if (componentIndex > 0) cursor += FAMILY_VIEW_SPACING.SIBLING_UNIT_GAP;
        const componentCenter = cursor + component.width / 2;
        component.members.forEach(id => {
          const point = planar.get(id);
          if (point) point.x = componentCenter + (component.offsets.get(id) || 0);
        });
        cursor += component.width;
      });
    });

    enforceMinimumGap(ids, planar, FAMILY_VIEW_SPACING.MIN_PERSON_GAP);

    if (anchorIds.length) {
      const anchorAfter = average(anchorIds.map(id => planar.get(id).x));
      const shift = anchorBefore - anchorAfter;
      ids.forEach(id => { planar.get(id).x += shift; });
    }
  });

  const out = new Map();
  planar.forEach((point, id) => out.set(id, tangentPoint(point.x, point.y, radius)));
  return out;
}

function buildSpouseAdjacency(relationships) {
  const map = new Map();
  (relationships || []).forEach(link => {
    if (link.type !== 'spouse') return;
    if (!map.has(link.from)) map.set(link.from, new Set());
    if (!map.has(link.to)) map.set(link.to, new Set());
    map.get(link.from).add(link.to);
    map.get(link.to).add(link.from);
  });
  return map;
}

function buildOriginFamilyMap(relationships) {
  const counts = new Map();
  (relationships || []).forEach(link => {
    if (link.type !== 'parent' || !link.familyId) return;
    if (!counts.has(link.to)) counts.set(link.to, new Map());
    const byFamily = counts.get(link.to);
    byFamily.set(link.familyId, (byFamily.get(link.familyId) || 0) + 1);
  });
  const result = new Map();
  counts.forEach((byFamily, childId) => {
    result.set(childId, [...byFamily.entries()]
      .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0][0]);
  });
  return result;
}

function buildSpouseComponents(ids, rowSet, spouseAdjacency, planar, byId, originFamily) {
  const visited = new Set();
  const components = [];
  [...ids].sort((a, b) => planar.get(a).x - planar.get(b).x).forEach(startId => {
    if (visited.has(startId)) return;
    const stack = [startId];
    const discovered = [];
    visited.add(startId);
    while (stack.length) {
      const id = stack.pop();
      discovered.push(id);
      for (const spouseId of spouseAdjacency.get(id) || []) {
        if (!rowSet.has(spouseId) || visited.has(spouseId)) continue;
        visited.add(spouseId);
        stack.push(spouseId);
      }
    }

    const layout = spouseComponentLayout(discovered, spouseAdjacency, planar);
    const members = layout.members;
    const lineageMember = [...members].sort((a, b) => lineagePriority(byId.get(a)) - lineagePriority(byId.get(b)))[0];
    const familyKey = originFamily.get(lineageMember)
      || members.map(id => byId.get(id)?.cluster).find(Boolean)
      || `unit:${members.join('|')}`;
    components.push({
      members,
      offsets: layout.offsets,
      familyKey,
      desiredCenter: layout.desiredCenter,
      width: layout.width,
    });
  });
  return components;
}

function spouseComponentLayout(ids, spouseAdjacency, planar) {
  const ordered = [...ids].sort((a, b) => planar.get(a).x - planar.get(b).x || String(a).localeCompare(String(b)));
  if (ordered.length <= 1) {
    const id = ordered[0];
    return {
      members: ordered,
      offsets: new Map(id ? [[id, 0]] : []),
      desiredCenter: id ? planar.get(id).x : 0,
      width: 0,
    };
  }

  if (ordered.length === 2) {
    const halfGap = FAMILY_VIEW_SPACING.COUPLE_GAP / 2;
    return {
      members: ordered,
      offsets: new Map([[ordered[0], -halfGap], [ordered[1], halfGap]]),
      desiredCenter: average(ordered.map(id => planar.get(id).x)),
      width: FAMILY_VIEW_SPACING.COUPLE_GAP,
    };
  }

  const memberSet = new Set(ordered);
  const spouseDegree = id => [...(spouseAdjacency.get(id) || [])]
    .filter(spouseId => memberSet.has(spouseId)).length;
  const hub = [...ordered].sort((a, b) => (
    spouseDegree(b) - spouseDegree(a)
    || Math.abs(planar.get(a).x) - Math.abs(planar.get(b).x)
    || String(a).localeCompare(String(b))
  ))[0];
  const spouses = ordered.filter(id => id !== hub);
  const offsets = new Map([[hub, 0]]);
  let leftIndex = 0;
  let rightIndex = 0;
  spouses.forEach((id, index) => {
    if (index % 2 === 0) {
      leftIndex += 1;
      offsets.set(id, -FAMILY_VIEW_SPACING.COUPLE_GAP * leftIndex);
    } else {
      rightIndex += 1;
      offsets.set(id, FAMILY_VIEW_SPACING.COUPLE_GAP * rightIndex);
    }
  });

  const sortedMembers = [...ordered].sort((a, b) => offsets.get(a) - offsets.get(b));
  const values = [...offsets.values()];
  return {
    members: sortedMembers,
    offsets,
    desiredCenter: planar.get(hub).x,
    width: Math.max(...values) - Math.min(...values),
  };
}

function buildOriginBlocks(components) {
  const grouped = new Map();
  components.forEach(component => {
    if (!grouped.has(component.familyKey)) grouped.set(component.familyKey, []);
    grouped.get(component.familyKey).push(component);
  });

  return [...grouped.entries()].map(([familyKey, group]) => {
    group.sort((a, b) => a.desiredCenter - b.desiredCenter);
    let width = 0;
    group.forEach((component, index) => {
      if (index > 0) width += FAMILY_VIEW_SPACING.SIBLING_UNIT_GAP;
      width += component.width;
    });
    return {
      familyKey,
      components: group,
      width,
      desiredCenter: average(group.map(component => component.desiredCenter)),
    };
  }).sort((a, b) => a.desiredCenter - b.desiredCenter || String(a.familyKey).localeCompare(String(b.familyKey)));
}

function packCenters(blocks, gap) {
  if (!blocks.length) return [];
  const desired = blocks.map(block => block.desiredCenter);
  const forward = [desired[0]];
  for (let i = 1; i < blocks.length; i += 1) {
    forward[i] = Math.max(desired[i], forward[i - 1] + separation(blocks[i - 1], blocks[i], gap));
  }
  const backward = new Array(blocks.length);
  backward[blocks.length - 1] = desired[blocks.length - 1];
  for (let i = blocks.length - 2; i >= 0; i -= 1) {
    backward[i] = Math.min(desired[i], backward[i + 1] - separation(blocks[i], blocks[i + 1], gap));
  }
  return forward.map((value, index) => (value + backward[index]) / 2);
}

function separation(a, b, gap) {
  return a.width / 2 + b.width / 2 + gap;
}

function enforceMinimumGap(ids, planar, minimum) {
  const ordered = [...ids].filter(id => planar.has(id)).sort((a, b) => planar.get(a).x - planar.get(b).x);
  if (ordered.length < 2) return;
  const xs = ordered.map(id => planar.get(id).x);
  for (let i = 1; i < xs.length; i += 1) xs[i] = Math.max(xs[i], xs[i - 1] + minimum);
  for (let i = xs.length - 2; i >= 0; i -= 1) xs[i] = Math.min(xs[i], xs[i + 1] - minimum);
  const before = average(ordered.map(id => planar.get(id).x));
  const after = average(xs);
  const shift = before - after;
  ordered.forEach((id, index) => { planar.get(id).x = xs[index] + shift; });
}

function lineagePriority(person) {
  const kind = person?.proofExpansionKind || '';
  if (['spouse', 'co-parent', 'descendant-co-parent'].includes(kind)) return 10;
  if (person?.role === 'one-step-spouse') return 10;
  return 0;
}

function rowKey(y) {
  return String(Math.round((Number(y) || 0) * 1000) / 1000);
}

function surfaceXY(unit, radius) {
  if (!unit) return null;
  const theta = Math.acos(clamp(-unit.z, -1, 1));
  const s = Math.sin(theta);
  if (Math.abs(s) < 1e-7) return { x: 0, y: 0 };
  const d = radius * theta;
  return { x: d * unit.x / s, y: d * unit.y / s };
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
