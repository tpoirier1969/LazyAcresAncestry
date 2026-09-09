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
- The public repository must not contain the complete raw GEDCOM unless explicitly authorized.
- Genealogy facts, imported metadata, inferred image matches, user comments, and unresolved identity guesses must remain distinguishable in the data model.
- The primary tree renderer must remain scalable to the full GEDCOM. Do not render one DOM element per person for the complete tree.
- Person plaques have a fixed physical size on the sphere. Apparent size and orientation must derive from the projection model, not generation-specific CSS sizing.
- The visual language is historical/antique atlas and parchment. Avoid sci-fi styling unless explicitly requested.
