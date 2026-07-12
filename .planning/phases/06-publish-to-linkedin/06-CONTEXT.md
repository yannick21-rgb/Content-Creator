# Phase 6: Publish to LinkedIn — Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Extends the per-platform `Publisher` adapter from Phases 4–5 to LinkedIn. Team can publish a post (text + single image) to a connected LinkedIn account via the LinkedIn adapter, with first-class re-auth for the 60-day token expiry. Publishing reuses the existing BullMQ worker pipeline, the same per-target status tracking, and the existing LinkedIn OAuth flow (fully implemented in Phase 1).

This phase does NOT cover Instagram (Phase 5), Meta/Facebook (Phase 4), LinkedIn organic carousels (explicitly unsupported — documented in composer), LinkedIn Articles API, or LinkedIn video publishing.

Key integration points:
- `src/lib/publish/linkedin.ts` — NEW: `LinkedInPublisher` implementing `Publisher`
- `src/lib/publish/index.ts` — factory: return `LinkedInPublisher` for `"linkedin"`
- `src/app/api/posts/[id]/publish/route.ts` — update platform allowlist to include `"linkedin"`
- `src/lib/connection-status.ts` — already flags 60-day expiry; no changes needed
- `worker.ts` — unchanged (already generic)
- `src/components/compose/PublishModal.tsx` — include LinkedIn accounts alongside Facebook/Instagram

</domain>

<decisions>
## Implementation Decisions

### Média upload LinkedIn
- **D-01:** Upload média vers LinkedIn dans `publish()`, pas `prepare()`. Cohérent avec le pattern Meta/IG (Phase 4 D-01). `prepare()` se concentre sur la validation seulement.
- **D-02:** Pré-validation dans `prepare()` : vérifier format (JPEG, PNG, GIF), taille max (5MB images). Rejeter avant appel API LinkedIn.
- **D-03:** Si l'upload média échoue chez LinkedIn, publier le texte uniquement avec statut `"published (media failed)"`. Même pattern que Meta (Phase 4 D-04).
- **D-04:** Types média supportés : photo unique via `registerUpload` ou `/rest/images`. Pas de vidéo dans cette phase. Pas de carrousel (confirmé hors scope par roadmap).

### Types de publication LinkedIn
- **D-05:** Scope : texte seul + texte avec image unique. Pas de vidéo, pas d'article, pas de carrousel.
- **D-06:** Aperçus de liens (URL dans le texte) : support passif inclus — LinkedIn expand automatiquement l'URL. Aucune logique spéciale côté adaptateur.
- **D-07:** Carrousels LinkedIn organiques : explicitement non supportés. Le composeur doit afficher un message clair si l'utilisateur tente d'ajouter un carrousel pour LinkedIn.

### Expiration token & reconnexion (60 jours)
- **D-08:** L'état « Reconnect Required » est affiché dans le PublishModal (sélecteur de comptes, badge rouge) ET dans la page Connexions du client. Double visibilité.
- **D-09:** L'avertissement commence 7 jours avant l'expiration (via `connection-status.ts` qui existe déjà).
- **D-10:** Reconnecter = rediriger vers la page de connexions du client avec le flow OAuth LinkedIn pré-rempli. Même processus qu'à la connexion initiale.
- **D-11:** Quand le token LinkedIn est expiré, le compte est grisé/désactivé sélectivement dans le sélecteur. Les autres comptes (Facebook, Instagram) fonctionnent normalement.

### Gestion d'erreurs
- **D-12:** Les messages d'erreur LinkedIn (bruts, avec `serviceErrorCode`) sont stockés dans `publish_targets.errorMessage` et affichés dans PublishStatusView. Pas de mapping utilisateur.
- **D-13:** Limites de débit LinkedIn (rate limits) : pas de gestion spéciale dans cette phase. Les 429 sont gérés par le backoff BullMQ existant. Documenté pour Phase 7 hardening.
- **D-14:** Stratégie de retry : 3 tentatives avec backoff exponentiel (30s, 2min, 10min). Même pattern que Meta/IG.

### Agent's discretion
- L'implémentation exacte de `registerUpload` vs `/rest/images` pour l'upload image LinkedIn (l'agent choisit la meilleure approche selon la doc LinkedIn 2026).
- Le format exact des messages d'erreur LinkedIn à stocker.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & requirements
- `.planning/ROADMAP.md` §Phase 6 — goal, success criteria (4 items), dependency (Phase 4), requirement mapping (extends PUBL-01/02/03).
- `.planning/REQUIREMENTS.md` — v1 requirements PUBL-01/02/03, Out-of-Scope table (LinkedIn carousels).

### Stack & architecture
- `AGENTS.md` → `PROJECT.md` — core value, constraints (token lifecycle, real API integration risk).
- `AGENTS.md` → `STACK.md` — LinkedIn API, BullMQ, crypto, R2.

### Prior phase context (MUST read before implementing LinkedIn adapter)
- `.planning/phases/04-publish-to-meta-facebook/04-CONTEXT.md` — MetaPublisher pattern to mirror (D-01..D-14), canonical refs to Publisher interface, publish route pattern.
- `.planning/phases/05-publish-to-instagram/05-CONTEXT.md` — InstagramPublisher pattern (D-01..D-12), per-platform validation.
- `.planning/phases/03-scheduler-worker/03-CONTEXT.md` — Publisher interface (D-03), per-target status (D-07), worker deployment (D-04).

### Existing code (MUST read before implementation)
- `src/lib/publish/provider.ts` — `Publisher` interface + types (`PublishPlatform`, `PublishContext`, `PrepareResult`, `PublishResult`, `VerifyResult`).
- `src/lib/publish/index.ts` — Publisher factory (`getPublisher()`). Must be extended to return `LinkedInPublisher` for `"linkedin"`.
- `src/lib/publish/meta.ts` — `MetaPublisher` implementation (pattern to mirror).
- `src/lib/publish/instagram.ts` — `InstagramPublisher` implementation (secondary pattern).
- `src/lib/publish/fake.ts` — `FakePublisher` for reference.
- `src/lib/oauth/linkedin.ts` — `LinkedInOAuthProvider` (fully implemented — PKCE, w_member_social, token exchange, identity fetch).
- `src/lib/oauth/complete.ts` — OAuth completion with encrypted token storage (already handles LinkedIn).
- `src/lib/crypto.ts` — AES-256-GCM encrypt/decrypt for tokens at publish time.
- `src/lib/connection-status.ts` — expiry detection and reconnect-required flagging.
- `src/lib/db/schema.ts` — `posts`, `publish_targets`, `social_account` (platform enum already includes `'linkedin'`), `media` tables.
- `src/lib/queue/index.ts` — BullMQ queue + `enqueuePublishJob()`.
- `worker.ts` — BullMQ worker with decrypt → publish → status update flow (generic).
- `src/app/api/posts/[id]/publish/route.ts` — publish API route (must add `"linkedin"` to platform allowlist).
- `src/app/api/posts/[id]/schedule/route.ts` — schedule endpoint pattern.
- `src/components/compose/PublishModal.tsx` — account selector (must include LinkedIn accounts).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/publish/provider.ts` — `Publisher` interface ready to implement. `PublishPlatform` already includes `"linkedin"`.
- `src/lib/publish/meta.ts` — `MetaPublisher` as reference implementation for LinkedInPublisher.
- `src/lib/publish/fake.ts` — `FakePublisher` fallback (currently handles `"linkedin"` when mode is `"fake"`).
- `src/lib/publish/index.ts` — Factory must add `LinkedInPublisher` before the FakePublisher fallback.
- `src/lib/oauth/linkedin.ts` — Full LinkedIn OAuth provider (PKCE, scope, token exchange, identity fetch). Already tested.
- `src/lib/oauth/complete.ts` — OAuth completion already stores LinkedIn tokens with encrypted columns.
- `src/lib/connection-status.ts` — Already flags 60-day expiry within configurable window.
- `src/lib/crypto.ts` — Token decryption for publish-time use.
- `worker.ts` — Generic worker, no changes needed for LinkedIn integration.
- `src/lib/queue/index.ts` — Queue already created; can enqueue delay=0 for immediate publish.
- `src/lib/posts.ts` — `getPostWithTargets()` returns post + targets + media + social accounts.

### Established Patterns
- `Publisher` interface with `prepare() + publish() + verify()` — mirror MetaPublisher/InstagramPublisher.
- Factory pattern in `src/lib/publish/index.ts` — extend with new platform.
- OAuthProvider interface → concrete implementation → factory (Phase 1 LinkedIn already done).
- Route handler pattern: `POST(req, {params})` with `requireUser()` + `getActiveClientId()` + try/catch.
- Per-target status state machine: `scheduled → running → published/failed`.
- BullMQ jobId = `publish_target.id` for idempotency.
- Vitest with `createAuthedUser` / `cleanupTestData`.
- Meta fallback: if media upload fails, publish text-only with `"published (media failed)"`.

### Integration Points
- `src/lib/publish/linkedin.ts` — NEW file: `LinkedInPublisher` implementing `Publisher`.
- `src/lib/publish/index.ts` — Update factory to return `LinkedInPublisher` when platform is `"linkedin"` and `PUBLISHER_MODE !== "fake"`.
- `src/app/api/posts/[id]/publish/route.ts` — Update platform allowlist from `["meta", "instagram"]` to `["meta", "instagram", "linkedin"]`.
- `src/components/compose/PublishModal.tsx` — Include LinkedIn accounts alongside Facebook/Instagram.
- `src/components/compose/PublishStatusView.tsx` — LinkedIn-specific error display.
- `src/lib/publish/linkedin.test.ts` — NEW file: unit tests for LinkedInPublisher.
</code_context>

<specifics>
## Specific Ideas

- Utiliser `POST /rest/images?action=initializeUpload` pour l'upload image LinkedIn (registerUpload API). Obtenir un `urn:li:image:<id>` à référencer dans le post.
- LinkedIn API utilise `Authorization: Bearer <token>` (pas query param `access_token=`) et l'en-tête `LinkedIn-Version: 202606`.
- Les posts LinkedIn utilisent le format `com.linkedin.ugc.ShareContent` avec `shareMediaCategory: IMAGE` pour les images.
- L'ID du média est stocké comme `platformRef` sur `publish_targets` pour le suivi.
</specifics>

<deferred>
## Deferred Ideas

- Publication vidéo LinkedIn — nécessite `registerUpload` avec `Asset type VIDEO` et flow upload plus complexe. Phase future.
- LinkedIn Articles API (`/rest/articles`) — API différente, pas dans le scope Share API.
- Rate-limiting avancé (throttle côté adaptateur) — Phase 7 hardening.
- Mapping d'erreurs LinkedIn en messages utilisateur — stocker le brut pour maintenant.
- LinkedIn carrousels organiques — non supportés par l'API (sponsored only), documentés hors scope.
</deferred>

---

*Phase: 06-publish-to-linkedin*
*Context gathered: 2026-07-12*
