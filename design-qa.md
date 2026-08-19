# Design QA — Knowledge Governance Pages

Date: 2026-08-12

## Scope

- AI Persona: MagicPath component `438164841954443264`, revision `438164841954443265`
- Product Facts: MagicPath component `438166890075004928`, revision `438166890075004929`
- Support Knowledge: MagicPath component `438168577904893952`, revision `438168577904893953`
- Knowledge Workspace: MagicPath component `438161648897912832`, revision `438161648897912833`

## Implementation checks

- Existing `WorkspaceShell`, Clara tokens, API paths, role guards, and lifecycle actions were retained.
- AI Persona uses section navigation, focused editor, unsaved-state protection, and responsive version history.
- Product Facts uses searchable/filterable registry, responsive detail, governance rail, and revision drawer.
- Support Knowledge uses searchable/filterable library, readable article detail, trust metadata, governance rail, and revision drawer.
- Knowledge Workspace uses the approved master-detail reading surface, source menu, server-backed filters, responsive mobile detail, inline deactivation confirmation, editor drawer, and collapsible proposal governance queue.
- Customer-provided content is rendered as React text; no raw HTML rendering was introduced.
- Targeted ESLint: passed.
- Next.js production build and TypeScript: passed.
- `git diff --check`: passed.

## Visual comparison

Strict screenshot comparison is blocked because the isolated QA browser does not have a valid Clara governance account session. The local app correctly redirects protected routes to `/login`; no authentication or database state was changed or probed for QA. The MagicPath reference image was inspected at its native `1200 × 630` preview size.

final result: blocked (visual comparison only; implementation checks passed)
