# Lazy Acres Ancestry

Interactive genealogy atlas built from the supplied Ancestry data.

## Current prototype

The app uses a spherical family-atlas view with fixed physical person plaques anchored to the same globe as the map and family connectors. The globe is intentionally larger than the minimum 9,099-person capacity calculation so the visible family neighborhood reads flatter while the edge of the sphere remains visible on the horizon.

The current Supabase sample contains 44 people: Tod, Donna, Amy, Tod's parents, grandparents, and grandparent sibling groups. The renderer remains single-canvas and is intended to scale to the full genealogy without one DOM element per person.

## Unified sphere renderer

The map, family connectors, and person attachment points share one spherical coordinate system and one yaw/pitch rotation around the exact globe center. Nothing pans independently as a screen-space layer.

Person plaques are rigid physical objects, not curved decals. Their lower-center hinge remains attached to the sphere while the plaque tilts toward the camera enough to keep portraits readable. The artwork is always rendered at a uniform scale, so the oval portrait frame and photograph keep their intended proportions instead of stretching with sphere curvature. Person plaques do not cast ground/drop shadows.

## Atlas surface

The globe uses a bundled 4096×2048 antique world-atlas texture (`assets/antique-atlas-texture.svg`). It contains recognizable world coastlines and landmasses rather than invented pseudo-map polygons, plus parchment coloring, graticule, subdued rhumb lines, ocean labels, and a restrained compass rose.

The complete 2:1 texture is divided into a latitude/longitude mesh and projected over the entire sphere. It uses the same globe rotation as the people and genealogy lines, so the atlas is physically locked to the sphere during drag, focus rotation, and zoom.

The map is decorative cartography. It does not claim that a person's position on the family globe is a geographic birthplace or residence.

## Current interaction

- Drag the atlas surface to rotate the entire globe around its center.
- Map, people, and family lines rotate together because they share the same sphere transform.
- Dragging and wheel movement use interpolated motion rather than snapping to every pointer event.
- Use the mouse wheel or trackpad to move closer or farther away from the same fixed globe center.
- Click a person to rotate that branch into focus.
- Use `Return to Tod` or Home to restore the current prototype home person.
- Search the current sample by name.
- Open People for filters by family side, century, relationship distance, and name.
- Person Details includes the profile image, named relationship to the home person, GEDCOM ID, saved-record/source section, photo-gallery entry point, and chronological notes.
- The canonical app version is shown directly beside the app title and is derived from `src/version.js`.

## Family layout and relationships

Generations use explicit vertical bands. The spacing is deliberately moderate: tighter than the early sparse prototype but looser than the overpacked layout that made portrait groups collide. Large grandparent-sibling cohorts wrap within their own generation band and receive enough horizontal and row separation to remain individually readable.

Couple and descent connectors use conventional genealogy grammar: partner bar, central descent line, sibling rail, and child stems. Connectors remain evidence-based. A layout cluster may influence where a prototype person is placed, but it can never create a genealogical relationship. Parent, spouse, and shared-parent sibling lines are drawn only from recorded relationship data.

The currently imported Supabase subset contains only 12 relationship records. All recorded relationships are rendered, but missing family relationships are not fabricated to make the prototype look fuller.

## GEDCOM and population coverage

The current Supabase import is explicitly a 44-person prototype subset. It does **not** contain Donna's ancestral generations, the requested descendant branches, the complete parent/spouse graph, or the source/citation structures from the full GEDCOM. Re-importing the complete GEDCOM is therefore required both for saved records and for the requested expanded-family stress test.

The missing relatives will not be fabricated. Once the complete GEDCOM is restored, the requested density test is: siblings for visible family groups, Donna's ancestry to the same depth, one additional ancestral generation with siblings, and descendants for displayed families.

## Architecture

- `src/geometry.js` owns spherical placement, camera projection, anchored plaque frames, and capacity math.
- `src/layout.js` maps the current sample into compact, generation-aware family bands.
- `src/plaque.js` owns the old-glass portrait medallion and parchment-scroll artwork.
- `src/plaque-projection.js` owns rigid aspect-preserving placement of a plaque at its sphere attachment point.
- `src/atlas-map.js` owns loading the bundled atlas texture.
- `src/sphere-texture.js` owns equirectangular UV mapping and triangle-affine texture projection onto the sphere.
- `assets/antique-atlas-texture.svg` is the high-resolution antique world-map texture.
- `src/scene.js` owns the single-canvas globe renderer, horizon, unified sphere rotation, atlas mesh projection, evidence-based genealogy connectors, rigid anchored plaques, and smooth direct manipulation.
- `src/relationships.js` derives human-readable kinship labels from recorded relationship data.
- `src/gedcom.js` normalizes preserved alternate names and saved source/citation records for Person Details.
- `src/data.js` owns the Supabase/bundled-sample boundary.
- `src/version.js` is the sole application-version source.

## Data and storage

The test app reads the shared personal Supabase project using project-specific objects prefixed `lazy_acres_ancestry_`. If Supabase is unavailable it falls back to `data/sample-family.json`.

Prototype family notes currently remain in browser local storage. Data-quality notes remain separate from family notes.

The complete GEDCOM is intentionally not committed to this public repository. The intended permanent image archive remains Cloudflare R2.

## Future work

Requested future enhancements are tracked in `FUTURE_ENHANCEMENTS.md`. The first queued interaction is a **Make home person** action. Restoring the full GEDCOM is a data prerequisite rather than an invitation to invent missing relatives.

## Test

```bash
node tests/geometry.test.mjs
node tests/atlas-map.test.mjs
node tests/sphere-texture.test.mjs
node tests/layout.test.mjs
node tests/plaque-projection.test.mjs
node tests/relationships.test.mjs
node tests/gedcom.test.mjs
```

The atlas and sphere tests guard full-sphere map coverage and texture projection. The plaque test guards against portrait/icon distortion by requiring a fixed aspect ratio and an exact lower-center sphere attachment point. The layout test guards generation-band separation. Relationship and GEDCOM tests guard named kinship labels and saved-record parsing.

## Hosting

The prototype publishes from canonical `main` through GitHub Pages during testing. The eventual production target is Cloudflare.
