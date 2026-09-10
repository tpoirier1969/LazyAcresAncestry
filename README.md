# Lazy Acres Ancestry

Interactive genealogy atlas built from the supplied Ancestry GEDCOM.

## Current prototype

Version 0.3.0 uses a spherical family-atlas view with fixed-size person plaques projected onto the globe surface. Apparent size and foreshortening come from perspective and curvature rather than hand-tuned generation sizes.

The current sample uses Tod, Donna, Amy, Tod's parents, grandparents, and grandparent sibling groups from project-specific Supabase tables. The production model is sized for the 9,099-person GEDCOM without rendering thousands of DOM nodes.

The sphere sizing model produces a diameter of about 78 plaque-widths for 9,099 people. The current camera is intentionally near the surface so the globe horizon remains visible while the focused family neighborhood stays readable.

## Current interaction

- Drag the atlas surface to rotate it.
- Use the mouse wheel or trackpad to move closer or farther away.
- Click a person to rotate that branch into focus.
- Use `Return to Tod` or Home to restore the home person.
- Search the current sample by name.
- Open People for filters by family side, century, relationship distance, and name.
- Person details include a photo-gallery entry point and notes.
- The app checks the canonical version source periodically and reloads itself when a newer deployed version appears.

## Visual grammar

- Person portraits use an antique oval gold medallion with a convex old-glass treatment and a parchment scroll for name and dates.
- Couple and descent connectors use conventional genealogy grammar: partner bar, central descent line, sibling rail, and child stems. They are projected onto the spherical surface rather than drawn as arbitrary point-to-point diagonals.
- The globe uses subdued antique-map linework and graticule instead of anonymous background markers.
- Distant people will use level-of-detail simplification rather than full readable plaques.

## Architecture

- `src/geometry.js` owns spherical placement, camera projection, tangent frames, and capacity math.
- `src/layout.js` maps the current sample family into a local surface neighborhood.
- `src/plaque.js` owns the old-glass portrait medallion and parchment-scroll rendering.
- `src/scene.js` owns the single-canvas atlas renderer, horizon, map treatment, genealogy connectors, and direct manipulation.
- `src/data.js` owns the Supabase/bundled-sample boundary.
- `src/version.js` is the sole application-version source.
- `src/version-checker.js` checks that canonical source and reloads when a deployed version changes.

The geometry prototype still uses a single Canvas 2D render surface rather than a large DOM tree or a 3D framework. That keeps memory and dependencies small while the visual and navigation rules are being validated.

## Data and storage

The test app reads the shared personal Supabase project using project-specific objects prefixed `lazy_acres_ancestry_`. If Supabase is unavailable it falls back to `data/sample-family.json`.

Prototype notes currently remain in browser local storage. Production notes, comments, media metadata, provenance, and matching evidence belong in the ancestry-prefixed Supabase schema.

The complete GEDCOM is intentionally not committed to this public repository. The intended permanent image archive remains Cloudflare R2.

## Test

```bash
node tests/geometry.test.mjs
```

The geometry test verifies the full-tree sphere sizing calculation and checks that equal physical plaques shrink smoothly and monotonically with increasing surface distance.

## Hosting

The prototype publishes from canonical `main` through GitHub Pages during testing. The eventual production target is Cloudflare.
