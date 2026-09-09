# Lazy Acres Ancestry

Interactive family-tree prototype generated from the supplied Ancestry.com GEDCOM.

## Prototype scope

The first view contains 44 people: Tod and Donna, Amy, Tod's parents, all four grandparents, and each grandparent's siblings. Large sibling groups are deliberately shown as expandable galleries so the primary lineage remains readable.

## Data

The test app reads from the shared personal Supabase project using project-specific tables prefixed `lazy_acres_ancestry_`. If Supabase cannot be reached, it falls back to `data/sample-family.json`.

The complete GEDCOM is intentionally **not** checked into this public repository. The bundled JSON is only the prototype subset.

## Images

Generic male/female silhouette portraits are used in the prototype. The intended permanent photo archive is Cloudflare R2, with database media records stored in Supabase.

## Hosting

The prototype is static and can run on GitHub Pages. The production target is Cloudflare.
