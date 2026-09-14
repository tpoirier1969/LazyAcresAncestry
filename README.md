# Lazy Acres Ancestry

Interactive genealogy atlas built from the supplied Ancestry GEDCOM data.

## Current prototype

The app uses a spherical family-atlas view with physical person plaques anchored to the same globe as the family connectors. The current imported working graph contains 631 people and 1,042 recorded parent/spouse relationships. The client then applies the display-scope rule from the home person: a fixed number of direct ancestral generations, the siblings of those ancestors, their descendants, and only the spouses or co-parents needed to make those displayed family units intelligible.

The working globe radius is **225 physical layout units**. Person plaques remain physical objects on the globe rather than screen-size DOM cards, so their apparent size and foreshortening come from the shared 3D projection.

## Globe renderer

The world map is rendered as a genuine GPU-textured sphere rather than as Canvas 2D affine map triangles.

- `src/globe-webgl.js` builds a 360 x 180 latitude/longitude sphere mesh with perspective-correct UV mapping.
- `src/atlas-map.js` owns the canonical atlas texture URLs, geographic home anchor, LOD rules, and provenance metadata.
- The always-resident global base and relief textures are bounded to 2560-pixel world derivatives so the genealogy app does not monopolize browser GPU memory.
- Close views use four geographically bounded NASA Blue Marble regional levels: local, subregional, regional, and continental. The renderer requests only the region currently facing the camera instead of stretching a single world bitmap beyond its useful resolution.
- Regional requests are quantized so small camera movements reuse the same texture rather than repeatedly decoding and uploading nearly identical images.
- LOD changes cross-fade rather than snap. The far overview falls back to the global layers when regional resolution is unnecessary.
- The map does **not** add modern political or coastline outlines. Geography comes from the source imagery itself.
- Modern photographic color is strongly suppressed before display. Terrain, drainage, shore detail, and relief are retained under the antique parchment treatment.
- Oceans and inland lakes share a low-saturation aged grey-green/blue wash. Parchment remains the dominant color.
- Cartographic writing is intentionally sparse. A few small italic Palatino-style labels are decoration rather than modern map labeling.
- WebGL performs perspective-correct texture interpolation, hidden-surface removal, horizon clipping, mipmapping where appropriate, and anisotropic filtering where available.
- The WebGL projection uses the same yaw, camera angle, focal length, sphere radius, and camera distance as the genealogy overlay so the map, people, and family lines remain locked together.

The obsolete hand-built affine sphere mapper and the crude local pseudo-map texture were removed rather than retained as repair layers.

### Upper Peninsula home anchor

The atlas is statically aligned so the family-tree home point corresponds to approximately **46.55° N, 87.45° W**, in Michigan's central Upper Peninsula / Lake Superior region. Tod therefore begins over the region where he lives rather than over an arbitrary point near the prime meridian.

This geographic home anchor is only a visual reference for the family tree. Other people remain positioned by genealogy rules unless a future personal/family geography layer explicitly maps recorded life events to real coordinates.

### Atlas texture provenance

Base source: `Equirectangular-projection-topographic-world.jpg` on Wikimedia Commons, created by Gundan / mapswire.com and distributed under CC BY-SA 4.0. Its observed Wikimedia SHA-1 is recorded in `src/atlas-map.js`.

Global relief source: `Solarsystemscope texture 8k earth daymap.jpg` by Solar System Scope, distributed under CC BY 4.0 and based on NASA elevation and imagery data. The application deliberately uses a 2560-pixel derivative as the always-resident global relief texture.

Regional detail source: NASA Earth Observatory Blue Marble: Next Generation, served through NASA GIBS WMS. Close-detail requests are generated from the visible geographic neighborhood and bounded by the canonical LOD budget in `src/atlas-map.js`.

These external dependencies are acceptable for the prototype, but controlled copies should move to application-owned storage before production.

## Family scope and layout model

The display graph is not "everyone connected somehow." `src/data.js` enforces the requested genealogy boundary:

- start with the home person;
- follow recorded parent links upward for the configured number of direct ancestral generations;
- include the siblings of those direct ancestors and their recorded descendants;
- include spouses/co-parents only far enough to make those displayed family units understandable;
- do not walk upward into unrelated in-law ancestry.

The layout itself is relationship-driven. `src/layout.js` treats each spouse/nuclear unit as its own compact block. People who merely share parents are no longer fused into one enormous sibling block. Recorded parent-child links determine where each family unit sits relative to the generation beneath or above it.

The direct ancestry line receives extra positional authority so hundreds of collateral descendants cannot drag a parent or grandparent sideways. Collateral branches fan around that backbone while staying in the lineage neighborhood they actually descend from.

Visible family layout still uses named physical spacing rules:

- `COUPLE_GAP` is the smallest relationship gap; spouses read as one family unit.
- `SIBLING_GAP` is normal spacing between siblings in the same recorded family.
- `MIN_PERSON_CLEARANCE` is the minimum center-to-center clearance.
- `BETWEEN_FAMILY_GAP` separates adjacent nuclear family units.
- `GENERATION_GAP` is the prototype baseline generation distance.
- Large graphs increase generation spacing progressively so several hundred people do not collapse into a thin horizontal railway band.

Connectors remain evidence-based. Layout may decide where somebody is drawn, but it can never manufacture a parent, spouse, sibling, or child relationship.

## Person plaques

Person plaques are fixed physical objects laid in the local tangent plane of the globe. They do not hinge toward the camera.

The projection uses both axes of the actual 3D tangent plane. Plaques near the viewing apex therefore read nearly face-on, while plaques farther around the sphere progressively foreshorten with the surface.

The label treatment is dark wood with brass end caps and lighter engraved-style lettering. Names wrap to a maximum of two lines rather than running off the card. Birth/death text also wraps to two lines when needed and uses a larger minimum font size instead of shrinking long dates into unreadable single-line text.

## Current interaction

- Drag the atlas surface to rotate the globe.
- Drag sensitivity is tied to zoom level and remains restrained throughout the range.
- Wheel or trackpad movement changes camera distance only. Zoom never changes the selected person and never sends the view back to Home.
- Click a person to rotate that person into the viewing apex and make them the focused person.
- Use `Return to Tod` or Home for the explicit home-person action.
- The geometric center of the projected sphere remains at the exact center of the atlas viewport at every zoom level, after focus changes, and after drag rotation. Navigation rotates the globe rather than sliding the globe off the screen.
- Camera angle still changes continuously with zoom; there is no discrete close/overview mode switch.
- Search the displayed family scope by name.
- Open People for filters by family side, century, relationship distance, and name.
- Person Details includes the profile image, named relationship to the home person, GEDCOM ID, saved-record/source section, photo-gallery entry point, and chronological notes.
- The canonical app version is shown directly beside the app title and derives from `src/version.js`.

## Family relationships

Couple and descent connectors use conventional genealogy grammar: partner bar, descent line, sibling rail, and child stems. They are rendered in a muted brick/iron-oxide red family with a restrained parchment halo and subtle shadow so genealogy stays distinct from map linework.

Sibling rails are derived from exact shared-parent sets. A person with one recorded child receives one recorded child connection. Unrelated people cannot be added to that family merely because they share a generation or happen to be drawn nearby.

## GEDCOM and population coverage

The current database working graph was derived from the supplied Ancestry GEDCOM and contains 631 selected people plus their recorded relationships. Stable GEDCOM IDs remain the external person identifiers.

The complete raw GEDCOM is not currently committed to this public repository. Its recorded source SHA-256 is `9a5c80c3a94383755c7f2206df622deab315dc732a08c7976a3d29d64c0d038d`. Import metadata in the ancestry database identifies that source so later imports can be checked against the same file.

Source/citation structures and life-event geography still need a fuller normalization pass before the planned personal/family geographic footprint layer can be implemented accurately.

## Media direction

The globe renderer accepts a person's current `photo` as a display source, but future user-managed media will not depend on editing the GEDCOM. The planned media model gives each stable person record one profile/frame image plus a separately managed gallery whose images can be uploaded, captioned, dated, annotated, removed, or promoted to profile status over time. Detailed requirements are tracked in `FUTURE_ENHANCEMENTS.md`.

## Architecture

- `src/geometry.js` owns spherical placement, camera projection, visible-horizon tests, tangent plaque frames, exact projected sphere bounds, and capacity math.
- `src/camera-behavior.js` owns deterministic zoom-to-view-angle, zoom-to-pan-speed, and motion curves.
- `src/layout.js` owns relationship-driven nuclear-family layout and canonical physical spacing.
- `src/globe-webgl.js` owns the GPU UV sphere, atlas alignment, layered textures, cartographic labels, antique color treatment, and hidden-surface handling.
- `src/atlas-map.js` owns atlas asset URLs, provenance metadata, progressive regional LOD rules, and the geographic home anchor.
- `src/scene.js` owns interaction, shared runtime globe/camera state, evidence-based genealogy connectors, physical globe radius, and the 2D person overlay.
- `src/plaque.js` owns the old-glass portrait medallion and wood/brass label artwork.
- `src/plaque-projection.js` maps the rigid plaque artwork onto its projected 3D plane while preserving its sphere attachment point.
- `src/relationships.js` derives human-readable kinship labels from recorded relationship data.
- `src/gedcom.js` normalizes preserved alternate names and saved source/citation records for Person Details.
- `src/data.js` owns Supabase loading and the displayed-family scope boundary.
- `src/version.js` is the sole application-version source.

## Data and storage

The app reads the shared personal Supabase project using project-specific objects prefixed `lazy_acres_ancestry_`. If Supabase is unavailable it falls back to `data/sample-family.json`.

Prototype family notes currently remain in browser local storage. Data-quality notes remain separate from family notes.

The intended permanent image archive remains Cloudflare R2.

## Test

```bash
node tests/geometry.test.mjs
node tests/camera-behavior.test.mjs
node tests/atlas-map.test.mjs
node tests/globe-webgl.test.mjs
node tests/layout.test.mjs
node tests/layout-large.test.mjs
node tests/family-scope.test.mjs
node tests/interaction.test.mjs
node tests/plaque-projection.test.mjs
node tests/relationships.test.mjs
node tests/gedcom.test.mjs
```

The interaction test guards the two navigation invariants that previously regressed: wheel zoom cannot change the focused person, and the projected globe center must remain at the viewport center at close zoom, far zoom, after focus changes, and after drag rotation. The large-layout test builds a 377-person synthetic family to ensure the direct ancestry spine stays stable and the graph opens vertically instead of collapsing into a horizontal band. The family-scope test prevents unrelated in-law ancestry or ancestors beyond the configured depth from leaking into the displayed graph. The atlas test guards LOD, provenance, and bounded texture memory. Geometry, plaque-projection, relationship, GEDCOM, and the smaller family-layout tests protect the remaining deterministic rules.

## Hosting

The prototype publishes from canonical `main` through GitHub Pages during testing. Substantial work is developed on a non-production branch and only moved to `main` after deterministic tests pass, so intermediate experiments do not repeatedly trigger production validation notifications.
