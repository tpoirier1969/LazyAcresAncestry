# Lazy Acres Ancestry

Interactive genealogy atlas built from the supplied Ancestry data.

## Current prototype

The app uses a spherical family-atlas view with fixed physical person plaques anchored to the same globe as the family connectors. The current Supabase sample contains 44 people: Tod, Donna, Amy, Tod's parents, grandparents, and grandparent sibling groups. The renderer remains scalable to the full genealogy without one DOM element per person.

The working globe radius is **150 physical layout units**, up from 120, so the visible genealogy occupies a flatter-looking patch of the sphere and leaves substantially more surface area for deeper generations. Person plaques remain fixed-size physical objects and use the larger portrait/name scale established by the approved visual reference.

## Globe renderer

The world map is rendered as a genuine GPU-textured sphere rather than as Canvas 2D affine map triangles.

- `src/globe-webgl.js` builds a dense latitude/longitude sphere mesh with perspective-correct UV mapping.
- `src/atlas-map.js` owns the canonical atlas texture URLs, geographic home anchor, and provenance metadata.
- The base texture is a 4,424 x 2,214 equirectangular physical world map from Wikimedia Commons.
- A separate **8192 x 4096 detail layer** restores terrain and water detail for close inspection. GPUs limited to 4K textures use a 3840-pixel fallback.
- The map does **not** add modern political or coastline outlines. Geography comes from the source textures themselves.
- The fragment shader sharpens fine source detail before applying the antique treatment, rather than blurring the map beneath a sepia wash.
- Oceans and inland lakes share a restrained slate-blue wash while land remains warm parchment.
- Cartographic writing is intentionally sparse. A few small hand-lettered/cursive labels are used as decoration rather than modern map labeling.
- The graticule and paper grain remain subtle so they do not compete with genealogy.
- WebGL performs perspective-correct texture interpolation, hidden-surface removal, horizon clipping, mipmapping where supported, and anisotropic filtering where available.
- The WebGL projection uses the same runtime yaw, pitch, focal length, sphere radius, and camera distance as the genealogy overlay so the map, people, and family lines remain locked together during interaction.

The obsolete hand-built `sphere-texture.js` affine mapper and the crude local pseudo-map texture were removed rather than retained as repair layers.

### Upper Peninsula home anchor

The atlas is statically aligned so the family-tree home point corresponds to approximately **46.55° N, 87.45° W**, in Michigan's central Upper Peninsula / Lake Superior region. Tod therefore begins over the region where he lives rather than over an arbitrary point near the prime meridian.

This geographic home anchor is only a visual reference for the family tree. Other people remain positioned by genealogy layout rules unless a future migration/geographic view explicitly maps individual events to real coordinates.

### Atlas texture provenance

Base source: `Equirectangular-projection-topographic-world.jpg` on Wikimedia Commons, created by Gundan / mapswire.com and distributed under CC BY-SA 4.0. Its observed Wikimedia SHA-1 is recorded in `src/atlas-map.js`.

Fine detail: `Solarsystemscope texture 8k earth daymap.jpg`, an 8192 x 4096 equirectangular world texture by Solar System Scope, distributed under CC BY 4.0 and based on NASA elevation and imagery data. The app uses the original 8K image on capable GPUs and a 3840-pixel Wikimedia derivative as fallback.

These external dependencies are acceptable for the prototype, but controlled copies should move to the application's own storage, such as Cloudflare R2, before production.

## Family spacing model

Visible family layout uses named physical spacing rules rather than cluster-specific magic numbers:

- `COUPLE_GAP` is the smallest relationship gap; spouses read as one family unit.
- `SIBLING_GAP` is normal spacing between siblings in the same family.
- `MIN_PERSON_CLEARANCE` is hard minimum center-to-center clearance for any two people.
- `BETWEEN_FAMILY_GAP` adds breathing room when one family grouping ends and another begins.
- `GENERATION_GAP` provides one consistent surface distance between generations.

These constants live in `src/layout.js` as the canonical owner of family spacing. `BETWEEN_FAMILY_GAP` is intentionally larger than `SIBLING_GAP`, but not large enough to visually disconnect adjacent families. The gaps were opened slightly when person plaques were enlarged so the approved portrait/name scale does not reintroduce crowding.

The current prototype grandparent generation is laid out as a single generation band rather than compressed mini-clusters. Within a family the sibling gap is consistent; direct grandparent couples use the couple gap; distinct nearby family groups use the between-family gap.

## Person plaques

Person plaques are rigid physical objects hinged to the sphere. The lower center remains attached to the atlas surface.

The projection now uses both axes of the actual 3D plaque plane. This allows genuine screen-space foreshortening as a plaque moves toward the horizon, so people read as objects resting on the curved surface rather than upright screen-facing badges. A small zoom-dependent hinge lift preserves readability without returning to the marching-soldier look.

The current label treatment is dark wood with brass end caps and lighter engraved-style lettering. Portrait/plaque dimensions were enlarged from the first WebGL pass to move back toward the approved reference, where faces and names remain recognizable in the normal home view.

## Current interaction

- Drag the atlas surface to rotate the globe. Drag sensitivity and damping are deliberately slower than the initial prototype.
- Wheel or trackpad movement changes camera distance across a substantially wider near/far range.
- Close views move toward a direct-down camera centered on the focused family patch.
- Wide views progressively raise the camera toward the horizon so a larger percentage of the sphere becomes visible.
- Click a person to rotate that branch into focus.
- Use `Return to Tod` or Home to restore the current prototype home person.
- Search the current sample by name.
- Open People for filters by family side, century, relationship distance, and name.
- Person Details includes the profile image, named relationship to the home person, GEDCOM ID, saved-record/source section, photo-gallery entry point, and chronological notes.
- The canonical app version is shown directly beside the app title and derives from `src/version.js`.

## Family relationships

Couple and descent connectors use conventional genealogy grammar: partner bar, central descent line, sibling rail, and child stems. They are now rendered in a muted brick/iron-oxide red family with a restrained parchment halo, keeping genealogy distinct from the brown map linework without introducing a modern or neon color.

Connectors remain evidence-based. A layout grouping may influence where a prototype person is placed, but it can never create a genealogical relationship. Parent, spouse, and shared-parent sibling lines are drawn only from recorded relationship data.

The currently imported Supabase subset contains only a small relationship sample. Missing family relationships are not fabricated to make the prototype look fuller.

## GEDCOM and population coverage

The current Supabase import is explicitly a prototype subset. It does **not** contain Donna's ancestral generations, the requested descendant branches, the complete parent/spouse graph, or all source/citation structures from the full GEDCOM. Re-importing the complete GEDCOM is required both for saved records and for the requested expanded-family stress test.

The complete raw GEDCOM is intentionally not committed to this public repository. GEDCOM identifiers remain stable external identifiers.

## Media direction

The globe renderer accepts a person's current `photo` as a display source, but future user-managed media will not depend on editing the GEDCOM. The planned media model gives each stable person record one profile/frame image plus a separately managed gallery whose images can be uploaded, captioned, dated, annotated, removed, or promoted to profile status over time. The detailed requirements are tracked in `FUTURE_ENHANCEMENTS.md`.

## Architecture

- `src/geometry.js` owns spherical placement, camera projection, visible-horizon tests, anchored plaque frames, and capacity math.
- `src/layout.js` owns family layout and the canonical gap hierarchy.
- `src/globe-webgl.js` owns the GPU UV sphere, Upper Peninsula atlas alignment, layered textures, generated cartographic labels, antique color treatment, texture sharpening, and hidden-surface handling.
- `src/atlas-map.js` owns atlas asset URLs, provenance metadata, and the canonical home geographic anchor.
- `src/scene.js` owns interaction, zoom-dependent camera framing, shared runtime sphere rotation/camera state, evidence-based genealogy connectors, physical globe radius, and the 2D person overlay.
- `src/plaque.js` owns the old-glass portrait medallion and wood nameplate with brass end caps.
- `src/plaque-projection.js` maps the rigid plaque artwork onto its projected 3D plane while preserving its sphere attachment point.
- `src/relationships.js` derives human-readable kinship labels from recorded relationship data.
- `src/gedcom.js` normalizes preserved alternate names and saved source/citation records for Person Details.
- `src/data.js` owns the Supabase/bundled-sample boundary.
- `src/version.js` is the sole application-version source.

## Data and storage

The test app reads the shared personal Supabase project using project-specific objects prefixed `lazy_acres_ancestry_`. If Supabase is unavailable it falls back to `data/sample-family.json`.

Prototype family notes currently remain in browser local storage. Data-quality notes remain separate from family notes.

The intended permanent image archive remains Cloudflare R2.

## Test

```bash
node tests/geometry.test.mjs
node tests/atlas-map.test.mjs
node tests/globe-webgl.test.mjs
node tests/layout.test.mjs
node tests/plaque-projection.test.mjs
node tests/relationships.test.mjs
node tests/gedcom.test.mjs
```

The WebGL mesh test guards unit-sphere geometry, local compass orientation, and the Upper Peninsula atlas anchor. The atlas-map test guards the source URLs, provenance, and anchor bounds. The plaque-projection test guards the surface attachment and 3D foreshortening behavior. The layout test guards the semantic gap hierarchy and equal generation spacing. Geometry, relationship, and GEDCOM tests protect the other deterministic renderer and data rules.

## Hosting

The prototype publishes from canonical `main` through GitHub Pages during testing. The eventual production target is Cloudflare.
