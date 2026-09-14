# Future Enhancements

This file tracks requested work that is intentionally not part of the current prototype build.

## Globe interaction and scale

- Re-tune the default camera distance after the current zoom-dependent camera behavior is visually verified against the approved atlas reference.
- Re-check plaque legibility, picking, connector weights, and texture filtering after the next dense-family stress test.

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

- Re-import the full GEDCOM source/citation structures rather than only the current prototype birth, death, and alternate-name subset.
- Restore the complete parent/spouse graph and all stable GEDCOM IDs needed for Donna's ancestry, deeper generations, siblings, and descendant branches.
- Preserve saved record titles, citation/page text, repositories, source identifiers, URLs when present, and their links to specific people/facts.
- Keep source records distinct from family notes and data-quality warnings.
- After the complete graph is restored, run the requested high-density visual test: siblings for visible family groups, Donna's side to the same generation depth, one additional ancestral generation with siblings, and descendants for the displayed families.

## Media and galleries

- Let the user add images directly to a person's record over time without requiring a GEDCOM re-import.
- Give each person one explicit **profile/frame image** used on the globe plus a gallery of additional photographs, scans, portraits, documents, and other media.
- Add upload, replace, remove, caption, date, and note controls in Person Details / Gallery.
- Allow any gallery image to be promoted with **Use as profile image** and allow the profile image to be changed without deleting the underlying gallery item.
- Store media against the stable GEDCOM/person identifier so images survive layout changes and future GEDCOM refreshes.
- Preserve media provenance separately from genealogy facts: uploader/source, original filename, caption, date, rights/permission status when relevant, and whether an image is imported, user-added, or inferred.
- Connect Person Details and galleries to ancestry-prefixed Supabase media and media-person tables once authentication, write-safe RLS, and the real media archive are in place.
- Keep the permanent binary image archive in controlled storage such as Cloudflare R2 rather than embedding large media in the public GitHub repository.
