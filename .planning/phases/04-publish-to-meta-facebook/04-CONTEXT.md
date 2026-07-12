# Phase 4: Publish to Meta (Facebook) — Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase implements the first real per-platform `Publisher` adapter (Meta/Facebook) and the immediate-publish flow. The team can publish an existing draft post immediately to one or more connected Facebook accounts, completing the first end-to-end publish vertical. Publishing flows through the existing `Publisher` interface (prepare + publish + verify), worker, and per-target status tracking established in Phase 3.

This phase does NOT cover Instagram (Phase 5), LinkedIn (Phase 6), or scheduled publishing (Phase 3 already handles scheduling via BullMQ).

Key integration points with existing code:
- `src/lib/publish/provider.ts` — `Publisher` interface (Meta adapter implements it)
- `src/lib/publish/index.ts` — Publisher factory (must return MetaPublisher for "meta" platform)
- `src/lib/publish/fake.ts` — `FakePublisher` pattern to mirror for `MetaPublisher`
- `src/lib/oauth/meta.ts` — `MetaOAuthProvider` for token refresh/exchange
- `src/lib/crypto.ts` — decrypt tokens at publish time
- `src/lib/db/schema.ts` — `publish_targets`, `posts`, `social_account`, `media` tables
- `worker.ts` — BullMQ worker (handles the publish job flow; no changes needed)
- `src/lib/queue/index.ts` — `publishQueue` for delayed/immédiat jobs
- `src/app/api/posts/[id]/schedule/route.ts` — existing schedule endpoint pattern to mirror for publish endpoint

</domain>

<decisions>
## Implementation Decisions

### Upload média vers Meta
- **D-01:** L'upload des médias vers Meta se fait dans `publish()`, pas dans `prepare()`. Le `prepare()` se concentre sur la validation seulement.
- **D-02:** Les médias sont transférés via URL publique R2 (directe). Meta accepte les URLs pour les photos (`/{page-id}/photos?url=...`) et les vidéos (`file_url`). Pas de téléchargement serveur intermédiaire.
- **D-03:** Les vidéos utilisent aussi l'URL publique R2 directe. Pas de upload multipart serveur.
- **D-04:** Si l'upload média échoue chez Meta, publier le texte uniquement avec un statut "published (media failed)". Pas d'échec complet.

### Sélection des comptes cibles
- **D-05:** Sélecteur vide (choice) — l'utilisateur ajoute activement les comptes destinataires. Pas de pré-sélection.
- **D-06:** En Phase 4, le sélecteur montre uniquement les comptes Facebook (pas Instagram, pas LinkedIn).
- **D-07:** Sélecteurs séparés pour la publication immédiate et le scheduling (pas de composant partagé).
- **D-08:** Si le client n'a aucun compte Facebook connecté, le bouton "Publier maintenant" est grisé avec un tooltip/lien vers la page de connexions.

### UI de publication immédiate
- **D-09:** Le bouton "Publier maintenant" est placé à la fin du composeur (après la saisie du texte et l'ajout des médias), aux côtés du bouton "Planifier".
- **D-10:** Au clic, un modal s'ouvre avec le sélecteur de comptes Facebook et un bouton "Confirmer la publication".
- **D-11:** Après confirmation, un toast "Publication en cours..." puis redirection vers la vue détail du post (`/compose/post/[id]`) où le statut par target est visible (polling).

### Gestion app review Meta
- **D-12:** Double mécanisme : (1) bannière préventive au moment de la connexion OAuth Meta si l'app n'est pas approuvée, ET (2) détection d'erreur à la publication.
- **D-13:** La détection du statut app review se fait via l'API Meta `/{app-id}?fields=app_review_status` au moment de la connexion OAuth. Stocker le statut (pas d'appel API à chaque publication).
- **D-14:** En mode Développement, laisser Meta gérer la limitation des utilisateurs (testeurs uniquement). L'app affiche les erreurs Meta sans bloquer l'UI.

### the agent's Discretion
- **File d'attente pour publication immédiate :** l'agent choisit entre (a) BullMQ delay=0 pour réutiliser le worker, ou (b) appel direct à MetaPublisher.publish() dans la route API.
- **Rafraîchissement token Meta :** l'agent décide si MetaPublisher vérifie/rafraîchit le token avant publication ou se fie au token stocké.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & requirements
- `.planning/ROADMAP.md` §Phase 4 — goal, success criteria, dependency (Phase 3), requirement mapping (PUBL-01/02/03).
- `.planning/REQUIREMENTS.md` — v1 requirements PUBL-01/02/03 + Out-of-Scope table.

### Stack & architecture
- `AGENTS.md` → `PROJECT.md` — core value, constraints (real API integration risk, token lifecycle), Key Decisions.
- `AGENTS.md` → `STACK.md` — Meta Graph API, BullMQ, crypto, R2 for media storage.
- `.planning/phases/03-scheduler-worker/03-CONTEXT.md` — Publisher interface (D-03), worker deployment (D-04), per-target status (D-07).
- `.planning/phases/03-scheduler-worker/03-SPEC.md` — Publisher adapter pattern, worker setup, publish_targets table.

### Existing code (MUST read before implementation)
- `src/lib/publish/provider.ts` — `Publisher` interface + types (`PublishPlatform`, `PublishContext`, `PrepareResult`, `PublishResult`, `VerifyResult`).
- `src/lib/publish/index.ts` — Publisher factory (`getPublisher()`). Must be extended for Meta.
- `src/lib/publish/fake.ts` — `FakePublisher` implementation (pattern to follow).
- `src/lib/oauth/meta.ts` — `MetaOAuthProvider` with long-lived token exchange.
- `src/lib/oauth/provider.ts` — `OAuthToken`, `OAuthIdentity`, `OAuthProvider` interface.
- `src/lib/crypto.ts` — `decrypt()` for token decryption at publish time.
- `src/lib/db/schema.ts` — `posts`, `publish_targets`, `social_account`, `media` tables.
- `src/lib/queue/index.ts` — BullMQ queue + `enqueuePublishJob()`.
- `worker.ts` — BullMQ worker with decrypt → publish → status update flow.
- `src/app/api/posts/[id]/route.ts` — Post detail route pattern.
- `src/app/api/posts/[id]/schedule/route.ts` — Schedule endpoint pattern (model for publish endpoint).
- `src/app/compose/` — Compose UI pages.
- `src/lib/posts.ts` — Post CRUD including `getPostWithTargets()`.

### Meta API docs (for implementation reference)
- `src/lib/oauth/meta.ts` — existing Meta API calls (pages, token exchange).
- Meta Graph API references: `/me/accounts`, `/oauth/access_token`, `fb_exchange_token`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/publish/provider.ts` — `Publisher` interface ready to implement. Types already defined.
- `src/lib/publish/fake.ts` — `FakePublisher` as reference implementation.
- `src/lib/publish/index.ts` — Factory pattern (currently only returns FakePublisher).
- `worker.ts` — Complete worker with decrypt + publish + status update flow. No changes needed for MetaPublisher integration.
- `src/lib/queue/index.ts` — Queue already created. Can enqueue delay=0 for immediate publish.
- `src/lib/oauth/meta.ts` — Meta OAuth with long-lived token exchange.
- `src/lib/crypto.ts` — Token decryption for publish-time use.
- `src/lib/posts.ts` — `getPostWithTargets()` returns post + targets + media + social accounts.
- `src/app/api/posts/[id]/schedule/route.ts` — Pattern for publish endpoint (auth, scope, validation, response).
- `src/app/compose/` — Compose UI pages (target for publish button placement).

### Established Patterns
- OAuthProvider interface → concrete implementation → factory (Phase 1). Publisher interface mirrors this.
- Route handler pattern: `GET/POST(req, {params})` with `requireUser()` + `getActiveClientId()` + try/catch.
- Per-target status state machine: scheduled → running → published/failed.
- BullMQ jobId = `publish_target.id` for idempotency.
- Drizzle ORM with `postgres` driver, single `schema.ts`.
- Vitest with `createAuthedUser` / `cleanupTestData`.

### Integration Points
- `src/lib/publish/meta.ts` — NEW file: `MetaPublisher` implementing `Publisher` for Meta Graph API.
- `src/lib/publish/index.ts` — Update factory to return `MetaPublisher` when platform is "meta" and `PUBLISHER_MODE !== "fake"`.
- `src/app/api/posts/[id]/publish/route.ts` — NEW route: POST endpoint for immediate publish.
- `src/app/compose/` — Add "Publier maintenant" button after composition.
- `src/app/compose/post/[id]/` — Post detail view for status display after publish.
- `src/components/` — Possibly new `PublishModal` component with account selector.
- `src/lib/oauth/meta.ts` — Reuse `exchangeCode()`/`fetchIdentity()`; add `exchangeLongLivedToken()` for refresh if needed.

### Meta API endpoints to use
- `POST /{page-id}/photos` — upload photo to Facebook page.
- `POST /{page-id}/videos` — upload video to Facebook page.
- `POST /{page-id}/feed` — publish text post to Facebook page feed.
- `GET /{app-id}?fields=app_review_status` — check app review status.
- `GET /me/accounts?fields=id,name,access_token` — list pages + page tokens.
- `GET /oauth/access_token?grant_type=fb_exchange_token` — long-lived token refresh.

</code_context>

<specifics>
## Specific Ideas

- **Fallback media failed :** stocker `errorMessage` avec "published (media failed)" si le texte passe mais pas les médias.
- **Bannière app review :** vérifier le statut une fois à la connexion OAuth, stocker dans une table de config ou dans `social_account`, pas d'appel API Meta à chaque page load.
- **Toast + redirection :** utiliser un toast système (shadcn/ui Sonner ou toast) puis `router.push()` vers la vue détail.
- **Sélecteur de comptes :** composable réutilisable (même si D-07 dit sélecteurs séparés, le composant de base peut être partagé avec des wrappers différents).
- **Modal de confirmation :** afficher un récapitulatif du post (texte tronqué + nombre de médias) + liste des comptes sélectionnés + bouton "Confirmer".

</specifics>

<deferred>
## Deferred Ideas

- Publication Instagram (carrousels) — Phase 5
- Publication LinkedIn — Phase 6
- Rafraîchissement automatique des tokens Meta avant publication — laissé à la discrétion de l'agent pour cette phase
- File d'attente via BullMQ delay=0 vs direct call — laissé à la discrétion de l'agent

</deferred>

---

*Phase: 04-publish-to-meta-facebook*
*Context gathered: 2026-07-12*
