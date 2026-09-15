# Lazy Acres Ancestry Genealogy Data Model

This document defines the canonical domain model planned for the normalized genealogy database. It intentionally supports more than the fields present in the current Ancestry GEDCOM so future research does not require a structural rewrite.

The original GEDCOM remains an immutable archival source. Supabase will become the editable working genealogy after the proof tree is approved and the import is validated. A corrected GEDCOM can later be exported from the normalized data without deleting unsupported or unchanged source material.

## Naming and shared Supabase project

Every database object owned by this application must use the `lazy_acres_ancestry_` prefix, including tables, views, functions, triggers, policies, storage buckets, and generated helper objects.

Examples below use that exact namespace.

## Core principles

- Preserve original GEDCOM xrefs as stable external identifiers. Never renumber or recycle them.
- Preserve imported values separately from later corrections when provenance matters.
- Never infer a genealogical relationship from surname, location, dates, layout position, or visual proximity.
- Every parent/child or partner relationship must have a recorded family/relationship source or be explicitly marked as a user-entered hypothesis.
- Distinguish verified facts, imported claims, user-entered facts, hypotheses, estimates, and unknown values.
- Preserve unrecognized GEDCOM tags and source fragments rather than silently discarding them.
- Do not use color as the only carrier of genealogical meaning.

## Planned normalized objects

### `lazy_acres_ancestry_people`

One row per person.

Important fields include:

- `id` UUID primary key
- `gedcom_id` stable GEDCOM xref, nullable only for people created after import
- `preferred_name`
- `given_names`
- `surname`
- `surname_prefix`
- `birth_surname`
- `married_name`
- `nickname`
- `alias`
- `title_prefix`
- `title_suffix`
- `sex`
- `gender_identity` nullable, separate from genealogical sex when needed
- `pronouns` nullable
- `living_status`
- `privacy_level`
- `primary_photo_id`
- `research_status`
- `confidence_level`
- `summary_note`
- `created_at`, `updated_at`

Names beyond the preferred display name belong in the name table below so any number of historical spellings or aliases can be preserved.

### `lazy_acres_ancestry_person_names`

Supports multiple names per person without squeezing them into one field.

Fields:

- `id`
- `person_id`
- `name_type` such as birth, married, maiden, nickname, alias, religious, immigration, alternate spelling, transliteration
- `prefix`
- `given`
- `middle`
- `surname_prefix`
- `surname`
- `suffix`
- `full_text`
- `language`
- `script`
- `date_from`, `date_to`
- `preferred`
- provenance/source fields

### `lazy_acres_ancestry_families`

Represents a GEDCOM-style family or partnership as a first-class object rather than reconstructing families from pairwise lines.

Fields:

- `id`
- `gedcom_id`
- `family_type` such as marriage, partnership, common-law, unknown
- `partner1_person_id`
- `partner2_person_id`
- `relationship_status`
- `start_date_text`, `end_date_text`
- `start_place_id`, `end_place_id`
- `note`
- provenance fields

The data model must also permit a family with one recorded parent or an unknown/unrecorded partner.

### `lazy_acres_ancestry_family_children`

Links a child to a specific family and preserves the nature of that relationship.

Fields:

- `family_id`
- `child_person_id`
- `pedigree_type` such as biological/birth, adopted, foster, step, guardian, sealed, unknown
- `relationship_to_partner1`
- `relationship_to_partner2`
- `adoption_date_text`
- `adoption_place_id`
- `order_in_family`
- `confidence_level`
- provenance/source fields

This is where adoption belongs. It must not be flattened into a generic parent edge.

### `lazy_acres_ancestry_events`

Events are extensible instead of creating one table column for every possible genealogical fact.

Fields:

- `id`
- `person_id` nullable
- `family_id` nullable
- `event_type`
- `date_text`
- `date_normalized_start`
- `date_normalized_end`
- `date_precision`
- `place_id`
- `address_text`
- `description`
- `value_text`
- `age_text`
- `cause`
- `agency`
- `role`
- `confidence_level`
- provenance/source fields

Supported event names should include, but not be limited to:

- birth
- death
- burial
- cremation
- baptism
- christening
- confirmation
- bar/bat mitzvah
- blessing
- census
- residence
- immigration
- emigration
- naturalization
- citizenship
- passenger arrival/departure
- occupation
- employment
- education
- graduation
- military service
- draft registration
- enlistment
- discharge
- pension
- religion
- ordination
- marriage
- engagement
- banns
- common-law union
- separation
- divorce
- annulment
- probate
- will
- estate
- property/land
- tax
- voter registration
- court/legal event
- medical event when deliberately recorded
- DNA test/sample event
- custom event

Unknown or application-specific GEDCOM event tags should be preserved as custom event types, not discarded.

### `lazy_acres_ancestry_places`

A place is a reusable object, not just free text.

Fields:

- `id`
- `original_text`
- `normalized_name`
- `place_type`
- `latitude`, `longitude`
- `coordinate_precision`
- `historical_jurisdiction`
- `current_jurisdiction`
- `parent_place_id`
- `country_code`
- `geocode_source`
- `geocode_confidence`
- `notes`

This supports historical places whose political jurisdiction changed over time and future geographic visualizations.

### `lazy_acres_ancestry_sources`

One bibliographic/source record.

Fields may include:

- `id`
- `gedcom_id`
- `title`
- `author`
- `publisher`
- `publication_text`
- `repository_id`
- `call_number`
- `url`
- `accessed_at`
- `source_type`
- `collection_name`
- `provider`
- `original_record_id`
- `rights_text`
- `notes`

### `lazy_acres_ancestry_citations`

Links evidence to a person, event, family, name, relationship, place claim, or media item.

Fields:

- `id`
- `source_id`
- target entity/type and target id
- `page_or_detail`
- `citation_text`
- `transcription`
- `abstract`
- `quality`
- `confidence_level`
- `accessed_at`
- `url`
- `external_record_id`
- `is_saved_record`

This is where Ancestry saved-record citations should land rather than disappearing into an opaque JSON blob.

### `lazy_acres_ancestry_repositories`

Libraries, archives, churches, courthouses, websites, cemeteries, family collections, etc.

Fields:

- `id`
- `gedcom_id`
- `name`
- `repository_type`
- address/contact fields
- `url`
- `notes`

### `lazy_acres_ancestry_notes`

Reusable notes with type and provenance.

Suggested note types:

- general
- biography
- research note
- proof argument
- conflict note
- transcription
- family story
- private note
- hypothesis
- correction rationale

### `lazy_acres_ancestry_media`

Already present in the project and should remain capable of holding photographs, scans, certificates, maps, audio, video, gravestone images, clippings, and document files.

Additional useful metadata includes:

- media type
- title/caption
- date/circa date
- place
- copyright/rights
- photographer/creator
- original source
- transcript/OCR text when available
- face/person links with confidence
- document-side/page number

### `lazy_acres_ancestry_external_ids`

Allows one person or record to retain identifiers from multiple genealogy systems without adding a new column for every provider.

Examples:

- Ancestry person/tree id
- FamilySearch PID
- WikiTree ID
- Find a Grave memorial id
- MyHeritage id
- Geneanet id
- Geni id
- archive/catalog ids

Fields:

- `entity_type`
- `entity_id`
- `provider`
- `external_id`
- `url`

### `lazy_acres_ancestry_dna_tests`

Optional future DNA research support.

Fields:

- `id`
- `person_id`
- `provider`
- `test_type` such as autosomal, Y-DNA, mtDNA, X-DNA
- `kit_identifier` with appropriate privacy controls
- `haplogroup`
- `tested_at`
- `notes`
- privacy fields

### `lazy_acres_ancestry_dna_matches`

Optional future match evidence.

Fields may include:

- `test_id`
- matched person/test reference
- `shared_cm`
- `segment_count`
- `longest_segment_cm`
- `predicted_relationship`
- `confirmed_relationship`
- `maternal_or_paternal_side`
- notes/evidence

Segment-level data, if ever used, should have its own ancestry-prefixed table rather than be packed into text.

### `lazy_acres_ancestry_research_tasks`

Research to-do items and unresolved questions.

Fields:

- `id`
- optional person/family/event/source target
- `question`
- `status`
- `priority`
- `assigned_to`
- `next_action`
- `due_date`
- `resolution_note`

### `lazy_acres_ancestry_assertions`

For hypotheses and conflicting claims that should not masquerade as settled facts.

Fields:

- target entity/type
- `assertion_type`
- `value`
- `status` such as proposed, supported, disproven, unresolved
- `confidence_level`
- rationale
- supporting/opposing citation links

### `lazy_acres_ancestry_change_history`

Audit trail for Edit operations.

Fields:

- entity type/id
- field or structured path changed
- old value
- new value
- change reason
- changed by
- changed at
- source/provenance context

This table makes edits reversible and distinguishes imported values from later corrections.

### `lazy_acres_ancestry_raw_import_records`

Preserves source material that has not yet been normalized or that the application does not understand.

Fields:

- import id
- GEDCOM xref or parent record reference
- raw tag/path
- raw value
- raw record text when needed
- parser status
- mapped entity id

The import process must preserve unknown GEDCOM tags here rather than delete them.

## Provenance fields

Important facts should be able to carry:

- `origin_type`: imported, user-entered, inferred, calculated
- `import_id`
- `source_system`
- `source_xref`
- `confidence_level`
- `verified_status`
- `verified_by`
- `verified_at`
- `correction_reason`

The UI may simplify this, but the database should not lose the distinction.

## Date handling

Do not reduce genealogical dates to a single SQL date. Preserve the original text and, when possible, derive normalized range fields.

Examples that must remain representable:

- exact date
- month/year only
- year only
- circa/about
- before
- after
- between two dates
- from/to range
- estimated/calculated
- unknown

## Relationship types beyond the current tree

The model should be able to represent genealogically relevant relationships not currently present in the proof tree, including:

- biological parent
- adoptive parent
- foster parent
- step-parent
- guardian
- spouse
- domestic/common-law partner
- divorced former spouse
- engaged partner
- unknown co-parent
- donor/surrogate relationship if a researcher deliberately records it

These relationship semantics must remain separate from the visual layout.

## Research and data-quality support

The application should eventually support:

- duplicate-person candidates without automatically merging them
- conflicting dates/places
- improbable chronology warnings
- parent-age warnings
- duplicate spouses/families
- impossible or suspicious lifespan warnings
- source-less assertions
- unresolved identity matches
- place normalization suggestions
- typo candidates
- research notes and correction rationale

Warnings are review aids. They must not silently rewrite genealogy.

## Import/export rule

The normalized database must be able to preserve information that the current UI does not yet display. Unsupported imported data must survive either in normalized fields or `lazy_acres_ancestry_raw_import_records` so a later GEDCOM export does not unintentionally delete it.

The original repository GEDCOM remains unchanged. Corrections occur in the normalized working genealogy and produce a separate corrected GEDCOM export after review.
