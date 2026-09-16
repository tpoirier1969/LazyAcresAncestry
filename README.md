# Lazy Acres Ancestry

Interactive spherical genealogy atlas built from the supplied Ancestry GEDCOM.

## Current prototype

The displayed genealogy starts from the established **430-person** map population and recursively follows **every GEDCOM-recorded descendant** of every one of those people. Missing spouses/co-parents are included only when needed to show a descendant family correctly. A newly introduced supporting co-parent does not open unrelated spouse families unless that person was already one of the original 430 people or is also reached legitimately through a descendant path.

The current GEDCOM produces **1,645 displayed people**: the 430-person established seed population, 792 deeper descendants, and 423 supporting spouses/co-parents. The final displayed population is derived dynamically from the GEDCOM descendant closure rather than being held to a manually chosen final count.

The renderer remains Canvas/WebGL based rather than creating one DOM element per person. Person plaques and relationship lines stay in Canvas/WebGL; hover details use one reusable tooltip.

The working globe radius is **225 physical layout units**. Person plaques keep fixed physical dimensions on the sphere; apparent size and foreshortening come from projection rather than generation-specific sizing.

## Large-tree rendering

v0.4.22 addresses the first renderer bottlenecks exposed by the 1,645-person descendant tree.

- Family relationship topology and route planning are cached when the family data changes instead of being rebuilt on every animation frame.
- Large-tree route planning is deferred until after the first browser paint, allowing the atlas and interface to appear before the expensive routing pass finishes.
- Relationship conflict scoring keeps cached segment geometry and first rejects route pairs whose planar bounds cannot interact, avoiding needless segment-by-segment comparisons across distant families.
- Person plaques are projected for all people but expensive plaque texture/projection drawing is limited to people on the visible hemisphere and near the current viewport.
- Relationship polylines get a cheap coarse visibility pass before high-resolution spherical sampling. Off-screen/far-side lines are skipped rather than receiving hundreds of unnecessary surface samples.
- The 8192 × 4096 rendered atlas is uploaded once. The shader's relief slot now uses a tiny 2 × 2 neutral texture instead of decoding and uploading the same 8K artwork a second time.

These changes preserve the complete descendant population. They fix renderer scaling rather than reducing genealogy scope to conceal the performance problem.

## Rendered antique atlas

The canonical globe background is a **rendered antique map** rather than the coded fictional landmass drawing from v0.4.20.

- `assets/atlas-base.svg` keeps the 8192 × 4096 texture contract but embeds the rendered antique artwork as the map image.
- The current artwork is deliberately pale and low contrast so the map recedes behind plaques and genealogy lines.
- `assets/atlas-relief-neutral.svg` is a tiny neutral shader input; it prevents the rendered 8K atlas from being loaded into GPU memory twice.
- The prior coded fictional atlas is preserved separately as `assets/atlas-base-coded-fallback.svg`.
- The older neutral parchment/graticule treatment remains preserved as `assets/atlas-base-fallback.svg`.
- Real Earth relief and regional WMS overlays remain disabled so the rendered antique treatment is not interrupted by sharp modern imagery.
- `src/atlas-map.js` owns the canonical atlas choice and fallback metadata.

The current rendered artwork is a working visual direction, not a claim of geographic precision. It resembles antique world cartography and is being evaluated primarily as a quiet background for the family tree.

## Globe renderer

- `src/globe-webgl.js` renders the atlas on a true GPU UV sphere with perspective-correct texture mapping, depth testing, hidden-surface removal, mipmapping where supported, and anisotropic filtering where available.
- The normal production sphere mesh is 360 × 180 segments, near the practical 16-bit index limit used by the current path.
- The WebGL globe and genealogy overlay share the same runtime yaw, camera pitch, focal length, radius, and camera distance, keeping plaques and relationship geometry locked to the surface.
- Relationship lines do not follow mesh triangles. Their points are calculated analytically on the sphere and sampled adaptively according to projected size. Close and long visible lines therefore receive many more samples than distant short lines.

## Family spacing model

Visible placement is owned by `src/layout.js` and uses named physical rules:

- `COUPLE_GAP` is the tightest spacing because spouses read as a unit.
- `SIBLING_GAP` separates siblings in one GEDCOM family.
- `MIN_PERSON_CLEARANCE` is the hard minimum center-to-center clearance.
- `BETWEEN_FAMILY_GAP` is deliberately larger than sibling spacing and gives descendant-bearing neighboring family blocks extra allowance.
- `GENERATION_GAP` provides consistent vertical generation spacing.

Layout grouping follows actual GEDCOM family identity. Children from different spouse families remain separate contiguous blocks even when they share one parent.

Direct ancestors remain centered on the home ancestry spine, but centering applies only to the direct-ancestor people. Collateral families are not shifted sideways merely because the home ancestry row needs centering.

## Relationship routing

Couple and descent connectors use conventional genealogy grammar: partner bar, descent trunk, family rail, and child stems. The colors remain related brick/iron-oxide tones with a parchment halo for separation from the map.

Relationship weight changes continuously with zoom. Close inspection retains the stronger stroke; overview views taper toward a thinner readable line so a dense tree does not become a red lattice.

Routing scores visual congestion:

- overlapping horizontal family rails are strongly penalized;
- near-parallel vertical stems are penalized heavily;
- vertical stems crossing busy horizontal rails are strongly penalized;
- available generation space is used for alternate rail heights;
- multi-child family trunks may slide a bounded distance along the parent/couple bar to find a clearer descent corridor;
- the couple midpoint remains preferred, so trunk movement occurs only when it materially reduces conflicts;
- family blocks receive modestly more horizontal breathing room before the router accepts a crowded descent.

For one-child families, tiny decorative doglegs are suppressed. If the child lies beneath the couple span and the horizontal correction is small, the family uses a straight vertical descent. A meaningful offset still retains normal family routing.

The route paint order remains halo-first and color-second for each complete family, preventing halo strokes from cutting gaps into connected junctions. Decorative junction nodes remain removed.

Connectors remain evidence-based. Layout can change placement, but it cannot invent a parent, spouse, or sibling relationship. When a person's family of origin is known but the parents are outside the displayed scope, the renderer uses a lighter individual ancestry-continuation stem rather than a false sibling rail.

## Person plaques

Person plaques are rigid physical objects in the local tangent plane of the globe. They do not rotate to face the camera independently of the sphere.

The current visual treatment uses dark wood nameplates with aged-metal trim. Male plaques use darker oil-rubbed bronze, female plaques use warmer rose bronze, and unspecified sex uses aged pewter.

Name typography remains dominant. Date typography sits between the earlier too-large and later too-small treatments: the preferred date size is about **4.9% of plaque width**, with a **3.5%** minimum for long wrapped dates.

## Interaction

- Drag rotates the globe.
- Drag sensitivity uses a curved zoom response. Tight inspection is slower, while wide overview speed remains efficient.
- Wheel/trackpad movement changes camera distance across the supported near/far range.
- Camera angle changes continuously with zoom through a smooth curve rather than jumping between modes.
- Wheel zoom preserves the selected person's screen coordinate.
- Desktop hover requires **1.25 seconds** of continuous intent before the compact person card appears. Moving away, panning, or zooming cancels the pending hover.
- The hover card includes named relationship, lifespan, known birth/death information, parent/spouse/child counts, profile image or initial, and up to two saved-record titles.
- Click a person to focus that branch and open full Person Details.
- `Return to Tod` restores the home person.
- People can be searched and filtered by family side, century, relationship distance, and name.

## GEDCOM descendant scope

`src/proof-family.js` owns a two-stage scope:

1. reproduce the established 430-person map exactly, preserving the earlier proof/breadth/child rules;
2. freeze those 430 people as the descendant seed population and recursively follow every recorded child from them until no further descendants remain.

The recursive traversal is intentionally directional. Children continue the traversal. A missing spouse/co-parent may be displayed to keep a family intact, but that supporting person's unrelated unions do not automatically open unless the person was part of the original seed or is also reached through a descendant line.

GEDCOM identifiers remain stable external identifiers throughout the app.

## GEDCOM and saved records

Ancestry GEDCOM exports can preserve `_APID` identifiers on citations. When one is present and valid, the parser reconstructs the corresponding Ancestry discovery-record URL and Person Details exposes it through **Open record**. Ancestry may still require sign-in or the appropriate subscription. Records without a deterministic provider identifier remain descriptive rather than receiving a guessed URL.

Cross-site links are not inferred from titles alone. FamilySearch or archive links should only be created from provider-specific identifiers or URLs.

## Architecture

- `src/geometry.js` owns spherical placement, projection, horizon tests, plaque frames, and sphere-capacity math.
- `src/camera-behavior.js` owns the zoom-to-view-angle curve, curved zoom-to-pan-speed response, focus framing, and motion timing.
- `src/layout.js` owns GEDCOM-family-aware placement, family spacing, direct-ancestor spine centering, and collateral-family alignment.
- `src/globe-webgl.js` owns the WebGL UV sphere, atlas texture rendering, and hidden-surface handling.
- `src/atlas-map.js` owns the rendered atlas, lightweight neutral relief input, and preserved fallback assets.
- `src/scene.js` owns interaction, runtime camera/sphere state, evidence-based relationship grouping, cached/deferred adaptive route planning, descent-corridor scoring, zoom-dependent line weights, viewport-culling, adaptive surface-line sampling, hover intent, and the Canvas person overlay.
- `src/plaque.js` owns portrait medallions, wood nameplates, and canonical plaque typography.
- `src/plaque-metal.js` owns the male/female/unspecified metal palettes.
- `src/plaque-projection.js` projects rigid plaque artwork onto each person's tangent plane.
- `src/relationships.js` derives human-readable kinship labels.
- `src/gedcom.js` normalizes alternate names and saved records for details/hover UI.
- `src/gedcom-family-parser.js` parses GEDCOM families, preserves source/citation identifiers, and resolves supported Ancestry `_APID` links.
- `src/proof-family.js` owns the established 430-person seed plus recursive descendant closure.
- `src/data.js` loads and validates the GEDCOM and attaches prototype media.
- `src/version.js` is the sole current application-version source.

## Data and storage

The app reads the supplied GEDCOM directly and validates its family graph before building the displayed population. Prototype family notes remain in browser local storage; data-quality notes remain separate from ordinary family notes.

Any future Supabase objects for this app must use the `lazy_acres_ancestry_` prefix because the personal Supabase project is shared with other applications. The intended permanent media archive remains Cloudflare R2.

## Testing

GitHub Actions syntax-checks every `src/*.js` module and runs every `tests/*.test.mjs` file on canonical `main`.

Regression coverage includes:

- GEDCOM parsing and relationship authority;
- exact reproduction of the established 430-person seed population;
- independent verification that every descendant of those 430 seeds is present and unrelated supporting branches are not pulled in;
- layout of the recursively expanded population;
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
- rendered-atlas ownership, lightweight neutral relief, and preservation of both prior fallback treatments;
- deterministic Ancestry `_APID` record links.

## Hosting

The prototype publishes from canonical `main` through GitHub Pages during testing. The eventual production target is Cloudflare.
