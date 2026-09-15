# GEDCOM truth pipeline

The rendered family tree must be a projection of GEDCOM family records, not a reconstruction from surnames, generations, branch labels, visual proximity, or inferred relationships.

## Source of truth

Relationship truth comes from GEDCOM `FAM` records.

- `HUSB` and `WIFE` identify the recorded partners for that family record.
- `CHIL` identifies the children recorded in that family.
- A parent-child edge exists only when a person is listed as a spouse/parent in the same `FAM` record that lists the child.
- `FAMC/PEDI`, `ADOP`, and related child pedigree metadata must be preserved so adopted, foster, sealing, or other non-birth relationships are not silently converted into biological parentage.
- Names, dates, places, branch tags, and layout position must never create relationships.

## Import stages

1. Parse the raw GEDCOM into immutable individual and family records keyed by the original GEDCOM xrefs.
2. Validate every `FAM` reference. Missing people, duplicate xrefs, contradictory references, and orphan links are import errors or warnings, never opportunities for inference.
3. Build normalized family and parent-child records directly from the parsed `FAM` structures.
4. Run anchor regression checks for known relationships. These checks protect the parser but do not override the GEDCOM.
5. Build the display scope from the normalized graph.
6. Only after the graph passes validation may the renderer lay it out.

## Display scope

The current product scope is:

- the home person;
- the requested number of direct ancestors;
- the direct siblings of those included ancestors;
- descendants of those ancestor siblings, following recorded parent-child links;
- spouses/co-parents needed to make those family units understandable;
- no recursive expansion into the unrelated ancestry, siblings, or collateral branches of those spouses.

A person must therefore have a traceable inclusion path back to an included direct ancestor or to a direct sibling of one of those ancestors. Spouses can be terminal display additions, but they do not become new branch roots.

## Rendering model

The renderer should treat a GEDCOM family as a first-class layout unit.

A family junction represents one `FAM` record. Partners connect to that junction. Children connect from that same junction. This avoids long generation-wide rails that can visually imply false parentage when unrelated people happen to be nearby.

Layout rules may move family units for readability, but they may never change or invent graph edges.

## Release gate

A genealogy-data release must fail validation if any of these occur:

- a displayed parent-child edge has no originating GEDCOM `FAM` record;
- a displayed spouse edge has no originating GEDCOM `FAM` record;
- the same GEDCOM xref resolves to more than one person;
- a child is visually attached to a family other than the family represented by its edge;
- a person outside the documented display-scope rule is included except as a terminal spouse/co-parent;
- adoption/pedigree metadata present in the GEDCOM is lost.

No layout or styling change can waive these checks.
