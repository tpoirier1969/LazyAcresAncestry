# Lazy Acres Ancestry

Interactive spherical genealogy atlas built from the supplied Ancestry GEDCOM.

## Current prototype

The current proof/stress population contains **430 people**. It starts with the approved 53-person proof tree, adds the established non-recursive sibling/spouse breadth step to reach 139 people, then adds every GEDCOM-recorded child of those 139 people plus the otherwise-missing co-parents required to keep those displayed child families complete. The child/co-parent expansion is deliberately non-recursive.

The 430-person set is intentionally difficult. It contains real cases where one person has children in more than one GEDCOM family, so layout and routing have to keep those families visually distinct rather than relying on a tidy ancestor-only tree.

The renderer remains scalable to the full genealogy without one DOM element per person. Person plaques and relationship lines stay in Canvas/WebGL; hover details use one reusable tooltip.

The working globe radius is **225 physical layout units**. Person plaques keep fixed physical dimensions on the sphere; apparent size and foreshortening come from projection rather than generation-specific sizing.

## Fictional antique atlas

The globe now uses a deliberately **fictional antique atlas** instead of recognizable modern Earth geography.

- `assets/atlas-base.svg` is an **8192 × 4096 vector atlas** with invented coastlines and islands, pale parchment land, blue-green seas, pseudo-Latin cartographic labels, ships, a sea creature, and a compass rose.
- The map is intentionally not geographically recognizable. It is decorative context for genealogy, not a migration or event-location map.
- Because the canonical atlas is vector artwork on an 8192 × 4096 canvas, it can be rasterized sharply as the sphere grows rather than locking the project to today's globe size.
- `assets/atlas-base-fallback.svg` preserves the previous neutral parchment/graticule map unchanged as a fallback asset.
- Real Earth relief and regional WMS overlays are disabled in fictional-atlas mode so recognizable geography cannot bleed through the invented map.
- The display treatment is deliberately lighter and more saturated than the previous atlas so bronze plaques and brick relationship lines do not sit in a uniformly muddy beige field.

`src/atlas-map.js` is the canonical owner of atlas assets and provenance. Its home anchor is now only a default orientation for the fictional sphere, not a claim that a person is placed over a real geographic location.

## Globe renderer

- `src/globe-webgl.js` renders the atlas on a true GPU UV sphere with perspective-correct texture mapping, depth testing, hidden-surface removal, mipmapping where supported, and anisotropic filtering where available.
- The normal production sphere mesh is 360 × 180 segments, near the practical 16-bit index limit used by the current path.
- The WebGL globe and genealogy overlay share the same runtime yaw, camera pitch, focal length, radius, and camera distance, keeping plaques and relationship geometry locked to the surface.
- Relationship lines do not follow mesh triangles. Their points are calculated analytically on the sphere and sampled adaptively according to projected size. Close and long lines therefore receive many more samples than distant short lines.

## Family spacing model

Visible placement is owned by `src/layout.js` and uses named physical rules:

- `COUPLE_GAP` is the tightest spacing because spouses read as a unit.
- `SIBLING_GAP` separates siblings in one GEDCOM family.
- `MIN_PERSON_CLEARANCE` is the hard minimum center-to-center clearance.
- `BETWEEN_FAMILY_GAP` is deliberately larger than sibling spacing and now gives descendant-bearing neighboring family blocks a small extra allowance.
- `GENERATION_GAP` provides consistent vertical generation spacing.

Layout grouping follows the actual GEDCOM family-of-origin identity. Children from different spouse families remain separate contiguous blocks even when they share one parent.

Direct ancestors remain centered on the home ancestry spine, but that centering is now applied only to the actual direct-ancestor people. It no longer shifts every collateral person in the same generation. This prevents a collateral single-child family from being dragged sideways merely because the home ancestry row needs centering.

## Relationship routing

Couple and descent connectors use conventional genealogy grammar: partner bar, descent trunk, family rail, and child stems. The colors remain related brick/iron-oxide tones with a parchment halo for separation from the map.

Relationship weight changes continuously with zoom. Close inspection retains the stronger stroke; overview views taper toward a thinner readable line so a dense tree does not become a red lattice.

Routing now actively scores visual congestion:

- overlapping horizontal family rails are strongly penalized;
- near-parallel vertical stems are penalized much more heavily than before;
- vertical stems crossing busy horizontal rails are strongly penalized;
- available generation space is used for alternate rail heights;
- multi-child family trunks may slide a bounded distance along the parent/couple bar to find a clearer **descent corridor**;
- the couple midpoint remains preferred, so trunk movement occurs only when it materially reduces conflicts;
- family blocks receive modestly more horizontal breathing room before the router accepts an ugly crowded descent.

For one-child families, tiny decorative doglegs are suppressed. If the child lies beneath the couple span and the horizontal correction is small, the family uses a straight vertical descent. A meaningful offset still retains normal family routing.

The route paint order remains halo-first and color-second for each complete family, preventing halo strokes from cutting gaps into connected junctions. Decorative junction nodes remain removed.

Connectors remain evidence-based. Layout can change placement, but it cannot invent a parent, spouse, or sibling relationship. When a person's family of origin is known but the parents are outside the displayed scope, the renderer uses a lighter individual ancestry-continuation stem rather than a false sibling rail.

## Person plaques

Person plaques are rigid physical objects in the local tangent plane of the globe. They do not rotate to face the camera independently of the sphere.

The current visual treatment uses dark wood nameplates with aged-metal trim. Male plaques use darker oil-rubbed bronze, female plaques use warmer rose bronze, and unspecified sex uses aged pewter.

Name typography remains dominant. Date typography in v0.4.20 sits between the earlier too-large treatment and the later too-small treatment: the preferred date size is about **4.9% of plaque width**, with a **3.5%** minimum for long wrapped dates. Date color is also slightly brighter for legibility.

## Interaction

- Drag rotates the globe.
- Drag sensitivity uses a curved zoom response. Tight inspection is slightly slower than before, while wide overview speed remains at the approved maximum for efficient traversal.
- Wheel/trackpad movement changes camera distance across the supported near/far range.
- Camera angle changes continuously with zoom through a smooth curve rather than jumping between modes.
- Wheel zoom preserves the selected person's screen coordinate.
- Desktop hover requires **1.25 seconds** of continuous intent before the compact person card appears. Moving away, panning, or zooming cancels the pending hover.
- The hover card includes named relationship, lifespan, known birth/death information, parent/spouse/child counts, profile image or initial, and up to two saved-record titles.
- Click a person to focus that branch and open full Person Details.
- `Return to Tod` restores the home person.
- People can be searched and filtered by family side, century, relationship distance, and name.

## GEDCOM and saved records

GEDCOM identifiers remain stable external identifiers throughout the app.

Ancestry GEDCOM exports can preserve `_APID` identifiers on citations. When one is present and valid, the parser reconstructs the corresponding Ancestry discovery-record URL and Person Details exposes it through **Open record**. Ancestry may still require sign-in or the appropriate subscription. Records without a deterministic provider identifier remain descriptive rather than receiving a guessed URL.

Cross-site links are not inferred from titles alone. FamilySearch or archive links should only be created from provider-specific identifiers or URLs.

## Architecture

- `src/geometry.js` owns spherical placement, projection, horizon tests, plaque frames, and sphere-capacity math.
- `src/camera-behavior.js` owns the zoom-to-view-angle curve, curved zoom-to-pan-speed response, focus framing, and motion timing.
- `src/layout.js` owns GEDCOM-family-aware placement, family spacing, direct-ancestor spine centering, and collateral-family alignment.
- `src/globe-webgl.js` owns the WebGL UV sphere, atlas texture rendering, and hidden-surface handling.
- `src/atlas-map.js` owns canonical atlas assets, fallback asset metadata, and fictional atlas orientation.
- `src/scene.js` owns interaction, runtime camera/sphere state, evidence-based relationship grouping, adaptive route planning, descent-corridor scoring, zoom-dependent line weights, adaptive surface-line sampling, hover intent, and the Canvas person overlay.
- `src/plaque.js` owns portrait medallions, wood nameplates, and canonical plaque typography.
- `src/plaque-metal.js` owns the male/female/unspecified metal palettes.
- `src/plaque-projection.js` projects rigid plaque artwork onto each person's tangent plane.
- `src/relationships.js` derives human-readable kinship labels.
- `src/gedcom.js` normalizes alternate names and saved records for details/hover UI.
- `src/gedcom-family-parser.js` parses GEDCOM families, preserves source/citation identifiers, and resolves supported Ancestry `_APID` links.
- `src/proof-family.js` owns the deterministic 430-person proof/stress scope.
- `src/data.js` loads and validates the GEDCOM and attaches prototype media.
- `src/version.js` is the sole current application-version source.

## Data and storage

The current proof app reads the supplied GEDCOM directly and validates its family graph before building the displayed population. Prototype family notes remain in browser local storage; data-quality notes remain separate from ordinary family notes.

Any future Supabase objects for this app must use the `lazy_acres_ancestry_` prefix because the personal Supabase project is shared with other applications. The intended permanent media archive remains Cloudflare R2.

## Testing

GitHub Actions syntax-checks every `src/*.js` module and runs every `tests/*.test.mjs` file.

Regression coverage includes:

- GEDCOM parsing and relationship authority;
- the deterministic 430-person proof population;
- distinct GEDCOM family blocks when parents have multiple spouse families;
- direct-ancestor spine centering without shifting collateral single-child families;
- near-parallel and crossing route avoidance;
- bounded descent-corridor trunk shifting;
- suppression of tiny single-child doglegs;
- adaptive spherical line sampling and zoom-dependent line thickness;
- same-family halo/stroke paint order and absence of junction nodes;
- 1.25-second hover intent;
- close-to-overview panning curves and camera angle behavior;
- plaque projection and typography;
- fictional-atlas ownership and preservation of the prior fallback atlas;
- deterministic Ancestry `_APID` record links.

## Hosting

The prototype publishes from canonical `main` through GitHub Pages during testing. The eventual production target is Cloudflare.
