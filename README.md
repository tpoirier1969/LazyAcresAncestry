# Lazy Acres Ancestry

Interactive genealogy atlas built from the supplied Ancestry data.

## Current prototype

The app uses a spherical family-atlas view with fixed-size person plaques. The globe is intentionally larger than the minimum 9,099-person capacity calculation so the visible family neighborhood reads flatter while the edge of the sphere remains visible on the horizon.

Person plaques are no longer painted flat onto the globe. Each plaque is modeled as a small physical display hinged at its lower edge: the lower edge remains attached to the sphere while the plaque leans modestly toward the camera. This reduces portrait squashing away from the viewing apex without turning people into screen-space overlays.

The current Supabase sample contains 44 people: Tod, Donna, Amy, Tod's parents, grandparents, and grandparent sibling groups. The renderer remains single-canvas and is intended to scale to the full genealogy without one DOM element per person.

## Atlas surface

The old procedural collection of polygons and map-like strokes has been removed. The globe now uses a single bundled antique-atlas image texture (`assets/antique-atlas-texture.svg`) containing coherent fictional landmasses, coastlines, islands, rivers, mountain marks, labels, rhumb lines, graticule, a compass rose, and ship ornamentation. The texture is clipped to the sphere, shaded by the globe lighting, and pans with globe rotation. It is decorative cartography, not a claim about real geography.

## Current interaction

- Drag the atlas surface to rotate it.
- Dragging and wheel movement use interpolated motion rather than snapping to every pointer event.
- Use the mouse wheel or trackpad to move closer or farther away.
- Click a person to rotate that branch into focus.
- Use `Return to Tod` or Home to restore the current prototype home person.
- Search the current sample by name.
- Open People for filters by family side, century, relationship distance, and name.
- Person Details includes the profile image, named relationship to the home person, GEDCOM ID, saved-record/source section, photo-gallery entry point, and chronological notes.
- Each new note is stored as a separate entry with author, date, time, and body.
- The canonical app version is shown directly beside the app title and is derived from `src/version.js`.
- The app checks that canonical version source periodically and reloads itself when a newer deployed version appears.

## Family layout and relationships

Family spacing is compact by default. The current sample layout has been tightened while preserving room for genealogy connectors and descendant branches. Couple and descent connectors use conventional genealogy grammar: partner bar, central descent line, sibling rail, and child stems.

Connectors remain evidence-based. A layout cluster may influence where a prototype person is placed, but it can never create a genealogical relationship. Parent, spouse, and shared-parent sibling lines are drawn only from recorded relationship data.

The next population test requested for the prototype is broader than the currently preserved data. The available Supabase import does not contain Donna's ancestral generations, the requested descendant branches, or the complete relationship graph needed to add siblings to every family group safely. Those people will not be fabricated. The full GEDCOM needs to be restored/re-imported before that population pass can be completed.

## GEDCOM and saved records

Person Details understands saved-record/source arrays when they are present in a person's preserved `raw_gedcom` payload and renders titles, citation details, repositories, and safe web links.

The current 44-person Supabase prototype import does **not** contain those source/citation structures. Its `raw_gedcom` objects currently preserve birth, death, and alternate-name data only. Re-importing the complete GEDCOM source/citation and relationship structures is therefore required both for saved records and for the requested expanded family stress view.

## Architecture

- `src/geometry.js` owns spherical placement, camera projection, hinged plaque frames, and capacity math.
- `src/layout.js` maps the current sample into a deliberately compact local family neighborhood.
- `src/plaque.js` owns the old-glass portrait medallion and parchment-scroll rendering.
- `src/atlas-map.js` owns loading and positioning the bundled atlas texture.
- `assets/antique-atlas-texture.svg` is the coherent antique map texture displayed on the globe.
- `src/scene.js` owns the single-canvas globe renderer, horizon, atlas texture, evidence-based genealogy connectors, plaque projection, and smooth direct manipulation.
- `src/relationships.js` derives human-readable kinship labels from recorded relationship data.
- `src/gedcom.js` normalizes preserved alternate names and saved source/citation records for Person Details.
- `src/data.js` owns the Supabase/bundled-sample boundary.
- `src/version.js` is the sole application-version source.
- `src/version-checker.js` checks that canonical source and reloads when a deployed version changes.

## Data and storage

The test app reads the shared personal Supabase project using project-specific objects prefixed `lazy_acres_ancestry_`. If Supabase is unavailable it falls back to `data/sample-family.json`.

Prototype family notes currently remain in browser local storage, but are structured as individual records so the eventual ancestry-prefixed shared store can preserve author and timestamps cleanly. Data-quality notes remain separate from family notes.

The complete GEDCOM is intentionally not committed to this public repository. The intended permanent image archive remains Cloudflare R2.

## Future work

Requested future enhancements are tracked in `FUTURE_ENHANCEMENTS.md`. The first queued interaction is a **Make home person** action. Restoring the full GEDCOM is a data prerequisite rather than an invitation to invent missing relatives.

## Test

```bash
node tests/geometry.test.mjs
node tests/atlas-map.test.mjs
node tests/layout.test.mjs
node tests/relationships.test.mjs
node tests/gedcom.test.mjs
```

The geometry test verifies capacity math, perspective behavior, the hinged plaque projection, and evidence-based relationship grouping. The atlas-map test verifies the bundled map texture and its rotation placement. The layout test guards the compact spacing targets. Relationship and GEDCOM tests guard named kinship labels and saved-record parsing.

## Hosting

The prototype publishes from canonical `main` through GitHub Pages during testing. The eventual production target is Cloudflare.
