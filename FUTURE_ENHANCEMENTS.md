# Future Enhancements

This file tracks requested work that is intentionally not part of the current prototype build.

## Home person

- Add a **Make home person** action to Person Details.
- When selected, that person becomes the reference point for named relationships, family-side calculations, navigation, and the Home / Return button.
- Persist the chosen home person so it survives a reload and can later follow the same signed-in user across devices.
- Preserve a clear way to restore Tod as the default home person.

## Shared notes

- Move browser-local family notes into ancestry-prefixed Supabase storage after authentication and write-safe RLS are in place.
- Preserve author, created date/time, edit history, and person linkage.

## GEDCOM source records and complete family graph

- Re-import the full GEDCOM source/citation structures rather than only the current prototype birth, death, and alternate-name subset.
- Restore the complete parent/spouse graph and all stable GEDCOM IDs needed for Donna's ancestry, deeper generations, siblings, and descendant branches.
- Preserve saved record titles, citation/page text, repositories, source identifiers, URLs when present, and their links to specific people/facts.
- Keep source records distinct from family notes and data-quality warnings.
- After the complete graph is restored, run the requested high-density visual test: siblings for visible family groups, Donna's side to the same generation depth, one additional ancestral generation with siblings, and descendants for the displayed families.

## Media

- Connect Person Details and galleries to the ancestry-prefixed media and media-person tables once the real media archive is populated.
