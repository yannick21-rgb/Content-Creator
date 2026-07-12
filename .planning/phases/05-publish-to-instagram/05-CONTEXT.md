# Phase 5: Publish to Instagram (incl. Carousels) — Context

**Gathered:** 2026-07-12
**Status:** Ready for execution

<domain>
## Phase Boundary

This phase extends the per-platform `Publisher` adapter from Phase 4 to Instagram, including the IG Container API flow for single images, videos, and multi-image carousels (2–10 items). Publishing reuses the Meta token store (Instagram Business Accounts are already discovered via Meta OAuth), the same BullMQ worker pipeline, and the same per-target status tracking.

This phase does NOT cover Facebook publishing (Phase 4), LinkedIn (Phase 6), or the IG Stories/Reels API (out of scope).

Key integration points:
- `src/lib/publish/provider.ts` — add `"instagram"` to `PublishPlatform` type
- `src/lib/publish/instagram.ts` — NEW: `InstagramPublisher` implementing `Publisher`
- `src/lib/publish/index.ts` — factory: return `InstagramPublisher` for `"instagram"`
- `src/lib/oauth/complete.ts` — store IG Business Accounts as `platform: "instagram"` during Meta OAuth
- `src/lib/db/schema.ts` — update `social_account_platform_check` to include `'instagram'`
- `worker.ts` — unchanged (already generic)
- `src/components/compose/PublishModal.tsx` — include Instagram accounts alongside Facebook
</domain>

<decisions>
## Implementation Decisions

### IG Container API flow
- **D-01:** Two-step publish: (1) POST /{ig-id}/media créé un conteneur, (2) POST /{ig-id}/media_publish publie le conteneur. Les deux étapes dans `publish()`.
- **D-02:** Le `media_type` du conteneur dépend du contenu : IMAGE (photo unique), VIDEO (vidéo unique), CAROUSEL (2-10 images/vidéos).
- **D-03:** Pour les carrousels, créer d'abord les conteneurs enfants (un par média), puis le conteneur CAROUSEL avec `children=` listant les IDs des conteneurs enfants.
- **D-04:** IG impose un délai entre la création du conteneur et la publication : attendre 5-10 secondes entre create et publish (polling status du conteneur ou setTimeout).

### Stockage des comptes IG
- **D-05:** Les Instagram Business Accounts sont stockés comme `social_account` avec `platform: "instagram"` (pas "meta"). Créés pendant le OAuth Meta existant via `fetchIdentityWithPages()`.
- **D-06:** Le `platformAccountId` est l'IG Business Account ID (`{ig-user-id}`). Le `name` est le username Instagram.

### Validation IG
- **D-07:** Caption limitée à 2200 caractères (limite IG). Validée dans `prepare()` et dans le composeur.
- **D-08:** Images doivent être en format JPEG (IG accepte JPEG uniquement). Vérifié dans `prepare()`.
- **D-09:** Ratio d'image minimum : 4:5 (portrait) à 1.91:1 (landscape). Pas de validation d'aspect ratio dans cette phase — laisser IG rejeter si nécessaire.
- **D-10:** Carrousels : 2-10 éléments. Validé dans `prepare()`.

### UI
- **D-11:** Le PublishModal existant (Phase 4) inclut les comptes Instagram en plus des pages Facebook en Phase 5. Même modal, onglets ou section séparée.
- **D-12:** Le message d'erreur IG spécifique (rate-limit 25/24h, format image) est affiché dans PublishStatusView.

### Agent's discretion
- Le délai create→publish pour IG : setTimeout 5s dans `publish()` ou polling du statut du conteneur (`GET /{ig-id}/media/{media-id}?fields=status`).
</decisions>

<code_context>
## Existing Code to Leverage

### Instagram API Endpoints (Meta Graph API)
- `POST /{ig-user-id}/media` — create media container
- `POST /{ig-user-id}/media_publish` — publish container
- `GET /{ig-user-id}/media/{media-id}?fields=status` — check container status
- `GET /{ig-user-id}?fields=name,username,profile_picture_url` — IG user info

### Existing patterns (from Phase 4)
- `src/lib/publish/meta.ts` — MetaPublisher pattern to mirror
- `src/lib/publish/provider.ts` — Publisher interface (must be implemented)
- `src/lib/publish/index.ts` — factory (must be extended)
- `src/lib/db/schema.ts` — social_account platform check (must be updated)
- `src/lib/oauth/meta.ts` — fetchIdentityWithPages returns IG info
- `src/lib/oauth/complete.ts` — OAuth completion with per-page creation
- `src/components/compose/PublishModal.tsx` — must include IG accounts
- `src/app/api/posts/[id]/publish/route.ts` — validate IG accounts too
- `src/app/compose/new/page.tsx` — add IG caption warning
- `worker.ts` — unchanged (generic platform processing)
</code_context>

<deferred>
## Deferred Ideas

- Instagram Stories / Reels API — IG Container API only (feed posts)
- IG Stories insights/analytics
- Hashtag validation or suggestion
- First-comment publishing
- Automatic image format conversion (JPEG-only constraint)
</deferred>

---

*Phase: 05-publish-to-instagram*
*Context gathered: 2026-07-12*
