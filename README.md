# Lazy Acres Ancestry

Interactive genealogy atlas built from the supplied Ancestry data.

## Current prototype

The app uses a spherical family-atlas view with fixed physical person plaques anchored to the same globe as the family connectors. The current proof population contains **430 people**, generated deterministically from the supplied GEDCOM. It starts with the approved 53-person proof tree, adds the established non-recursive sibling/spouse breadth step to reach 139 people, then adds every GEDCOM-recorded child of those 139 people plus 42 otherwise-missing co-parents required to keep the displayed child families complete. The child/co-parent expansion is deliberately non-recursive.

The 430-person population is intentionally a family-separation stress test. It includes real cases where one displayed parent has children in more than one GEDCOM family, so the renderer must keep those spouse/child families visually distinct rather than merely handling a tidy ancestor tree.

The renderer remains scalable to the full genealogy without one DOM element per person. Person plaques and relationships remain Canvas/WebGL content; hover details use one reusable DOM tooltip rather than a tooltip node for every person.

The working globe radius is **225 physical layout units**, so the visible genealogy occupies a relatively flat-looking patch of the sphere while leaving substantial surface area for deeper generations. Person plaques remain fixed-size physical objects and use the larger portrait/name scale established by the approved visual reference.

## Globe renderer

The world map is rendered as a genuine GPU-textured sphere rather than as Canvas 2D affine map triangles.

- `src/globe-webgl.js` builds a dense latitude/longitude sphere mesh with perspective-correct UV mapping. The normal production mesh is 360 x 180 segments, deliberately near the practical 16-bit index limit used by the current WebGL path.
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

The current label treatment is dark wood with engraved-style lettering and restrained aged-metal trim. Male plaques use a darker oil-rubbed bronze treatment, female plaques use a warmer redder rose bronze, and unspecified sex uses aged pewter. Portrait/plaque dimensions remain fixed physical dimensions on the sphere. Date typography is intentionally smaller than the person name so the name remains the dominant reading level even when a full birth/death date wraps to two lines.

## Current interaction

- Drag the atlas surface to rotate the globe.
- Drag sensitivity follows a curved zoom response rather than a global speed multiplier. Close and normal inspection are now substantially slower, medium zoom remains restrained, and the far overview keeps enough speed for broad navigation.
- Wheel or trackpad movement changes camera distance across a wide near/far range.
- Camera **angle** changes continuously with zoom through a smooth S-curve. Close views remain nearly perpendicular to the focused family patch; the view leans progressively as distance increases, without an early jump into an overview angle.
- The focused family moves gradually higher in the viewport as the view widens. At the far end the sphere center remains high enough to keep most of the globe visible instead of leaving a large empty sky area above a low globe.
- Hover continuously over a visible person plaque for **two seconds** on desktop to open the compact parchment information card. Brief pointer passes do not trigger the card.
- The hover card shows the named relationship to the home person, lifespan, known birth/death place information, immediate parent/spouse/child counts, profile image or initial, and up to two saved-record titles when available.
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

Relationship weight now changes continuously with zoom. The close inspection view retains the deliberately bold approximately 3.35-pixel primary stroke, while the overview tapers toward approximately 1.55 pixels. Ancestry-continuation stems taper from about 3.0 to 1.35 pixels. This keeps close relationships strong without turning a dense overview into a red lattice.

Genealogy connectors do not follow the WebGL mesh triangles. Their points are calculated analytically on the spherical surface and projected through the same camera as the globe. Connector sampling is adaptive to projected size: close or long lines receive many more surface samples than distant short lines, with a roughly 6-pixel static target and a looser moving target for responsive dragging. This removes the visible polygonal bends produced by the former fixed 12-sample rule without globally increasing the globe mesh.

Each family route is painted as one connected visual unit. Its partner bar, descent, family rail, and child stems share one halo-first/color-second paint sequence, so a connected component cannot erase another component at a join. Decorative junction nodes have been removed. Different families remain separately painted so the halo can still clarify genuine route crossings.

Each visible family rail corresponds to one recorded GEDCOM family where a family ID is available. Separate spouse/parent families remain separate routes even when they share one parent. Adaptive child stems normally rise about one portrait-frame height before turning into the horizontal family rail and extend farther only when another documented family route requires additional clearance.

The route planner now scores more than horizontal rail collisions. It also penalizes near-parallel vertical runs and horizontal/vertical crossings, and the minimum parallel-rail clearance is larger than before. The planner uses available generation space to choose a less crowded rail height rather than mechanically taking the first legal lane.

A one-child family no longer receives a tiny decorative dogleg merely because the child is a little off the exact couple midpoint. When the child lies beneath the couple span and the horizontal correction is below a portrait-relative threshold, the family uses a straight vertical descent instead. A meaningful horizontal offset still retains normal family routing.

Connectors remain evidence-based. A layout grouping may influence where a person is placed, but it can never create a genealogical relationship. Parent, spouse, and shared-parent sibling lines are drawn only from recorded relationship data. When a displayed person's family of origin is known but their parents are outside the current proof scope, the renderer uses a lighter individual ancestry-continuation stem rather than drawing a horizontal rail that would falsely imply visible or shared parents.

## GEDCOM and population coverage

The current view is a deliberately scoped proof/stress population, not the entire genealogy. `src/proof-family.js` defines the deterministic **430-person** scope from the supplied GEDCOM and preserves GEDCOM identifiers as stable external identifiers.

The expansion sequence is deliberately bounded: approved 53-person base → siblings/spouses to 139 → children of those existing 139 people plus required co-parents to 430. Newly added children and co-parents do not recursively expand. This provides a much denser descendant/family-separation test without silently turning the proof renderer into a full-GEDCOM import.

The current prototype reads the supplied GEDCOM directly during the proof phase. Future import, database, and media work must preserve the same stable GEDCOM identifiers and keep sourced facts distinct from inferred or user-entered information.

### Saved-record links

Ancestry GEDCOM exports can preserve `_APID` record identifiers on source citations. When a saved record has a valid `_APID`, the parser now reconstructs the corresponding Ancestry discovery-record URL and Person Details exposes it through the existing **Open record** link. Records without a usable `_APID` remain descriptive rather than receiving a guessed URL. Opening an Ancestry record may still require the viewer to sign in or have the appropriate Ancestry access.

A universal cross-site link is not inferred from a record title alone. A FamilySearch, archive, or other provider link should only be added when the imported citation carries a provider-specific identifier or URL that can be resolved deterministically.

## Media direction

The globe renderer accepts a person's current `photo` as a display source, but future user-managed media will not depend on editing the GEDCOM. The planned media model gives each stable person record one profile/frame image plus a separately managed gallery whose images can be uploaded, captioned, dated, annotated, removed, or promoted to profile status over time. The detailed requirements are tracked in `FUTURE_ENHANCEMENTS.md`.

## Architecture

- `src/geometry.js` owns spherical placement, camera projection, visible-horizon tests, anchored plaque frames, and capacity math.
- `src/camera-behavior.js` owns the deterministic zoom-to-view-angle, curved zoom-to-pan-speed response, focus framing, and motion curves.
- `src/layout.js` owns GEDCOM-family-aware person placement and the canonical gap hierarchy.
- `src/globe-webgl.js` owns the GPU UV sphere, Upper Peninsula atlas alignment, layered textures, generated cartographic labels, antique color treatment, texture sharpening, and hidden-surface handling.
- `src/atlas-map.js` owns atlas asset URLs, provenance metadata, and the canonical home geographic anchor.
- `src/scene.js` owns interaction, shared runtime sphere rotation/camera state, evidence-based genealogy connectors, adaptive family-route planning, route-conflict scoring, zoom-dependent relationship weights, adaptive surface-line sampling, same-family halo/stroke paint order, two-second hover intent, ancestry-continuation stems, physical globe radius, and the 2D person overlay.
- `src/plaque.js` owns the old-glass portrait medallion, wood nameplate, and the canonical name/date typography hierarchy.
- `src/plaque-metal.js` owns the canonical male, female, and unspecified plaque-metal palettes.
- `src/plaque-projection.js` maps the rigid plaque artwork onto its projected 3D plane while preserving its sphere attachment point.
- `src/relationships.js` derives human-readable kinship labels from recorded relationship data.
- `src/gedcom.js` normalizes preserved alternate names and saved source/citation records for Person Details and hover summaries.
- `src/gedcom-family-parser.js` parses and validates GEDCOM family records, preserves Ancestry `_APID` citation references, and derives deterministic Ancestry saved-record URLs when possible.
- `src/proof-family.js` owns the current deterministic proof/stress-population scope.
- `src/data.js` loads the GEDCOM, validates it, builds the proof population, and attaches prototype portraits.
- `src/version.js` is the sole application-version source.

## Data and storage

The current proof app reads the supplied GEDCOM directly and validates its family graph before building the displayed population. Prototype family notes currently remain in browser local storage. Data-quality notes remain separate from family notes.

Any future Supabase objects for this application must use the project-specific `lazy_acres_ancestry_` prefix because the personal Supabase project is shared with other applications. The intended permanent image archive remains Cloudflare R2.

## Test

GitHub Actions syntax-checks every source module and executes every `tests/*.test.mjs` file. The deterministic suite includes geometry, camera behavior, family routing, family-aware layout, plaque projection and typography, plaque metal palettes, GEDCOM parsing, saved-record links, proof-family scope, relationship labels, interaction, and WebGL atlas tests.

The family-routing and layout regressions specifically guard against merging distinct GEDCOM families, interleaving children from different spouse families, fabricating sibling rails for omitted parents, attaching unrelated people to a one-child family, reverting to coarse fixed surface-line sampling, stacking overlapping rails too closely, preserving tiny one-child doglegs, or reintroducing junction-node paint. Zoom-aware relationship tests guard the close-to-overview stroke taper. The interaction regression requires two seconds of hover intent while continuing to cover selected-person zoom anchoring. Separate tests guard the smaller date typography and deterministic Ancestry `_APID` record links.

The proof-family stress test runs the full 430-person population through family-aware layout.

## Hosting

The prototype publishes from canonical `main` through GitHub Pages during testing. The eventual production target is Cloudflare.
