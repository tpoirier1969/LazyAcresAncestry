# Lazy Acres Ancestry

Interactive genealogy atlas built from the supplied Ancestry data.

## Current prototype

The app uses a spherical family-atlas view with fixed physical person plaques anchored to the same globe as the family connectors. The current proof population contains **430 people**, generated deterministically from the supplied GEDCOM. It starts with the approved 53-person proof tree, adds the established non-recursive sibling/spouse breadth step to reach 139 people, then adds every GEDCOM-recorded child of those 139 people plus 42 otherwise-missing co-parents required to keep the displayed child families complete. The child/co-parent expansion is deliberately non-recursive.

The 430-person population is intentionally a family-separation stress test. It includes real cases where one displayed parent has children in more than one GEDCOM family, so the renderer must keep those spouse/child families visually distinct rather than merely handling a tidy ancestor tree.

The renderer remains scalable to the full genealogy without one DOM element per person. Person plaques and relationships remain Canvas/WebGL content; the new hover details use one reusable DOM tooltip rather than a tooltip node for every person.

The working globe radius is **225 physical layout units**, so the visible genealogy occupies a relatively flat-looking patch of the sphere while leaving substantial surface area for deeper generations. Person plaques remain fixed-size physical objects and use the larger portrait/name scale established by the approved visual reference.

## Globe renderer

The world map is rendered as a genuine GPU-textured sphere rather than as Canvas 2D affine map triangles.

- `src/globe-webgl.js` builds a dense latitude/longitude sphere mesh with perspective-correct UV mapping. The normal production mesh is 320 x 160 segments.
- `src/atlas-map.js` owns the canonical atlas texture URLs, geographic home anchor, and provenance metadata.
- The base texture is a 4,424 x 2,214 equirectangular physical world map from Wikimedia Commons.
- A separate **8192 x 4096 detail layer** restores terrain and water detail for close inspection. GPUs limited to 4K textures use a 3840-pixel fallback.
- The 8K layer is used primarily for luminance and relief detail. Almost all of its modern photographic color is suppressed before display.
- The map does **not** add modern political or coastline outlines. Geography comes from the source textures themselves.
- The fragment shader combines local-contrast sharpening from both map sources with restrained relief engraving so mountains, drainage, shore detail, and terrain remain visible at close zoom without tracing artificial country or landmass borders.
- Oceans and inland lakes share a low-saturation aged grey-green/blue wash. Parchment remains the dominant color, avoiding a modern blue-map appearance.
- Cartographic writing is intentionally sparse. A few small italic Palatino-style labels are used as decoration rather than modern map labeling.
- The graticule is very faint. Coarse parchment mottling supplies age while fine grain is kept weak enough not to blur geography.
- WebGL performs perspective-correct texture interpolation, hidden-surface removal, horizon clipping, mipmapping where supported, and anisotropic filtering where available.
- The WebGL projection uses the same runtime yaw, effective camera pitch, focal length, sphere radius, and camera distance as the genealogy overlay so the map, people, and family lines remain locked together during interaction.

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
- `SIBLING_GAP` is normal spacing between siblings in the same GEDCOM family.
- `MIN_PERSON_CLEARANCE` is hard minimum center-to-center clearance for any two people.
- `BETWEEN_FAMILY_GAP` adds breathing room when one GEDCOM family grouping ends and another begins.
- `GENERATION_GAP` provides one consistent surface distance between generations.

These constants live in `src/layout.js` as the canonical owner of family spacing. `BETWEEN_FAMILY_GAP` is intentionally larger than `SIBLING_GAP`, but not large enough to visually disconnect adjacent families.

Layout grouping follows the actual GEDCOM family-of-origin identity. Children belonging to the same `FAM` record remain one contiguous block. If a parent has children with different spouses, those children remain in separate family blocks even though they share that parent. This prevents neighboring families from interleaving and prevents layout geometry from implying a family relationship that the GEDCOM does not contain.

The current 430-person stress population is passed through the same family-aware layout used by the smaller prototype. Automated validation requires all 430 people to receive finite sphere positions and verifies that the stress population includes parents participating in multiple child-bearing GEDCOM families.

The current prototype uses one generation band per genealogical generation rather than compressed mini-clusters. Within a family the sibling gap is consistent; couples use the couple gap; distinct nearby family groups use the between-family gap.

## Person plaques

Person plaques are fixed-size physical objects laid in the local tangent plane of the globe. They do not hinge toward the camera.

The projection uses both axes of the actual 3D tangent plane. Plaques near the viewing apex therefore read nearly face-on, while plaques farther around the sphere progressively foreshorten with the surface. This makes the people look attached to the atlas rather than standing upright as camera-facing badges.

The current label treatment is dark wood with engraved-style lettering and restrained aged-metal trim. Male plaques use a darker oil-rubbed bronze treatment, female plaques use a warmer redder rose bronze, and unspecified sex uses aged pewter. Portrait/plaque dimensions remain fixed physical dimensions on the sphere.

## Current interaction

- Drag the atlas surface to rotate the globe.
- Drag sensitivity is tied to zoom level and is deliberately restrained throughout the range. Close inspection is slowest; broad overview becomes only moderately faster.
- Wheel or trackpad movement changes camera distance across a wide near/far range.
- Camera **angle** changes continuously with zoom through a smooth S-curve. Close views remain nearly perpendicular to the focused family patch; the view leans progressively as distance increases, without an early jump into an overview angle.
- The focused family moves gradually higher in the viewport as the view widens. At the far end the sphere center remains high enough to keep most of the globe visible instead of leaving a large empty sky area above a low globe.
- Hover a visible person plaque on desktop to open a compact parchment information card. It shows the named relationship to the home person, lifespan, known birth/death place information, immediate parent/spouse/child counts, profile image or initial, and up to two saved-record titles when available.
- The hover card is one reusable UI surface driven by the same Canvas hit-testing used for click selection. It is not one DOM element per person.
- Click a person to rotate that branch into focus and open full Person Details.
- Wheel zoom preserves the selected person's screen coordinate instead of jumping focus to another person.
- Use `Return to Tod` or Home to restore the current prototype home person.
- Search the current population by name.
- Open People for filters by family side, century, relationship distance, and name.
- Person Details includes the profile image, named relationship to the home person, GEDCOM ID, saved-record/source section, photo-gallery entry point, and chronological notes.
- The canonical app version is shown directly beside the app title and derives from `src/version.js`.

## Family relationships

Couple and descent connectors use conventional genealogy grammar: partner bar, central descent line, family rail, and child stems. Relationship strokes use related but distinct brick/iron-oxide tones for couple bars, descent stems, and family rails, with a restrained parchment halo separating genealogy from map linework.

Primary relationship strokes are intentionally bold. Ancestry-continuation stems remain visually lighter by color because they indicate family continuing outside the displayed scope, but they are no longer physically reduced to hairline weight. The continuation stroke is kept close to the primary relationship weight so it stays readable at normal viewing distances.

Each visible family rail corresponds to one recorded GEDCOM family where a family ID is available. Separate spouse/parent families remain separate routes even when they share one parent. Adaptive child stems normally rise about one portrait-frame height before turning into the horizontal family rail and extend farther only when another documented family route requires additional clearance.

Connectors remain evidence-based. A layout grouping may influence where a person is placed, but it can never create a genealogical relationship. Parent, spouse, and shared-parent sibling lines are drawn only from recorded relationship data. When a displayed person's family of origin is known but their parents are outside the current proof scope, the renderer uses a lighter individual ancestry-continuation stem rather than drawing a horizontal rail that would falsely imply visible or shared parents.

## GEDCOM and population coverage

The current view is a deliberately scoped proof/stress population, not the entire genealogy. `src/proof-family.js` defines the deterministic **430-person** scope from the supplied GEDCOM and preserves GEDCOM identifiers as stable external identifiers.

The expansion sequence is deliberately bounded: approved 53-person base → siblings/spouses to 139 → children of those existing 139 people plus required co-parents to 430. Newly added children and co-parents do not recursively expand. This provides a much denser descendant/family-separation test without silently turning the proof renderer into a full-GEDCOM import.

The current prototype reads the supplied GEDCOM directly during the proof phase. Future import, database, and media work must preserve the same stable GEDCOM identifiers and keep sourced facts distinct from inferred or user-entered information.

## Media direction

The globe renderer accepts a person's current `photo` as a display source, but future user-managed media will not depend on editing the GEDCOM. The planned media model gives each stable person record one profile/frame image plus a separately managed gallery whose images can be uploaded, captioned, dated, annotated, removed, or promoted to profile status over time. The detailed requirements are tracked in `FUTURE_ENHANCEMENTS.md`.

## Architecture

- `src/geometry.js` owns spherical placement, camera projection, visible-horizon tests, anchored plaque frames, and capacity math.
- `src/camera-behavior.js` owns the deterministic zoom-to-view-angle, zoom-to-pan-speed, focus framing, and motion curves.
- `src/layout.js` owns GEDCOM-family-aware person placement and the canonical gap hierarchy.
- `src/globe-webgl.js` owns the GPU UV sphere, Upper Peninsula atlas alignment, layered textures, generated cartographic labels, antique color treatment, texture sharpening, and hidden-surface handling.
- `src/atlas-map.js` owns atlas asset URLs, provenance metadata, and the canonical home geographic anchor.
- `src/scene.js` owns interaction, shared runtime sphere rotation/camera state, evidence-based genealogy connectors, adaptive family-route planning, ancestry-continuation stems, reusable hover-card hit testing/content, physical globe radius, and the 2D person overlay. It consumes the canonical curves from `camera-behavior.js` rather than duplicating zoom behavior.
- `src/plaque.js` owns the old-glass portrait medallion and wood nameplate.
- `src/plaque-metal.js` owns the canonical male, female, and unspecified plaque-metal palettes.
- `src/plaque-projection.js` maps the rigid plaque artwork onto its projected 3D plane while preserving its sphere attachment point.
- `src/relationships.js` derives human-readable kinship labels from recorded relationship data.
- `src/gedcom.js` normalizes preserved alternate names and saved source/citation records for Person Details and hover summaries.
- `src/gedcom-family-parser.js` parses and validates GEDCOM family records used by the proof-tree builder.
- `src/proof-family.js` owns the current deterministic proof/stress-population scope.
- `src/data.js` loads the GEDCOM, validates it, builds the proof population, and attaches prototype portraits.
- `src/version.js` is the sole application-version source.

## Data and storage

The current proof app reads the supplied GEDCOM directly and validates its family graph before building the displayed population. Prototype family notes currently remain in browser local storage. Data-quality notes remain separate from family notes.

Any future Supabase objects for this application must use the project-specific `lazy_acres_ancestry_` prefix because the personal Supabase project is shared with other applications. The intended permanent image archive remains Cloudflare R2.

## Test

GitHub Actions syntax-checks every source module and executes every `tests/*.test.mjs` file. The deterministic suite includes geometry, camera behavior, family routing, family-aware layout, plaque projection and metal palettes, GEDCOM parsing, proof-family scope, relationship labels, interaction, and WebGL atlas tests.

The family-routing and layout regressions specifically guard against merging distinct GEDCOM families, interleaving children from different spouse families, fabricating sibling rails for omitted parents, attaching unrelated people to a one-child family, and allowing ancestry continuations to collapse back to hairline strokes. The proof-family stress test runs the full 430-person population through family-aware layout. The interaction test covers reusable hover details as well as selected-person zoom anchoring so wheel zoom cannot silently switch the focus person.

## Hosting

The prototype publishes from canonical `main` through GitHub Pages during testing. The eventual production target is Cloudflare.
