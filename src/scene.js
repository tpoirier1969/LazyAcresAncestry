export * from './scene-core.js';

import { layoutSample } from './layout.js';
import { spreadFamilyLayout } from './layout-spacing.js';
import {
  GlobeScene as CoreGlobeScene,
  buildRelationshipGroups,
  planFamilyRoutes,
} from './scene-core.js';

const ROUTE_WORKER_THRESHOLD = 700;
const DENSITY_WARNING_COUNT = 110;
const DENSITY_SEVERE_COUNT = 180;
const RELATIONSHIP_OVERVIEW_HIDE_GAP = 58;
const MOVING_PLAQUE_MIN_WIDTH_PX = 30;

export class GlobeScene extends CoreGlobeScene {
  constructor(...args) {
    super(...args);
    this.routeWorker = null;
    this.fullPeople = [];
    this.fullRelationships = [];
    this.visibleIds = new Set();
    this.collapsedRoots = new Set();
    this.lastDensityCount = null;
    this.installTreeViewControls();
  }

  setFamily(people, relationships = []) {
    this.fullPeople = people;
    this.fullRelationships = relationships;
    this.collapsedRoots.clear();
    this.setVisibleFamily(people, relationships);
    this.updateTreeViewControls();
  }

  setVisibleFamily(people, relationships = []) {
    this.clearHover();
    this.routeWorker?.terminate();
    this.routeWorker = null;

    this.people = people;
    this.relationships = relationships;
    this.visibleIds = new Set(people.map(person => person.id));
    this.homeId = people.find(person => person.role === 'root')?.id || people[0]?.id || null;
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
    if (this.fullPeople.length && !this.visibleIds.has(id)) {
      this.collapsedRoots.clear();
      this.applyCollapsedView();
    }
    super.focus(id, options);
    this.updateTreeViewControls();
  }

  drawRelationships(camera) {
    const moving = Boolean(this.drag || this.motionFrame || this.focusFrame);
    const gap = camera.centerZ - this.radius;
    if (moving || gap > RELATIONSHIP_OVERVIEW_HIDE_GAP) return;
    super.drawRelationships(camera);
  }

  drawPeople(camera) {
    super.drawPeople(camera);
    if (this.drag || this.motionFrame || this.focusFrame) return;
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

  installTreeViewControls() {
    const shell = this.canvas?.closest?.('.atlas-shell');
    if (!shell || shell.querySelector('.tree-view-controls')) return;

    const controls = document.createElement('div');
    controls.className = 'tree-view-controls';
    controls.innerHTML = `
      <button type="button" class="branch-collapse" hidden>Collapse descendants</button>
      <button type="button" class="branch-expand-all" hidden>Expand all</button>
      <div class="density-warning" hidden role="status" aria-live="polite"></div>`;
    shell.appendChild(controls);

    this.branchCollapseButton = controls.querySelector('.branch-collapse');
    this.expandAllButton = controls.querySelector('.branch-expand-all');
    this.densityWarning = controls.querySelector('.density-warning');

    this.branchCollapseButton?.addEventListener('click', () => this.toggleFocusedBranch());
    this.expandAllButton?.addEventListener('click', () => {
      this.collapsedRoots.clear();
      this.applyCollapsedView();
    });
  }

  toggleFocusedBranch() {
    const id = this.focusedId;
    if (!id || !this.hasRecordedChildren(id)) return;
    if (this.collapsedRoots.has(id)) this.collapsedRoots.delete(id);
    else this.collapsedRoots.add(id);
    this.applyCollapsedView();
  }

  applyCollapsedView() {
    if (!this.fullPeople.length) return;
    const hidden = descendantIdsHiddenBy(this.collapsedRoots, this.fullPeople, this.fullRelationships);
    const visiblePeople = this.fullPeople.filter(person => !hidden.has(person.id));
    const visibleIds = new Set(visiblePeople.map(person => person.id));
    const visibleRelationships = this.fullRelationships.filter(link => visibleIds.has(link.from) && visibleIds.has(link.to));
    const focusedId = this.focusedId;
    this.setVisibleFamily(visiblePeople, visibleRelationships);
    if (focusedId && visibleIds.has(focusedId)) this.focusedId = focusedId;
    this.lastDensityCount = null;
    this.updateTreeViewControls();
    this.requestDraw();
  }

  hasRecordedChildren(id) {
    return this.fullRelationships.some(link => link.type === 'parent' && link.from === id);
  }

  updateTreeViewControls() {
    if (!this.branchCollapseButton || !this.expandAllButton) return;
    const id = this.focusedId;
    const hasChildren = Boolean(id && this.hasRecordedChildren(id));
    this.branchCollapseButton.hidden = !hasChildren;
    if (hasChildren) {
      this.branchCollapseButton.textContent = this.collapsedRoots.has(id)
        ? 'Expand descendants'
        : 'Collapse descendants';
    }
    this.expandAllButton.hidden = this.collapsedRoots.size === 0;
    if (this.collapsedRoots.size) {
      const hiddenCount = Math.max(0, this.fullPeople.length - this.people.length);
      this.expandAllButton.textContent = `Expand all · ${hiddenCount} hidden`;
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
      ? `Very dense view · ${count} people visible. Focus a family and collapse descendants.`
      : `Dense view · ${count} people visible. Collapse a descendant branch for a cleaner chart.`;
  }
}

export function descendantIdsHiddenBy(collapsedRoots, people, relationships) {
  if (!collapsedRoots?.size) return new Set();
  const knownIds = new Set((people || []).map(person => person.id));
  const byId = new Map((people || []).map(person => [person.id, person]));
  const children = new Map();
  const spouseLinks = [];

  (relationships || []).forEach(link => {
    if (link.type === 'parent' && knownIds.has(link.from) && knownIds.has(link.to)) {
      if (!children.has(link.from)) children.set(link.from, new Set());
      children.get(link.from).add(link.to);
    } else if (link.type === 'spouse' && knownIds.has(link.from) && knownIds.has(link.to)) {
      spouseLinks.push(link);
    }
  });

  const hidden = new Set();
  const queue = [];
  collapsedRoots.forEach(rootId => {
    for (const childId of children.get(rootId) || []) queue.push(childId);
  });

  while (queue.length) {
    const id = queue.shift();
    if (hidden.has(id) || collapsedRoots.has(id)) continue;
    hidden.add(id);
    for (const childId of children.get(id) || []) queue.push(childId);
  }

  let changed = true;
  while (changed) {
    changed = false;
    spouseLinks.forEach(link => {
      const fromHidden = hidden.has(link.from);
      const toHidden = hidden.has(link.to);
      if (fromHidden === toHidden) return;
      const supportId = fromHidden ? link.to : link.from;
      const support = byId.get(supportId);
      if (!isSupportingSpouse(support) || collapsedRoots.has(supportId)) return;
      hidden.add(supportId);
      changed = true;
    });
  }

  return hidden;
}

function isSupportingSpouse(person) {
  if (!person) return false;
  if (person.role === 'one-step-spouse') return true;
  return ['spouse', 'co-parent', 'descendant-co-parent'].includes(person.proofExpansionKind);
}

function pairKey(a, b) {
  return [a, b].sort().join('|');
}
