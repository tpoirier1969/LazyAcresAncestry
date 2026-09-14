# Lazy Acres Ancestry

Interactive genealogy atlas built from the supplied Ancestry data.

## Current prototype

The app uses a spherical family-atlas view with fixed physical person plaques anchored to the same globe as the family connectors. The current Supabase sample contains 44 people: Tod, Donna, Amy, Tod's parents, grandparents, and grandparent sibling groups. The renderer remains scalable to the full genealogy without one DOM element per person.

## Globe renderer

The world map is rendered as a genuine GPU-textured sphere rather than as Canvas 2D affine triangles.

- `src/globe-webgl.js` builds a normal latitude/longitude sphere mesh with UV coordinates.
- `src/atlas-map.js` owns the canonical atlas texture URL and provenance metadata.
- The source texture is a 4,424 × 2,214 equirectangular physical world map from Wikimedia Commons. It supplies real coastlines, islands, mountain relief, drainage, and ocean-depth detail instead of the former hand-drawn placeholder polygons.
- The fragment shader converts that modern physical map into a restrained sepia/antique-atlas palette while preserving the underlying geographic relief. It adds only a faint 15-degree graticule and subtle paper grain.
- WebGL performs perspective-correct texture interpolation, hidden-surface removal, horizon clipping, mipmapping where supported, and anisotropic filtering where available.
- The WebGL projection intentionally uses the same yaw, pitch, focal length, sphere radius, and camera distance as the genealogy overlay so the map, people, and family lines remain locked to one sphere.
- `src/scene.js` keeps the interactive genealogy overlay on the existing 2D canvas and renders the map sphere on a WebGL canvas directly beneath it.

The obsolete hand-built `sphere-texture.js` affine mapper and the crude local pseudo-map texture have been removed rather than retained as repair layers.

The map is decorative cartography. A person's position on the family globe does not claim to represent birthplace or residence.

### Atlas texture provenance

Current source: `Equirectangular-projection-topographic-world.jpg` on Wikimedia Commons, created by Gundan / mapswire.com and distributed under CC BY-SA 4.0. The observed Wikimedia SHA-1 is recorded in `src/atlas-map.js` alongside the source page and credit string.

The application requests the original high-resolution image directly from Wikimedia with anonymous CORS. If the remote texture cannot be loaded, WebGL retains its neutral parchment placeholder rather than falling back to the rejected low-detail map. This external dependency is deliberate for the prototype because the connected GitHub writer can update text source but cannot place the 1.66 MB binary image into the repository. A controlled local/R2 copy should replace the remote dependency before production.

## Family spacing model

Visible family layout now uses named physical spacing rules rather than cluster-specific magic numbers:

- `COUPLE_GAP` — the smallest relationship gap; spouses read as one family unit.
- `SIBLING_GAP` — normal spacing between siblings in the same family.
- `MIN_PERSON_CLEARANCE` — hard minimum center-to-center clearance for any two people.
- `BETWEEN_FAMILY_GAP` — extra breathing room when one family grouping ends and another begins.
- `GENERATION_GAP` — one consistent surface distance between generations.

These constants live in `src/layout.js` as the canonical owner of family spacing. `BETWEEN_FAMILY_GAP` is intentionally larger than `SIBLING_GAP`, but not large enough to visually disconnect adjacent families.

The current prototype grandparent generation is laid out as a single generation band rather than compressed mini-clusters. Within a family the sibling gap is consistent; direct grandparent couples use the couple gap; distinct nearby family groups use the between-family gap.

## Person plaques

Person plaques are rigid physical objects, not curved decals. Their lower-center hinge remains attached to the sphere while the plaque tilts toward the camera enough to keep portraits readable. The artwork is always rendered at a uniform scale, so the oval portrait frame and photograph keep their intended proportions instead of stretching with sphere curvature.

The current label treatment is dark wood with brass end caps and lighter engraved-style lettering. This replaced the unsuccessful parchment-scroll treatment.

## Current interaction

- Drag the atlas surface to rotate the globe.
- Map, people, and family lines rotate together because they use the same sphere transform.
- Wheel or trackpad movement changes camera distance.
- Click a person to rotate that branch into focus.
- Use `Return to Tod` or Home to restore the current prototype home person.
- Search the current sample by name.
- Open People for filters by family side, century, relationship distance, and name.
- Person Details includes the profile image, named relationship to the home person, GEDCOM ID, saved-record/source section, photo-gallery entry point, and chronological notes.
- The canonical app version is shown directly beside the app title and derives from `src/version.js`.

Requested wider zoom limits, slower movement, and a roughly 25% larger sphere are tracked in `FUTURE_ENHANCEMENTS.md` for a separate tuning pass after the new renderer is visually verified.

## Family relationships

Couple and descent connectors use conventional genealogy grammar: partner bar, central descent line, sibling rail, and child stems. Connectors remain evidence-based. A layout grouping may influence where a prototype person is placed, but it can never create a genealogical relationship. Parent, spouse, and shared-parent sibling lines are drawn only from recorded relationship data.

The currently imported Supabase subset contains only a small relationship sample. Missing family relationships are not fabricated to make the prototype look fuller.

## GEDCOM and population coverage

The current Supabase import is explicitly a prototype subset. It does **not** contain Donna's ancestral generations, the requested descendant branches, the complete parent/spouse graph, or all source/citation structures from the full GEDCOM. Re-importing the complete GEDCOM is required both for saved records and for the requested expanded-family stress test.

The complete raw GEDCOM is intentionally not committed to this public repository. GEDCOM identifiers remain stable external identifiers.

## Architecture

- `src/geometry.js` owns spherical placement, camera projection, visible-horizon tests, anchored plaque frames, and capacity math.
- `src/layout.js` owns family layout and the canonical gap hierarchy.
- `src/globe-webgl.js` owns the GPU UV sphere, texture upload, antique color treatment, perspective-correct map rendering, and hidden-surface handling.
- `src/atlas-map.js` owns the canonical atlas-texture URL and provenance metadata.
- `src/scene.js` owns interaction, shared sphere rotation/camera state, evidence-based genealogy connectors, and the 2D person overlay.
- `src/plaque.js` owns the old-glass portrait medallion and wood nameplate with brass end caps.
- `src/plaque-projection.js` owns rigid aspect-preserving placement of a plaque at its sphere attachment point.
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

The WebGL mesh test guards sphere geometry and UV orientation. The atlas-map test guards the high-detail source URL, provenance, credit, and recorded checksum. The layout test guards the semantic gap hierarchy and equal generation spacing. Geometry, plaque, relationship, and GEDCOM tests protect the other deterministic renderer and data rules.

## Hosting

The prototype publishes from canonical `main` through GitHub Pages during testing. The eventual production target is Cloudflare.
