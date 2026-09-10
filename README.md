# Lazy Acres Ancestry

Interactive genealogy atlas built from the supplied Ancestry data.

## Current prototype

The app uses a spherical family-atlas view with fixed physical person plaques projected onto the same sphere as the map and family connectors. The globe is intentionally larger than the minimum 9,099-person capacity calculation so the visible family neighborhood reads flatter while the edge of the sphere remains visible on the horizon.

The current Supabase sample contains 44 people: Tod, Donna, Amy, Tod's parents, grandparents, and grandparent sibling groups. The renderer remains single-canvas and is intended to scale to the full genealogy without one DOM element per person.

## Unified sphere renderer

The map, family connectors, and person plaques now share one spherical coordinate system and one yaw/pitch rotation around the exact globe center. Nothing is allowed to pan independently as a screen-space layer.

Person plaques are mapped onto small curved surface patches. Most of each plaque remains directly attached to the sphere. Only the uppermost portion lifts slightly from the surface to preserve a little portrait readability. Person plaques no longer cast ground/drop shadows.

## Atlas surface

The globe uses a bundled 4096×2048 antique-atlas texture (`assets/antique-atlas-texture.svg`) with recognizable world-map structure, parchment grain, coastlines, rivers, mountain marks, labels, graticule, rhumb lines, a compass rose, and ship ornamentation. It is decorative cartography, not a claim about exact historical geography.

The texture is divided into a mesh, mapped to unit-sphere latitude/longitude coordinates, rotated with the exact same globe transform as the people and genealogy lines, and projected cell by cell through the camera. This keeps the map physically locked to the sphere during drag, focus rotation, and zoom.

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

Generations use explicit vertical bands. People within a generation are compact by default, while generations remain clearly separated from the generations above and below them. Large grandparent-sibling groups wrap within a narrow same-generation band instead of drifting upward and appearing to be an older generation.

Couple and descent connectors use conventional genealogy grammar: partner bar, central descent line, sibling rail, and child stems. Connectors remain evidence-based. A layout cluster may influence where a prototype person is placed, but it can never create a genealogical relationship. Parent, spouse, and shared-parent sibling lines are drawn only from recorded relationship data.

The currently imported Supabase subset contains only 12 relationship records. All recorded relationships are rendered, but missing family relationships are not fabricated to make the prototype look fuller.

## GEDCOM and population coverage

The current Supabase import is explicitly a 44-person prototype subset. It does **not** contain Donna's ancestral generations, the requested descendant branches, the complete parent/spouse graph, or the source/citation structures from the full GEDCOM. Re-importing the complete GEDCOM is therefore required both for saved records and for the requested expanded-family stress test.

The missing relatives will not be fabricated. Once the complete GEDCOM is restored, the requested density test is: siblings for visible family groups, Donna's ancestry to the same depth, one additional ancestral generation with siblings, and descendants for displayed families.

## Architecture

- `src/geometry.js` owns spherical placement, camera projection, and capacity math.
- `src/layout.js` maps the current sample into compact, generation-aware family bands.
- `src/plaque.js` owns the old-glass portrait medallion and parchment-scroll texture.
- `src/atlas-map.js` owns loading the bundled atlas texture.
- `src/sphere-texture.js` owns triangle-affine texture projection onto the sphere.
- `assets/antique-atlas-texture.svg` is the high-resolution antique world-map texture.
- `src/scene.js` owns the single-canvas globe renderer, horizon, unified sphere rotation, atlas mesh projection, evidence-based genealogy connectors, surface-attached plaque projection, and smooth direct manipulation.
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
node tests/relationships.test.mjs
node tests/gedcom.test.mjs
```

## Hosting

The prototype publishes from canonical `main` through GitHub Pages during testing. The eventual production target is Cloudflare.
