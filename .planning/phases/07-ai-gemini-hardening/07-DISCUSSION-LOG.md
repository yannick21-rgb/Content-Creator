# Phase 07: AI (Gemini) & Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-12
**Phase:** 07-AI (Gemini) & Hardening
**Areas discussed:** AI trigger & interaction mode, Brand-voice profile schema & UI

---

## AI trigger & interaction mode

| Option | Description | Selected |
|--------|-------------|----------|
| Bouton à côté du textarea | Simple, visible, suit le pattern existant | ✓ |
| Panneau latéral dédié | Plus d'options mais plus d'encombrement | |
| Icône dans la barre d'outils | Discret mais moins visible | |

**User's choice:** Bouton à côté du textarea

---

| Option | Description | Selected |
|--------|-------------|----------|
| Modal avec options puis accept/reject | Contrôlé, comparaison possible | ✓ |
| Remplacement inline direct | Rapide mais pas de contrôle | |
| Panneau de suggestions | Plus de choix mais plus d'espace | |

**User's choice:** Modal avec options puis accept/reject

---

| Option | Description | Selected |
|--------|-------------|----------|
| Bouton unique adaptatif | S'adapte au contexte (vide vs plein) | |
| Deux boutons distincts | Plus clair, prompts différents | ✓ |
| Menu déroulant | Plus flexible mais plus complexe | |

**User's choice:** Deux boutons distincts (« Générer » et « Améliorer »)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Oui, automatique dans la modale | Texte adapté aux limites plateforme | ✓ |
| Non, utilisateur gère | Plus simple côté IA | |

**User's choice:** Oui, automatique dans la modale

---

## Brand-voice profile schema & UI

| Option | Description | Selected |
|--------|-------------|----------|
| Tonalité + description libre | Simple, flexible, suffisant pour le prompt | ✓ |
| Structure complète | Plus complet mais plus lourd | |
| Minimal : un seul champ | Flexible mais pas de guidance | |

**User's choice:** Tonalité + description libre (consignes de style)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Nouvelle page Brand Voice dans le client | Claire et dédiée | ✓ |
| Section dans la page Connexions | Pas de nouvelle page mais sans rapport | |
| Dans le composeur | Pratique mais caché | |

**User's choice:** Nouvelle page `/clients/[id]/brand-voice`

---

| Option | Description | Selected |
|--------|-------------|----------|
| Prompt système + exemple | Simple, efficace | ✓ |
| Fine-tuning par client | Plus puissant mais overkill | |

**User's choice:** Prompt système + exemple (pas de fine-tuning)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Optionnel | Ton neutre par défaut | ✓ |
| Obligatoire | Guide l'utilisateur mais bloque | |

**User's choice:** Optionnel

---

## Agent's Discretion

The following areas were not discussed in detail and are left to the agent's judgment:
- **AI provider implementation** — pattern `getAiProvider()` similaire à `getPublisher()`, avec `AI_MODE=mock|gemini`.
- **AI error handling** — timeouts, API key missing, safety filter blocks.
- **Modal IA exact layout** — quelles options exactes dans la modale (ton, longueur, plateforme).
- **Récupération d'échecs de publication** — bouton Retry dans PublishStatusView, vue dédiée optionnelle.
- **Rate-limit enforcement** — sliding window Redis par plateforme, check avant enqueue.
- **Observabilité** — endpoint `GET /api/health` avec `getJobCounts()`, Bull Board optionnel.

## Deferred Ideas

- Streaming IA token-by-token (SSE/ReadableStream) — v2
- Fine-tuning par client — overkill pour v1
- Dashboard monitoring complet — Bull Board ou Grafana si besoin
- Récupération auto des échecs via cron BullMQ — laissé à l'agent
