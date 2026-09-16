export * from './scene-core.js';

import { layoutSample } from './layout.js';
import { spreadFamilyLayout } from './layout-spacing.js';
import {
  DEFAULT_VISIBLE_PEOPLE,
  branchControlFamilies,
  descendantFamilyIds,
  nearestPeopleIds,
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
    this.branchFamilies = [];
    this.branchControlAreas = [];
    this.viewTargetId = null;
    this.lastDensityCount = null;
    this.installTreeViewControls();
  }

  setFamily(people, relationships = []) {
    this.fullPeople = people;
    this.fullRelationships = relationships;
    this.homeId = people.find(person => person.role === 'root')?.id || people[0]?.id || null;
    this.viewTargetId = this.homeId;
    this.expandedFamilyIds.clear();
    this.baseVisibleIds = nearestPeopleIds(
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
    this.updateTreeViewControls();
  }

  setViewTarget(id) {
    if (!this.fullPeople.some(person => person.id === id)) return;
    this.viewTargetId = id;
    this.expandedFamilyIds.clear();
    this.baseVisibleIds = nearestPeopleIds(
      id,
      this.fullPeople,
      this.fullRelationships,
      DEFAULT_VISIBLE_PEOPLE,
    );
    this.applyWindowView();
  }

  drawRelationships(camera) {
    super.drawRelationships(camera);
  }

  drawPeople(camera) {
    super.drawPeople(camera);
    this.branchControlAreas = [];
    const moving = Boolean(this.drag || this.motionFrame || this.focusFrame);
    if (!moving) this.drawBranchControls();
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

    for (const family of this.branchFamilies) {
      const parentHits = family.visibleParentIds.map(id => hitsById.get(id)).filter(Boolean);
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
      if (action === 'expand') {
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
    if (action === 'expand') {
      this.expandedFamilyIds.add(familyId);
    } else if (action === 'collapse') {
      const below = descendantFamilyIds(familyId, this.fullPeople, this.fullRelationships);
      this.expandedFamilyIds.delete(familyId);
      for (const descendantFamilyId of below) this.expandedFamilyIds.delete(descendantFamilyId);
    }
    this.applyWindowView();
  }

  installTreeViewControls() {
    const shell = this.canvas?.closest?.('.atlas-shell');
    if (!shell || shell.querySelector('.tree-view-controls')) return;

    const controls = document.createElement('div');
    controls.className = 'tree-view-controls';
    controls.innerHTML = `
      <button type="button" class="tree-reset" hidden>Reset expansions</button>
      <div class="tree-window-count" aria-live="polite"></div>
      <div class="density-warning" hidden role="status" aria-live="polite"></div>`;
    shell.appendChild(controls);

    this.resetTreeButton = controls.querySelector('.tree-reset');
    this.treeWindowCount = controls.querySelector('.tree-window-count');
    this.densityWarning = controls.querySelector('.density-warning');

    this.resetTreeButton?.addEventListener('click', () => {
      this.expandedFamilyIds.clear();
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
    const previousFocus = this.focusedId;
    if (previousFocus && !visibleIds.has(previousFocus)) this.focusedId = this.viewTargetId;
    if (this.focusedId) visibleIds.add(this.focusedId);

    const visiblePeople = this.fullPeople.filter(person => visibleIds.has(person.id));
    const actualIds = new Set(visiblePeople.map(person => person.id));
    const visibleRelationships = this.fullRelationships.filter(
      link => actualIds.has(link.from) && actualIds.has(link.to),
    );

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
    this.resetTreeButton.hidden = this.expandedFamilyIds.size === 0;

    if (this.treeWindowCount) {
      const targetName = this.fullPeople.find(person => person.id === this.viewTargetId)?.name || 'target person';
      const baseCount = Math.min(DEFAULT_VISIBLE_PEOPLE, this.fullPeople.length);
      this.treeWindowCount.textContent = `${this.people.length.toLocaleString()} of ${this.fullPeople.length.toLocaleString()} shown · nearest ${baseCount.toLocaleString()} to ${targetName} · branch arrows reveal more`;
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
