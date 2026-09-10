# Lazy Acres Ancestry

Interactive genealogy atlas built from the supplied Ancestry data.

## Current prototype

The app uses a spherical family-atlas view with fixed-size person plaques projected onto the globe surface. Apparent size and foreshortening come from perspective and curvature rather than hand-tuned generation sizes.

The current sample uses Tod, Donna, Amy, Tod's parents, grandparents, and grandparent sibling groups from project-specific Supabase tables. The production model is sized for the 9,099-person family data without rendering thousands of DOM nodes.

The visible sphere is intentionally somewhat larger than the minimum capacity calculation so the local family neighborhood reads flatter while the horizon remains visible.

## Current interaction

- Drag the atlas surface to rotate it.
- Use the mouse wheel or trackpad to move closer or farther away.
- Click a person to rotate that branch into focus.
- Use `Return to Tod` or Home to restore the home person.
- Search the current sample by name.
- Open People for filters by family side, century, relationship distance, and name.
- Person details include a photo-gallery entry point and chronological notes.
- Each new note is stored as a separate entry with author, date, time, and body.
- The app checks the canonical version source periodically and reloads itself when a newer deployed version appears.

## Visual grammar

- Person portraits use a larger antique oval gold medallion with a stronger convex old-glass treatment.
- Name and life dates sit on a parchment scroll with curled ends rather than a flat banner.
- Family spacing is compact by default and only opens where branch crowding requires it.
- Couple and descent connectors use conventional genealogy grammar: partner bar, central descent line, sibling rail, and child stems.
- Connectors are evidence-based. Layout grouping is never allowed to invent a genealogical relationship.
- The globe carries a deliberately fictional antique-atlas surface: pseudo-coastlines, islands, rivers, mountain marks, cartographic labels, rhumb lines, graticule, a compass rose, and engraved-style ship linework. It is decorative cartography, not a claim about real geography.
- Distant people use level-of-detail simplification rather than full readable plaques.

## Architecture

- `src/geometry.js` owns spherical placement, camera projection, tangent frames, and capacity math.
- `src/layout.js` maps the current sample family into a compact local surface neighborhood.
- `src/plaque.js` owns the old-glass portrait medallion and parchment-scroll rendering.
- `src/atlas-map.js` owns the reusable fictional antique-map geometry and ornament data.
- `src/scene.js` owns the single-canvas atlas renderer, horizon, cartographic projection, genealogy connectors, and direct manipulation.
- `src/data.js` owns the Supabase/bundled-sample boundary.
- `src/version.js` is the sole application-version source.
- `src/version-checker.js` checks that canonical source and reloads when a deployed version changes.

The geometry prototype still uses a single Canvas 2D render surface rather than a large DOM tree or a 3D framework. That keeps memory and dependencies small while the visual and navigation rules are being validated.

## Data and storage

The test app reads the shared personal Supabase project using project-specific objects prefixed `lazy_acres_ancestry_`. If Supabase is unavailable it falls back to `data/sample-family.json`.

Prototype family notes currently remain in browser local storage, but are structured as individual records so the eventual ancestry-prefixed shared store can preserve author and timestamps cleanly. Data-quality notes remain separate from family notes.

The complete GEDCOM is intentionally not committed to this public repository. The intended permanent image archive remains Cloudflare R2.

## Test

```bash
node tests/geometry.test.mjs
node tests/atlas-map.test.mjs
```

The geometry test verifies the full-tree sphere sizing calculation, perspective behavior, and evidence-based relationship grouping. The atlas-map test guards against the cartographic surface collapsing back into a handful of anonymous decorative lines.

## Hosting

The prototype publishes from canonical `main` through GitHub Pages during testing. The eventual production target is Cloudflare.
