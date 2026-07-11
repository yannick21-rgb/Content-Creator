# Phase 1: Foundation — Auth, Clients & Connections - Context

**Gathered:** 2026-07-11
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase builds the application foundation as greenfield: internal team authentication (email/password), isolated multi-client workspaces, and the OAuth connection + encrypted token-vault machinery for Meta (Facebook/Instagram) and LinkedIn. It establishes the patterns (auth session, client scoping, token encryption, OAuth connection state) that every later phase depends on. It does NOT publish, compose, schedule, or generate AI content.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**9 requirements are locked.** See `01-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `01-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Email/password auth (signup, login, session) via Better Auth — internal agency team only.
- Client workspace CRUD with hard row-level isolation (`client_id` FK, server-side scoping).
- Meta (Facebook/Instagram) OAuth connection flow with long-lived token exchange + identity verification.
- LinkedIn OAuth connection flow with token exchange + identity verification.
- AES-256-GCM encrypted token storage (ciphertext + IV + tag; master key from env).
- "Reconnect required" state with one-click re-auth when token expires within 7 days or expired.
- A dev mock OAuth provider so connection flows are provable without approved apps.

**Out of scope (from SPEC.md):**
- Publishing posts to platforms — Phases 4–6 (PUBL-01/02/03).
- Composer UI and media library/upload — Phase 2 (COMP-*, MEDA-*).
- Scheduling and the background worker — Phase 3 (SCHD-*).
- KMS envelope encryption (AWS/GCP KMS) — deferred; Phase 1 uses AES-256-GCM with a master key from env.
- AI copy generation / brand voice — Phase 7 (AIGC-*).
- LinkedIn organic carousels, additional networks, analytics, client approval portals, fine-grained team roles.
- Per-account publish-permission validation at connect time — connect verifies identity only.

</spec_lock>

<decisions>
## Implementation Decisions

### Contexte client actif (active client context)
- **D-01:** Le client actif est sélectionné via un **menu déroulant dans la barre de navigation** (sélection persistante), et non par routes URL ou sous-domaine.
- **D-02:** La sélection persiste dans un **cookie lisible côté serveur** — le scoping client est appliqué server-side à chaque requête, cohérent avec l'isolation par FK (`client_id`).
- **D-03:** **Onboarding création client** : après login, si l'utilisateur n'a aucun client, redirection vers un écran de création (pas d'écran vide).
- **D-04:** Une fois un client sélectionné, l'**écran par défaut est la liste des connexions sociales** du client (Meta/LinkedIn) — cœur de la Phase 1.
- **D-05:** Le menu déroulant affiche **nom + badges de statut** (nombre de comptes connectés, état "Reconnect required").
- **D-06:** Lors d'une connexion OAuth, le **client actif est inclus dans le paramètre `state` OAuth** ; au callback, la connexion est liée à ce client (sécurisé contre la confusion de cible).
- **D-07:** Si le client actif est supprimé → **bascule auto vers le premier client restant** ; si aucun ne reste, retour à l'onboarding. Jamais de page cassée.
- **D-08:** Le menu déroulant inclut une **recherche/filtre** (liste côté client) pour gérer un grand nombre de clients.

### the agent's Discretion
- Libre pour l'agent : détails de mise en page des cartes de connexion, mécanisme exact de rotation de la clé de chiffrement (env), et tout aspect purement technique non couvert ci-dessus (ceux-ci relèvent de la recherche/planification).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase spec & roadmap
- `.planning/phases/01-foundation-auth-clients-connections/01-SPEC.md` — **Locked requirements** (9) + boundaries + acceptance criteria. MUST read before planning.
- `.planning/ROADMAP.md` §Phase 1 — goal, success criteria, dependency (first phase), requirement mapping.
- `.planning/REQUIREMENTS.md` — v1 requirements AUTH-01/02, CLNT-01/02/03, CONN-01/02/03/04 + Out-of-Scope table.

### Stack & architecture (greenfield decisions)
- `AGENTS.md` → `STACK.md` — fixed stack: Next.js 15 (App Router) + React 19 + TypeScript + Node 24 LTS; PostgreSQL + Drizzle ORM (`postgres` driver); Better Auth (Drizzle adapter); AES-256-GCM via Node `crypto`; dev mock OAuth provider requirement.
- `AGENTS.md` → `PROJECT.md` — core value, constraints (real API integration risk, token lifecycle, scheduling reliability), Key Decisions (Vertical MVP, staged publishing Meta→IG→LinkedIn).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Aucun — projet greenfield (pas de `package.json`, pas de `src/`). Tout est à créer dans cette phase.

### Established Patterns
- Aucun pattern de code existant. Les patterns à établir (session Better Auth, scoping `client_id` server-side, chiffrement AES-256-GCM, état de connexion OAuth) deviennent les fondations réutilisées par les phases 2–7.

### Integration Points
- Route Handlers Next.js (`app/api/...`) pour auth, clients, connexions OAuth.
- Schéma Drizzle : tables `user`, `session` (Better Auth), `client`, `social_account` (avec `client_id` FK + colonnes token chiffrées).
- Worker/adapter de publication (Phase 4+) consommera les tokens déchiffrés ici — le déchiffrement ne doit avoir lieu qu'au moment de la publication.

</code_context>

<specifics>
## Specific Ideas

- Le menu déroulant de clients est le point d'entrée central de navigation (barre de nav), pas une page dédiée.
- L'écran "connexions" par client est la landing par défaut — il doit donc afficher clairement l'état "Reconnect required" avec un lien de ré-auth en un clic.
- Le mock OAuth dev doit partager la même interface/state machine que le vrai fournisseur (verrouillé dans SPEC).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation-auth-clients-connections*
*Context gathered: 2026-07-11*
