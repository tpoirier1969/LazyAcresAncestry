# Lazy Acres Ancestry

Interactive genealogy atlas built from the supplied Ancestry GEDCOM.

## Current prototype

Version 0.2.0 replaces the flat-card mockup with a spherical geometry prototype. Person plaques have a single fixed physical size on the family sphere; apparent size and foreshortening come from perspective and curvature rather than hand-tuned generation sizes.

The current sample uses Tod, Donna, Amy, Tod's parents, grandparents, and grandparent sibling groups from the project-specific Supabase tables. A lightweight procedural field models the density of the full 9,099-person GEDCOM without creating thousands of DOM nodes.

The sphere sizing model assumes roughly one plaque-width by 0.75 plaque-heights per person plus spacing, producing a required diameter of about 78 plaque-widths for 9,099 people. The prototype uses a 40-unit radius so the visible curvature and distance falloff are deliberately shallow.

## Controls

- Drag the atlas surface to rotate it.
- Use the mouse wheel or trackpad to move closer or farther away.
- Click a rendered sample person to rotate that point into focus.
- Search the current sample by name.

## Architecture

- `src/geometry.js` owns spherical placement, camera projection, tangent frames, and capacity math.
- `src/layout.js` maps the current sample family into a local surface neighborhood.
- `src/plaque.js` owns the old-glass portrait medallion and curled-ribbon rendering.
- `src/scene.js` owns the single-canvas atlas renderer and direct manipulation.
- `src/data.js` owns the Supabase/bundled-sample boundary.
- `src/version.js` is the sole application-version source.

No 3D framework is required for this geometry prototype. This keeps the render path small and lets us validate the visual physics before choosing whether production needs WebGL meshes for deeper material effects.

## Data and storage

The test app reads the shared personal Supabase project using project-specific tables prefixed `lazy_acres_ancestry_`. If Supabase is unavailable it falls back to `data/sample-family.json`.

The complete GEDCOM is intentionally not committed to this public repository. The intended permanent image archive remains Cloudflare R2, with media records, provenance, matching evidence, and comments in Supabase.

## Test

```bash
node tests/geometry.test.mjs
```

The geometry test verifies the full-tree sphere sizing calculation and checks that equal physical plaques shrink smoothly and monotonically with increasing surface distance.

## Hosting

The prototype is static and is intended to publish directly from `main` through GitHub Pages during testing. The eventual production target is Cloudflare.
