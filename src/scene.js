export * from './scene-core.js';

import { layoutSample } from './layout.js';
import {
  GlobeScene as CoreGlobeScene,
  buildRelationshipGroups,
  planFamilyRoutes,
} from './scene-core.js';

const ROUTE_WORKER_THRESHOLD = 700;

export class GlobeScene extends CoreGlobeScene {
  constructor(...args) {
    super(...args);
    this.routeWorker = null;
  }

  setFamily(people, relationships = []) {
    this.clearHover();
    this.routeWorker?.terminate();
    this.routeWorker = null;

    this.people = people;
    this.relationships = relationships;
    this.homeId = people.find(person => person.role === 'root')?.id || people[0]?.id || null;
    this.positions = layoutSample(people, this.radius, relationships);

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
}

function pairKey(a, b) {
  return [a, b].sort().join('|');
}
