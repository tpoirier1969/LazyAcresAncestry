# Project Rules

This project is governed by the Universal Web Application Project Rules:
https://github.com/tpoirier1969/Web-App-Standards/blob/main/UNIVERSAL_PROJECT_RULES.md

## Non-negotiable universal rules

- `main` is the canonical application.
- Fix canonical source. Do not create patch, correction, override, hotfix, or runtime-repair layers as permanent fixes.
- Maintain exactly one authoritative application version source; all displays and release checks derive from it.
- Preserve existing user data and stable identifiers.
- Read the universal rules before modifying this project.

## Project-specific rules

- All Supabase objects created for this application must use the `lazy_acres_ancestry_` prefix because the personal Supabase project is shared with other applications.
- Preserve GEDCOM identifiers as stable external identifiers. Do not renumber or recycle them.
- The user has explicitly authorized retaining the complete original GEDCOM in this repository. It is **immutable, read-only primary evidence** and must never be edited, cleaned, rewritten, reformatted, overwritten, renamed, removed, truncated, or re-exported in place. Any new import or revised tree is a separate artifact, never a replacement for this archival original.
- Canonical source path at repository root: `Poirier - Hillman - Kauppila - Eilola - Bucco - Sortonen - Perreault - Stella families..ged`.
- Verified against the user's fresh upload on 2026-10-26: Git blob SHA-1 `83c6a5a37e42ed948c1a6abbfd7c41fa0ee9ce8c`, raw-file SHA-256 `9a5c80c3a94383755c7f2206df622deab315dc732a08c7976a3d29d64c0d038d`, size `9,274,758` bytes.
- Future chats and coding agents **must read from this file only**. Do not write to it even for apparent corrections; add observations and corrected interpretations to separate data structures or research notes. Verify its SHA-256 before analyses and after any repository work. A changed hash is a blocking integrity failure requiring explicit user permission to investigate, not permission to replace it.
- Treat this raw GEDCOM and derivative reports as privacy-sensitive because they contain living-person information; do not publish new copies or public-facing indexes without separate authorization.
- Genealogy facts, imported metadata, inferred image matches, user comments, and unresolved identity guesses must remain distinguishable in the data model.
- The primary tree renderer must remain scalable to the full GEDCOM. Do not render one DOM element per person for the complete tree.
- Person plaques have a fixed physical size on the sphere. Apparent size and orientation must derive from the projection model, not generation-specific CSS sizing.
- The visual language is historical/antique atlas and parchment. Avoid sci-fi styling unless explicitly requested.
