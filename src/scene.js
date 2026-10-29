export * from './scene-core.js';

import { layoutSample } from './layout.js';
import { spreadFamilyLayout } from './layout-spacing.js';
import {
  DEFAULT_VISIBLE_PEOPLE,
  branchControlFamilies,
  descendantFamilyIds,
  lineageWindowIds,
  parentBranchControls,
  familyExpansionGroups,
  visibleIdsForExpandedFamilies,
} from './tree-view.js';
import {
  GlobeScene as CoreGlobeScene,
  buildRelationshipGroups,
  planFamilyRoutes,
} from './scene-core.js';

const ROUTE_WORKER_THRESHOLD = 450;
const DENSITY_WARNING_COUNT = 110;
const DENSITY_SEVERE_COUNT = 180;
const MOVING_PLAQUE_MIN_WIDTH_PX = 30;
const BRANCH_CONTROL_MIN_HIT_RADIUS = 16;

export class GlobeScene extends CoreGlobeScene {
  constructor(...args) {
    super(...args);
    this.routeWorker = null;
    this.fullPeople = [];
    this.fullRelationships = [];
    this.visibleIds = new Set();
    this.baseVisibleIds = new Set();
    this.expandedFamilyIds = new Set();
    this.revealedParentFamilyIds = new Set();
    this.pinnedFamilyIds = new Set();
    this.activeFamilyId = null;
    this.branchFamilies = [];
    this.parentBranchFamilies = [];
    this.branchControlAreas = [];
    this.viewTargetId = null;
    this.lastDensityCount = null;
    this.lineageHighlight = null;
    this.installTreeViewControls();
  }

  setFamily(people, relationships = []) {
    this.fullPeople = people;
    this.fullRelationships = relationships;
    this.homeId = people.find(person => person.role === 'root')?.id || people[0]?.id || null;
    this.viewTargetId = this.homeId;
    this.expandedFamilyIds.clear();
    this.revealedParentFamilyIds.clear();
    this.pinnedFamilyIds.clear();
    this.activeFamilyId = null;
    this.baseVisibleIds = lineageWindowIds(
      this.viewTargetId,
      this.fullPeople,
      this.fullRelationships,
      DEFAULT_VISIBLE_PEOPLE,
    );
    this.applyWindowView();
  }

  setVisibleFamily(people, relationships = []) {
    this.clearHover();
    this.routeWorker?.terminate();
    this.routeWorker = null;

    this.people = people;
    this.relationships = relationships;
    this.visibleIds = new Set(people.map(person => person.id));
    if (!this.homeId) this.homeId = people.find(person => person.role === 'root')?.id || people[0]?.id || null;
    const basePositions = layoutSample(people, this.radius, relationships);
    this.positions = spreadFamilyLayout(basePositions, people, relationships, this.radius);

    const token = ++this.relationshipPlanToken;
    const knownIds = new Set(this.positions.keys());
    const { spousePairs, familyGroups, ancestryStubs } = buildRelationshipGroups(
      this.relationships,
      knownIds,
      this.people,
    );
    const familyPairKeys = new Set(
      familyGroups
        .filter(group => group.parents.length >= 2)
        .map(group => pairKey(group.parents[0], group.parents[1])),
    );
    const basePlan = {
      spousePairs,
      familyGroups,
      ancestryStubs,
      familyPairKeys,
      familyRoutes: [],
      ready: false,
    };
    this.relationshipPlan = basePlan;
    this.requestDraw();

    if (people.length >= ROUTE_WORKER_THRESHOLD && typeof Worker === 'function') {
      const worker = new Worker(new URL('./relationship-worker.js', import.meta.url), { type: 'module' });
      this.routeWorker = worker;
      worker.onmessage = event => {
        const message = event.data || {};
        if (message.token !== this.relationshipPlanToken || token !== this.relationshipPlanToken) return;
        if (message.error) {
          console.error(`Relationship route worker failed: ${message.error}`);
          worker.terminate();
          if (this.routeWorker === worker) this.routeWorker = null;
          return;
        }
        this.relationshipPlan = {
          ...basePlan,
          familyRoutes: Array.isArray(message.routes) ? message.routes : [],
          ready: true,
        };
        worker.terminate();
        if (this.routeWorker === worker) this.routeWorker = null;
        this.requestDraw();
      };
      worker.onerror = error => {
        console.error('Relationship route worker failed', error);
        worker.terminate();
        if (this.routeWorker === worker) this.routeWorker = null;
      };
      worker.postMessage({
        token,
        familyGroups,
        positions: [...this.positions.entries()],
        radius: this.radius,
      });
      return;
    }

    const familyRoutes = planFamilyRoutes(
      familyGroups,
      id => this.surfaceXY(this.positions.get(id)),
    );
    if (token !== this.relationshipPlanToken) return;
    this.relationshipPlan = { ...basePlan, familyRoutes, ready: true };
    this.requestDraw();
  }

  focus(id, options = {}) {
    if (this.fullPeople.length && !this.visibleIds.has(id)) this.setViewTarget(id);
    super.focus(id, options);
    this.setLineageHighlight(id);
    this.updateTreeViewControls();
  }

  setViewTarget(id) {
    if (!this.fullPeople.some(person => person.id === id)) return;
    this.viewTargetId = id;
    this.expandedFamilyIds.clear();
    this.revealedParentFamilyIds.clear();
    this.pinnedFamilyIds.clear();
    this.activeFamilyId = null;
    this.baseVisibleIds = lineageWindowIds(
      id,
      this.fullPeople,
      this.fullRelationships,
      DEFAULT_VISIBLE_PEOPLE,
    );
    this.applyWindowView();
  }

  setLineageHighlight(id) {
    const parents = new Map();
    const children = new Map();
    for (const link of this.fullRelationships) {
      if (link.type !== 'parent') continue;
      if (!parents.has(link.to)) parents.set(link.to, new Set());
      if (!children.has(link.from)) children.set(link.from, new Set());
      parents.get(link.to).add(link.from);
      children.get(link.from).add(link.to);
    }
    const trace = adjacency => {
      const seen = new Set();
      const queue = [id];
      while (queue.length) {
        const current = queue.shift();
        for (const next of adjacency.get(current) || []) {
          if (next === id || seen.has(next)) continue;
          seen.add(next);
          queue.push(next);
        }
      }
      return seen;
    };
    this.lineageHighlight = { selected: id, ancestors: trace(parents), descendants: trace(children) };
    this.requestDraw();
  }

  drawRelationships(camera) {
    super.drawRelationships(camera);
  }

  drawPeople(camera) {
    super.drawPeople(camera);
    this.branchControlAreas = [];
    const moving = Boolean(this.drag || this.motionFrame || this.focusFrame);
    // Keep branch arrows visible and their hit areas synchronized with the
    // moving plaques while the globe is dragged, zoomed, or focused.
    this.drawBranchControls();
    if (moving) return;
    const count = this.hitAreas.length;
    if (count === this.lastDensityCount) return;
    this.lastDensityCount = count;
    this.updateDensityWarning(count);
  }

  drawPlaque(entry, camera) {
    const moving = Boolean(this.drag || this.motionFrame || this.focusFrame);
    if (moving) {
      const approximateWidth = 1.20 * (Number(entry?.projected?.scale) || 0);
      if (approximateWidth < MOVING_PLAQUE_MIN_WIDTH_PX) return;
    }
    super.drawPlaque(entry, camera);

  }

  drawBranchControls() {
    const ctx = this.ctx;
    const hitsById = new Map(this.hitAreas.map(hit => [hit.id, hit]));

    for (const family of [...this.branchFamilies, ...this.parentBranchFamilies]) {
      const isParentControl = family.action === 'expand-parents' || family.action === 'collapse-parents';
      const parentHits = (isParentControl ? family.childIds : family.visibleParentIds).map(id => hitsById.get(id)).filter(Boolean);
      if (!parentHits.length) continue;
      if (parentHits.every(hit => hit.r < BRANCH_CONTROL_MIN_HIT_RADIUS)) continue;

      let x;
      let y;
      let baseRadius;
      if (parentHits.length >= 2) {
        x = parentHits.reduce((sum, hit) => sum + hit.x, 0) / parentHits.length;
        y = parentHits.reduce((sum, hit) => sum + hit.y, 0) / parentHits.length;
        baseRadius = Math.max(...parentHits.map(hit => hit.r));
        y += Math.max(11, baseRadius * 0.60);
      } else {
        const hit = parentHits[0];
        x = hit.x + Math.max(14, hit.r * 0.72);
        y = hit.y + Math.max(4, hit.r * 0.18);
        baseRadius = hit.r;
      }

      if (isParentControl) {
        x = parentHits.reduce((sum, hit) => sum + hit.x, 0) / parentHits.length;
        y = Math.min(...parentHits.map(hit => hit.y - hit.r)) - 13;
      }
      const radius = Math.max(9, Math.min(13, baseRadius * 0.24));
      const action = family.action;

      ctx.save();
      ctx.shadowColor = 'rgba(48,31,20,.22)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetY = 1;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(244,226,190,.97)';
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(112,63,50,.92)';
      ctx.lineWidth = 1.35;
      ctx.stroke();

      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(101,49,40,.98)';
      ctx.lineWidth = Math.max(1.7, radius * 0.18);
      if (action === 'expand' || action === 'expand-parents') {
        ctx.moveTo(x - radius * 0.38, y - radius * 0.18);
        ctx.lineTo(x, y + radius * 0.22);
        ctx.lineTo(x + radius * 0.38, y - radius * 0.18);
      } else {
        ctx.moveTo(x - radius * 0.38, y + radius * 0.18);
        ctx.lineTo(x, y - radius * 0.22);
        ctx.lineTo(x + radius * 0.38, y + radius * 0.18);
      }
      ctx.stroke();
      ctx.restore();

      this.branchControlAreas.push({
        familyId: family.familyId,
        action,
        x,
        y,
        r: radius + 4,
        z: Math.min(...parentHits.map(hit => hit.z)),
      });
    }
  }

  pick(x, y) {
    const controls = this.branchControlAreas
      .filter(hit => Math.hypot(x - hit.x, y - hit.y) <= hit.r)
      .sort((a, b) => a.z - b.z);
    if (controls.length) {
      this.toggleFamilyBranch(controls[0].familyId, controls[0].action);
      return;
    }
    super.pick(x, y);
  }

  toggleFamilyBranch(familyId, action) {
    const opening = action === 'expand' || action === 'expand-parents';
    if (opening) {
      // Keep the immediate-family overview, but close other unpinned
      // manually opened branches when the user explores a new one.
      for (const id of [...this.expandedFamilyIds]) {
        if (id !== familyId && !this.pinnedFamilyIds.has(id)) this.expandedFamilyIds.delete(id);
      }
      for (const id of [...this.revealedParentFamilyIds]) {
        if (id !== familyId && !this.pinnedFamilyIds.has(id)) this.revealedParentFamilyIds.delete(id);
      }
      this.activeFamilyId = familyId;
      if (action === 'expand-parents') this.revealedParentFamilyIds.add(familyId);
      else this.expandedFamilyIds.add(familyId);
    } else if (action === 'collapse-parents') {
      this.revealedParentFamilyIds.delete(familyId);
      this.pinnedFamilyIds.delete(familyId);
    } else if (action === 'collapse') {
      const below = descendantFamilyIds(familyId, this.fullPeople, this.fullRelationships);
      this.expandedFamilyIds.delete(familyId);
      this.pinnedFamilyIds.delete(familyId);
      for (const id of below) {
        this.expandedFamilyIds.delete(id);
        this.pinnedFamilyIds.delete(id);
      }
    }
    if (!opening && this.activeFamilyId === familyId) this.activeFamilyId = null;
    this.applyWindowView();
  }

  toggleActiveBranchPin() {
    if (!this.activeFamilyId) return;
    if (this.pinnedFamilyIds.has(this.activeFamilyId)) this.pinnedFamilyIds.delete(this.activeFamilyId);
    else this.pinnedFamilyIds.add(this.activeFamilyId);
    this.updateTreeViewControls();
  }

  installTreeViewControls() {
    const shell = this.canvas?.closest?.('.atlas-shell');
    if (!shell || shell.querySelector('.tree-view-controls')) return;

    const controls = document.createElement('div');
    controls.className = 'tree-view-controls';
    controls.innerHTML = `
      <button type="button" class="tree-reset" hidden>Reset expansions</button>
      <button type="button" class="tree-pin" hidden>Pin active branch</button>
      <div class="tree-window-count" aria-live="polite"></div>
      <div class="density-warning" hidden role="status" aria-live="polite"></div>`;
    shell.appendChild(controls);

    this.resetTreeButton = controls.querySelector('.tree-reset');
    this.pinTreeButton = controls.querySelector('.tree-pin');
    this.pinTreeButton?.addEventListener('click', () => this.toggleActiveBranchPin());
    this.treeWindowCount = controls.querySelector('.tree-window-count');
    this.densityWarning = controls.querySelector('.density-warning');

    this.resetTreeButton?.addEventListener('click', () => {
      this.expandedFamilyIds.clear();
      this.revealedParentFamilyIds.clear();
      this.pinnedFamilyIds.clear();
      this.activeFamilyId = null;
      this.applyWindowView();
    });
  }

  applyWindowView() {
    if (!this.fullPeople.length) return;
    const visibleIds = visibleIdsForExpandedFamilies(
      this.baseVisibleIds,
      this.expandedFamilyIds,
      this.fullPeople,
      this.fullRelationships,
    );
    // Ancestor expansion is explicit and never triggered by camera zoom.
    // Family groups are indexed independently of visibility for parent reveals.
    const allFamilyGroups = familyExpansionGroups(new Set(this.fullPeople.map(person => person.id)), this.fullRelationships);
    for (const familyId of this.revealedParentFamilyIds) {
      const family = allFamilyGroups.get(familyId);
      if (!family) continue;
      for (const id of [...family.parentIds, ...family.childIds]) visibleIds.add(id);
    }
    const previousFocus = this.focusedId;
    if (previousFocus && !visibleIds.has(previousFocus)) this.focusedId = this.viewTargetId;
    if (this.focusedId) visibleIds.add(this.focusedId);

    const visiblePeople = this.fullPeople.filter(person => visibleIds.has(person.id));
    const actualIds = new Set(visiblePeople.map(person => person.id));
    const visibleRelationships = this.fullRelationships.filter(
      link => actualIds.has(link.from) && actualIds.has(link.to),
    );

    this.parentBranchFamilies = parentBranchControls(actualIds, this.fullPeople, this.fullRelationships)
      .filter(family => !this.revealedParentFamilyIds.has(family.familyId));
    for (const familyId of this.revealedParentFamilyIds) {
      const family = allFamilyGroups.get(familyId);
      if (family && family.childIds.some(id => actualIds.has(id))) {
        this.parentBranchFamilies.push({ ...family, action: 'collapse-parents' });
      }
    }
    this.branchFamilies = branchControlFamilies(
      actualIds,
      this.expandedFamilyIds,
      this.fullPeople,
      this.fullRelationships,
    );
    this.setVisibleFamily(visiblePeople, visibleRelationships);
    this.lastDensityCount = null;
    this.updateTreeViewControls();
    this.requestDraw();
  }

  updateTreeViewControls() {
    if (!this.resetTreeButton) return;
    this.resetTreeButton.hidden = this.expandedFamilyIds.size === 0 && this.revealedParentFamilyIds.size === 0;
    if (this.pinTreeButton) {
      this.pinTreeButton.hidden = !this.activeFamilyId;
      this.pinTreeButton.textContent = this.pinnedFamilyIds.has(this.activeFamilyId) ? 'Unpin active branch' : 'Pin active branch';
    }

    if (this.treeWindowCount) {
      const targetName = this.fullPeople.find(person => person.id === this.viewTargetId)?.name || 'target person';
      this.treeWindowCount.textContent = `${this.people.length.toLocaleString()} of ${this.fullPeople.length.toLocaleString()} shown · lineage-first around ${targetName} · cousins through 2nd · branch arrows reveal more`;
    }
  }

  updateDensityWarning(count) {
    if (!this.densityWarning) return;
    if (count < DENSITY_WARNING_COUNT) {
      this.densityWarning.hidden = true;
      this.densityWarning.textContent = '';
      return;
    }
    this.densityWarning.hidden = false;
    this.densityWarning.classList.toggle('severe', count >= DENSITY_SEVERE_COUNT);
    this.densityWarning.textContent = count >= DENSITY_SEVERE_COUNT
      ? `Very dense view · ${count} people readable here. Open additional family branches selectively.`
      : `Dense view · ${count} people readable here. Branch arrows reveal more only where you need it.`;
  }
}

function pairKey(a, b) {
  return [a, b].sort().join('|');
}
