# Lazy Acres Ancestry

Interactive spherical genealogy atlas built from the supplied Ancestry GEDCOM.

## Current prototype

The genealogy scope starts from the established **430-person** map population and recursively follows **every GEDCOM-recorded descendant** of every one of those people. Missing spouses/co-parents are included only when needed to show a descendant family correctly. A newly introduced supporting co-parent does not open unrelated spouse families unless that person was already one of the original 430 people or is also reached legitimately through a descendant path.

The current GEDCOM produces a logical tree of **1,645 people**: the 430-person established seed population, 792 deeper descendants, and 423 supporting spouses/co-parents. The complete logical tree remains loaded and searchable even when descendant branches are collapsed in the visible atlas.

The renderer remains Canvas/WebGL based rather than creating one DOM element per person. Person plaques and relationship lines stay in Canvas/WebGL; hover details use one reusable tooltip.

The working globe radius is **225 physical layout units**. Person plaques keep fixed physical dimensions on the sphere; apparent size and foreshortening come from projection rather than generation-specific sizing.

## Scalable tree view

v0.4.26 keeps the large-tree model as **full genealogy in memory, curated genealogy on screen**, and makes the controls easier to understand and find.

- The complete 1,645-person descendant closure remains the authoritative in-memory tree.
- The focused person can collapse or expand their descendant branch without deleting or unloading genealogy data.
- The collapse control stays visible at all times. When the focused person has no recorded descendants, the disabled control explains that state instead of disappearing.
- Search can still reach a person hidden inside a collapsed branch; focusing a hidden result restores the needed tree view.
- An **Expand all** control reports how many people are currently hidden.
- A density warning appears when the current viewport contains enough readable plaques to become visually crowded.
- Dense views are treated as a presentation problem, not as permission to discard relatives from the genealogy.

This is the foundation for supporting the complete GEDCOM at much larger scale. The eventual target is for frame cost to depend primarily on what is visible, while the full graph remains available for navigation, search, relationship logic, notes, and media.

## Large-tree rendering

The large-tree renderer now includes several scale controls exposed by the 1,645-person stress population.

- Family relationship topology and route planning are cached when family data changes instead of being rebuilt on every animation frame.
- Large-tree relationship routing runs in a Web Worker so route-conflict solving does not monopolize the browser UI thread.
- Relationship conflict scoring keeps cached segment geometry and rejects route pairs whose planar bounds cannot interact before detailed segment comparisons.
- Person plaques are projected for all relevant people but expensive plaque drawing is limited to the visible hemisphere and nearby viewport.
- Relationship polylines get a cheap coarse visibility pass before high-resolution spherical sampling.
- During camera motion, relationship lines remain visible but switch to the cheaper moving sample density and omit expensive shadows. Very small plaques can still be culled while moving.
- Relationship lines remain present at wide overview distances rather than disappearing behind a hard zoom threshold.
- The 8192 × 4096 rendered atlas is uploaded once. The shader relief slot uses a tiny neutral texture instead of decoding and uploading the same 8K artwork twice.

These changes preserve the complete descendant population. They improve renderer scaling rather than reducing genealogy scope to conceal performance problems.

## Rendered antique atlas

The canonical globe background is a **rendered antique map** rather than the coded fictional landmass drawing from v0.4.20.

- `assets/atlas-base.svg` keeps the 8192 × 4096 texture contract but embeds the rendered antique artwork as the map image.
- The current artwork is deliberately pale and low contrast so the map recedes behind plaques and genealogy lines.
- `assets/atlas-relief-neutral.svg` is a tiny neutral shader input; it prevents the rendered 8K atlas from being loaded into GPU memory twice.
- The prior coded fictional atlas is preserved separately as `assets/atlas-base-coded-fallback.svg`.
- The older neutral parchment/graticule treatment remains preserved as `assets/atlas-base-fallback.svg`.
- Real Earth relief and regional WMS overlays remain disabled so the rendered antique treatment is not interrupted by sharp modern imagery.
- `src/atlas-map.js` owns the canonical atlas choice and fallback metadata.

The current rendered artwork is a working visual direction, not a claim of geographic precision.

## Globe renderer

- `src/globe-webgl.js` renders the atlas on a true GPU UV sphere with perspective-correct texture mapping, depth testing, hidden-surface removal, mipmapping where supported, and anisotropic filtering where available.
- The normal production sphere mesh is 360 × 180 segments, near the practical 16-bit index limit used by the current path.
- The WebGL globe and genealogy overlay share runtime yaw, camera pitch, focal length, radius, and camera distance, keeping plaques and relationship geometry locked to the surface.
- Relationship lines do not follow mesh triangles. Their points are calculated analytically on the sphere and sampled adaptively according to projected size.

## Family spacing model

Base placement is owned by `src/layout.js` and uses named physical rules for couple spacing, sibling spacing, minimum person clearance, between-family spacing, and generation spacing.

`src/layout-spacing.js` adds the scalable family-view spacing pass. It operates on the canonical base layout rather than replacing GEDCOM relationship authority.

- spouses remain compact visual units;
- sibling units from the same recorded family stay contiguous;
- unrelated origin families receive substantially larger horizontal separation;
- every generation row enforces a hard physical center-to-center clearance so plaques cannot occupy the same surface space;
- direct-ancestor row anchors are preserved while collateral family blocks are spread;
- family grouping is derived from GEDCOM family identity and supporting-spouse metadata, not from person-specific visual exceptions.

The goal is to allocate a family enough horizontal territory for its own descendant structure before routing begins, reducing the need for sibling rails to pass through neighboring families.

## Relationship routing

Couple and descent connectors use conventional genealogy grammar: partner bar, descent trunk, family rail, and child stems. Colors remain related brick/iron-oxide tones with a parchment halo for separation from the map.

Routing scores visual congestion:

- overlapping horizontal family rails are strongly penalized;
- near-parallel vertical stems are penalized heavily;
- vertical stems crossing busy horizontal rails are strongly penalized;
- available generation space is used for alternate rail heights;
- multi-child family trunks may slide a bounded distance along the parent/couple bar to find a clearer descent corridor;
- the couple midpoint remains preferred, so trunk movement occurs only when it materially reduces conflicts.

For one-child families, tiny decorative doglegs are suppressed. If the child lies beneath the couple span and the horizontal correction is small, the family uses a straight vertical descent.

At overview scale, line weight and sampling are reduced, but relationship geometry remains continuous during pan, zoom, and overview so the family structure does not blink in and out.

Connectors remain evidence-based. Layout can change placement, but it cannot invent a parent, spouse, or sibling relationship.

## Person plaques

Person plaques are rigid physical objects in the local tangent plane of the globe. They do not rotate to face the camera independently of the sphere.

The current visual treatment uses dark wood nameplates with aged-metal trim. Male plaques use darker oil-rubbed bronze, female plaques use warmer rose bronze, and unspecified sex uses aged pewter.

Name typography remains dominant. Date typography uses a preferred size of about **4.9% of plaque width**, with a **3.5%** minimum for long wrapped dates.

## Interaction

- Drag rotates the globe.
- Drag sensitivity uses a curved zoom response. Tight inspection is slower, while wide overview speed remains efficient.
- Wheel/trackpad movement changes camera distance across the supported near/far range.
- Camera angle changes continuously with zoom through a smooth curve rather than jumping between modes.
- Wheel zoom preserves the selected person's screen coordinate.
- During motion, relationship lines stay visible using the cheaper moving sample density while very small plaques may be culled.
- Desktop hover requires **1.25 seconds** of continuous intent before the compact person card appears.
- Click a person to focus that branch and open full Person Details.
- The branch control is always visible. When the focused person has recorded children, **Collapse descendants** hides the descendant closure below that person while leaving the focused person and spouse visible.
- When a focused person has no recorded children, the control remains visible but disabled and says **No descendants to collapse**.
- **Expand descendants** restores that focused branch; **Expand all** restores every collapsed branch.
- Dense-view warnings are based on plaques actually readable in the current viewport.
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

Cross-site links are not inferred from titles alone.

## Architecture

- `src/geometry.js` owns spherical placement, projection, horizon tests, plaque frames, and sphere-capacity math.
- `src/camera-behavior.js` owns the zoom-to-view-angle curve, curved zoom-to-pan-speed response, focus framing, and motion timing.
- `src/layout.js` owns canonical GEDCOM-family-aware base placement, generation assignment, direct-ancestor spine centering, and collateral-family alignment.
- `src/layout-spacing.js` owns scalable family-block spreading and hard same-row plaque clearance.
- `src/globe-webgl.js` owns the WebGL UV sphere, atlas texture rendering, and hidden-surface handling.
- `src/atlas-map.js` owns the rendered atlas, lightweight neutral relief input, and preserved fallback assets.
- `src/scene-core.js` owns the low-level camera, projection, Canvas plaque drawing, evidence-based relationship grouping, route geometry, surface sampling, and hover mechanics.
- `src/scene.js` owns the scalable scene layer: family spacing integration, background route worker, collapse/expand state, viewport-density warnings, and moving/overview level-of-detail policy.
- `src/relationship-worker.js` performs expensive family-route planning off the UI thread.
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

The app reads the supplied GEDCOM directly and validates its family graph before building the logical population. Prototype family notes remain in browser local storage; data-quality notes remain separate from ordinary family notes.

Any future Supabase objects for this app must use the `lazy_acres_ancestry_` prefix because the personal Supabase project is shared with other applications. The intended permanent media archive remains Cloudflare R2.

## Testing

GitHub Actions syntax-checks every `src/*.js` module and runs every `tests/*.test.mjs` file on canonical `main`.

Regression coverage includes:

- GEDCOM parsing and relationship authority;
- exact reproduction of the established 430-person seed population;
- independent verification that every descendant of those 430 seeds is present and unrelated supporting branches are not pulled in;
- layout of the recursively expanded population;
- distinct GEDCOM family blocks when parents have multiple spouse families;
- family-aware same-row spacing and non-interleaving origin-family blocks;
- direct-ancestor spine centering without shifting collateral single-child families;
- recursive descendant collapse while preserving the selected anchor, its spouse, ancestors, and unrelated branches;
- relationship-line continuity during camera motion and overview;
- persistent, discoverable branch-collapse controls;
- near-parallel and crossing route avoidance;
- bounded descent-corridor trunk shifting;
- suppression of tiny single-child doglegs;
- adaptive spherical line sampling and zoom-dependent line thickness;
- same-family halo/stroke paint order and absence of junction nodes;
- 1.25-second hover intent;
- close-to-overview panning curves and camera angle behavior;
- plaque projection and typography;
- rendered-atlas ownership, lightweight neutral relief, and preservation of prior fallback treatments;
- deterministic Ancestry `_APID` record links;
- browser-module linkage for the canonical GEDCOM loading path.

## Hosting

The prototype publishes from canonical `main` through GitHub Pages during testing. The eventual production target is Cloudflare.
