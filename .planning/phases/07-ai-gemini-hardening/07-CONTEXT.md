# Phase 07: AI (Gemini) & Hardening — Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers AI copy generation guided by a per-client brand-voice profile (AIGC-01, AIGC-02) directly in the composer, plus operational hardening of the publish pipeline (failed-publish recovery, rate-limit enforcement, and basic worker observability).

The AI feature integrates into the existing composer (`src/app/compose/new/page.tsx`) following the same provider/factory pattern used by publishers. The brand-voice profile lives in a new Drizzle table linked to `client`. The hardening layer builds on the existing BullMQ worker, Redis, and per-target status tracking established in Phases 3–6.

This phase does NOT cover: streaming AI output (token-by-token), fine-tuned models, LinkedIn carousels (already documented unsupported), or a full monitoring dashboard — deferring to standard BullMQ built-ins for observability.

</domain>

<decisions>
## Implementation Decisions

### AI trigger & interaction mode
- **D-01:** Un bouton « Générer avec IA » est placé à côté du textarea dans le composeur (pattern existant des boutons Publier/Planifier).
- **D-02:** Deux boutons distincts : « Générer » (textarea vide → création) et « Améliorer » (texte existant → reformulation). Pas de bouton unique adaptatif.
- **D-03:** Au clic, une modale s'ouvre avec des options (ton, longueur, plateforme cible) puis affiche le résultat avec « Insérer » ou « Régénérer ». Pas de remplacement inline, pas de panneau de suggestions.
- **D-04:** L'IA adapte automatiquement le texte aux limites par plateforme (IG: 2200, LI: 700, FB: 63206) selon la cible sélectionnée dans la modale.

### Brand-voice profile (schéma & UI)
- **D-05:** Deux champs : « Tonalité » (texte court : professionnel, décontracté, humoristique…) + « Consignes de style » (texte long : instructions libres). Pas de structure plus complexe.
- **D-06:** Le profil est paramétrable dans une nouvelle page dédiée `/clients/[id]/brand-voice`, accessible depuis la navigation client.
- **D-07:** Le profil alimente Gemini via le system prompt (tonalité + consignes de style). Pas de fine-tuning par client — overkill pour des consignes de ton.
- **D-08:** Le profil de marque est optionnel — si pas de profil, l'IA génère avec un ton neutre par défaut.

### Agent's discretion
- Implémentation exacte de la modale IA (layout, options précises : tonalité, longueur, plateforme).
- Choix de l'API Gemini (modèle, paramètres temperature/maxTokens).
- Gestion d'erreurs IA (timeout, API key manquante, contenu bloqué par safety filters).
- Implémentation exacte du provider AI (pattern `getAiProvider()` similaire à `getPublisher()`).
- **Hardening — Récupération d'échecs de publication :** ajouter un bouton « Retry » dans `PublishStatusView` pour les cibles en statut `failed`. Optionnellement, une vue dédiée des échecs. Pattern : ré-appeler `POST /api/posts/[id]/publish` (qui gère déjà les retry).
- **Hardening — Rate-limit enforcement :** sliding window Redis par plateforme (clé = `rate_limit:{platform}:{clientId}` avec INCR + EXPIRE). Vérification avant enqueue dans la route publish.
- **Hardening — Observabilité :** endpoint `GET /api/health` retournant `getJobCounts()` de BullMQ (waiting, active, delayed, failed). Optionnellement, Bull Board pour inspection UI. Pas de dashboard monitoring complet.
- **AI provider pattern :** suivre le pattern `getPublisher()` / `getProvider()` avec `AI_MODE=mock|gemini` comme feature flag.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & requirements
- `.planning/ROADMAP.md` §Phase 7 — goal, success criteria (4 items), dependency (Phase 2 + Phases 4–6).
- `.planning/REQUIREMENTS.md` — AIGC-01, AIGC-02.

### Prior phase context
- `.planning/phases/04-publish-to-meta-facebook/04-CONTEXT.md` — Publisher interface, PublishModal pattern.
- `.planning/phases/05-publish-to-instagram/05-CONTEXT.md` — Per-platform validation, composer integration.
- `.planning/phases/06-publish-to-linkedin/06-CONTEXT.md` — LinkedIn adapter pattern, re-auth state.

### Existing code (MUST read before implementation)
- `src/app/compose/new/page.tsx` — Composer page (primary AI integration surface).
- `src/components/compose/PublishModal.tsx` — Modal pattern with platform tabs (model for AI modal).
- `src/components/compose/PublishStatusView.tsx` — Status polling UI (retry button integration point).
- `src/lib/publish/provider.ts` — `Publisher` interface pattern (model for `AiProvider` interface).
- `src/lib/publish/index.ts` — Factory pattern (`getPublisher()` — model for `getAiProvider()`).
- `src/lib/redis.ts` — IORedis singleton (for rate-limit counters).
- `src/lib/db/schema.ts` — Existing schema (brand_voice table to be added).
- `src/lib/db.ts` — Drizzle client singleton.
- `src/lib/queue/index.ts` — BullMQ queue with `attempts: 3` + backoff.
- `worker.ts` — BullMQ worker with DLQ and event handlers.
- `src/lib/crypto.ts` — AES-256-GCM encrypt/decrypt (for any API key storage).

### Stack docs (from AGENTS.md)
- `AGENTS.md` → `STACK.md` — `@google/genai` usage, BullMQ, Redis, Drizzle patterns.
- `AGENTS.md` → `PROJECT.md` — Core value, constraints, key decisions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/publish/provider.ts` — `Publisher` interface pattern à reproduire pour `AiProvider`.
- `src/lib/publish/index.ts` — Factory pattern `getPublisher()` à reproduire pour `getAiProvider()`.
- `src/lib/http.ts` — `errorResponse()` helper pour les routes API.
- `src/lib/redis.ts` — IORedis singleton réutilisable pour rate-limiting (sliding window).
- `src/lib/db.ts` — Drizzle + postgres client singleton.
- `src/components/compose/PublishStatusView.tsx` — Polling status UI avec badges (ajouter bouton Retry).
- `src/components/compose/PublishModal.tsx` — Modal avec onglets plateforme (modèle pour modale IA).
- `package.json` — SWR disponible (`useSWRConfig` utilisé dans compose/new).

### Established Patterns
- Provider interface → concrete implementation → factory avec feature flag (ex: `PUBLISHER_MODE`). Même pattern pour `AI_MODE=mock|gemini`.
- Route handler pattern: `POST(req, {params})` avec `requireUser()` + `getActiveClientId()`.
- Env-var gates: `PUBLISHER_MODE`, `OAUTH_PROVIDER_MODE` → idem pour `AI_MODE`, `GEMINI_API_KEY`.
- Client-side data fetching: raw `fetch()` avec `useState`/`useEffect`. Pas de React Query. Polling via recursive `setTimeout`.
- Schema conventions: UUID PKs, timestamps, `clientId` FK avec cascade, Drizzle relations + `pgTable`.

### Integration Points
- `src/app/compose/new/page.tsx` — Ajouter boutons « Générer » et « Améliorer » à côté du textarea.
- `src/lib/ai/provider.ts` — NOUVEAU : `AiProvider` interface (generate, improve).
- `src/lib/ai/gemini.ts` — NOUVEAU : `GeminiProvider` implémentant `AiProvider`.
- `src/lib/ai/index.ts` — NOUVEAU : `getAiProvider()` factory (retourne `GeminiProvider` ou `MockAiProvider` selon `AI_MODE`).
- `src/app/api/ai/generate/route.ts` — NOUVEAU : route POST pour génération IA.
- `src/app/clients/[id]/brand-voice/page.tsx` — NOUVEAU : page de configuration du profil de marque.
- `src/lib/db/schema.ts` — NOUVELLE TABLE : `brand_voice` (clientId, tone, styleGuidelines, timestamps).
- `src/app/api/posts/[id]/publish/route.ts` — Ajouter vérification rate-limit avant enqueue.
- `src/components/compose/PublishStatusView.tsx` — Ajouter bouton « Retry » pour targets failed.
- `src/app/api/health/route.ts` — NOUVEAU : endpoint santé (`GET /api/health`).
- `package.json` — Ajouter `@google/genai` comme dépendance.

### Gemini API considerations
- Utiliser `@google/genai` (SDK GA, remplacer `@google/generative-ai` déprécié).
- Modèle recommandé : `gemini-2.5-flash` (bon équilibre coût/qualité pour génération de contenu).
- Appel via `client.models.generateContent()` avec system prompt + user prompt.
- Pas de streaming pour v1 (génération complète → modale → accept/reject).
- Gérer : timeouts, API key manquante (`GEMINI_API_KEY`), contenu bloqué par safety settings.

</code_context>

<specifics>
## Specific Ideas

- **Modale IA :** sélecteur de plateforme (FB/IG/LI) qui ajuste automatiquement la limite de caractères dans le prompt Gemini.
- **Profil de marque :** champ « Tonalité » en texte libre (pas un dropdown fixe) pour maximum de flexibilité.
- **Rate-limiting :** clé Redis = `rate_limit:{platform}:{accountId}:{hour}` avec TTL 3600s. INCR au moment de l'enqueue, check avant.
- **Récupération d'échecs :** le bouton « Retry » réutilise `POST /api/posts/[id]/publish` qui gère déjà les statuts (ne republie pas si déjà published).
- **Observabilité :** `GET /api/health` retourne un JSON avec `{ queueDepths: { waiting, active, delayed, failed }, redis: "connected", db: "connected" }`.

</specifics>

<deferred>
## Deferred Ideas

- Streaming IA token-by-token (SSE / ReadableStream) — v2 si l'UX le justifie.
- Fine-tuning par client — overkill pour v1, réévaluer si besoin de cohérence avancée.
- Dashboard monitoring complet — Bull Board ou Grafana si besoin plus tard.
- Récupération auto des échecs (cron BullMQ rejouant les failed targets) — laissé à l'agent discretion pour cette phase.

</deferred>

---

*Phase: 07-ai-gemini-hardening*
*Context gathered: 2026-07-12*
