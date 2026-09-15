# Future Enhancements

This file tracks requested work that is intentionally not part of the current prototype build.

## Globe interaction and scale

- Re-tune the default camera distance after the current zoom-dependent camera behavior is visually verified against the approved atlas reference.
- Re-check plaque legibility, picking, connector weights, and texture filtering after each dense-family stress test.
- Until the UI is approved, each substantial UI revision should also expand the visible GEDCOM family scope by one deliberate family layer so the interface is tested against steadily increasing real genealogy density.

## Personal geography

- Continue the evidence-backed **Personal Geography** overlay when a person is selected. Build it from normalized life events such as birth, residence/census, marriage, work, military service, immigration/emigration, death, burial, and explicitly documented travel.
- Do **not** add a family-region or branch-region aggregate overlay. The map should show the selected person's documented geography only.
- Keep each lived-region footprint tightly centered on the resolved city/town rather than painting broad county, state, country, or continental areas when the evidence is more precise.
- Use soft feathered person-region swatches with no hard geographic outline.
- When two documented lived locations establish movement, connect them with a thin restrained travel swatch/path. Do not turn that connector into a broad corridor or density region.
- Weight and style the footprint by what the evidence actually establishes. A documented residence can contribute more strongly than a one-time event, and a town-level fact should be tighter than a county/state/country-level fact.
- Keep documented locations, inferred locations, and uncertain geocoding visually and structurally distinct. Never invent a route merely because two records happen to exist; route rendering should remain a simple visual connection between documented locations unless actual travel evidence is available.
- Later add a time control so a person's geography can be viewed through time, revealing movement without treating genealogy layout positions as literal locations.
- Normalize places once and cache reviewed coordinates, geographic precision, source provenance, and confidence so repeated historical place names do not require repeated geocoding.
- Move the visible geography overlay to a sphere-aware WebGL texture/mask when density requires it so it rotates, foreshortens, clips at the horizon, and remains locked to the atlas surface.

## Home person

- Add a **Make home person** action to Person Details.
- When selected, that person becomes the reference point for named relationships, family-side calculations, navigation, and the Home / Return button.
- Persist the chosen home person so it survives a reload and can later follow the same signed-in user across devices.
- Preserve a clear way to restore Tod as the default home person.
- When a home person has a known geographic home anchor, allow the atlas to use that location as the visual home point without implying that genealogy layout positions are literal birth/residence coordinates.

## Shared notes

- Move browser-local family notes into ancestry-prefixed Supabase storage after authentication and write-safe RLS are in place.
- Preserve author, created date/time, edit history, and person linkage.

## GEDCOM source records and complete family graph

- Normalize the full GEDCOM source/citation structures into the ancestry-prefixed working data model while preserving the original GEDCOM unchanged as source evidence.
- Preserve the complete parent/spouse graph and all stable GEDCOM IDs needed for deeper generations, siblings, descendants, and spouse/co-parent family units.
- Preserve saved record titles, citation/page text, repositories, source identifiers, URLs when present, and their links to specific people/facts.
- Keep source records distinct from family notes and data-quality warnings.
- Before expanding from the prototype into the full family population, create and review a corrected working copy of the GEDCOM that fixes only defensible errors while preserving all non-error records.

## Media and galleries

- Let the user add images directly to a person's record over time without requiring a GEDCOM re-import.
- Give each person one explicit **profile/frame image** used on the globe plus a gallery of additional photographs, scans, portraits, documents, and other media.
- Add upload, replace, remove, caption, date, and note controls in Person Details / Gallery.
- Allow any gallery image to be promoted with **Use as profile image** and allow the profile image to be changed without deleting the underlying gallery item.
- Store media against the stable GEDCOM/person identifier so images survive layout changes and future GEDCOM refreshes.
- Preserve media provenance separately from genealogy facts: uploader/source, original filename, caption, date, rights/permission status when relevant, and whether an image is imported, user-added, or inferred.
- Connect Person Details and galleries to ancestry-prefixed Supabase media and media-person tables once authentication, write-safe RLS, and the real media archive are in place.
- Keep the permanent binary image archive in controlled storage such as Cloudflare R2 rather than embedding large media in the public GitHub repository.
