# Clara Persona Bundle Migration Map

## Existing state

- `AIPersonaConfigVersion` remains the immutable per-section history.
- Existing draft creation remains available for Mini and Reguler.
- Reguler per-section publish and rollback remain unchanged.
- Without a Mini bundle, runtime keeps database-section then Markdown
  precedence.

## Stage 7 target

- `AIPersonaBundle` groups five exact section versions.
- `AIPersonaBundleSection` stores only references, hashes, counts, position,
  and import provenance.
- No migration row, startup hook, seed, or test publishes real prompt content.
- Import-current is an explicit superadmin action and creates only a draft.

## Compatibility boundary

When no complete Mini bundle is published, legacy per-section APIs retain their
behavior. Once a complete Mini bundle is published, individual Mini publish or
rollback is rejected so it cannot silently replace one active section. Draft
creation remains available so a version can be selected into a new bundle.

Historical per-section rows are never deleted or rewritten. Bundle rollback
creates new section versions and a new bundle version; it never mutates the
historical target.

## Database transition

Migration `fb1c2d3e4f50` creates empty bundle tables and adds safe suggestion
provenance metadata. Upgrade creates no bundle rows. Downgrade removes only
Stage 7 structures and leaves all existing prompt versions intact.
