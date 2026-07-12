# Phase 3: Scheduler & Worker (reliability proof) — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-12
**Phase:** 03-scheduler-worker
**Areas discussed:** Schedule storage, post-to-target mapping, Publisher interface, Worker deployment, Schedule UI, Timezone handling, Per-target status state machine

---

## Schedule Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Table `schedules` séparée | Table dédiée avec FK vers posts + scheduled_at + recurrence + status | |
| Étendre la table `posts` | Ajouter scheduled_at, status directement dans posts | ✓ |

**User's choice:** Étendre la table `posts`
**Notes:** Ajouter les colonnes `scheduledAt`, `status`, `timezone` directement sur la table `posts`. Pas de table schedules séparée.

## Post-to-Target Mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Table `publish_targets` | Table junction post_id → social_account_id avec statut par cible | ✓ |
| Colonne JSON dans schedules | Stocke les cibles comme JSON array | |

**User's choice:** Table `publish_targets`
**Notes:** Junction table with per-target status (scheduled/running/published/failed). Post peut cibler plusieurs comptes.

## Publisher Interface

| Option | Description | Selected |
|--------|-------------|----------|
| Méthode unique publish() | `publish(post, target): Promise<PublishResult>` | |
| Multi-étapes | prepare + publish + verify — plus robuste | ✓ |

**User's choice:** Multi-étapes (prepare + publish + verify)
**Notes:** L'interface Publisher expose trois méthodes. FakePublisher les implémente en Phase 3. Seront remplacés par les adapters réels en P4-6.

## Worker Deployment

| Option | Description | Selected |
|--------|-------------|----------|
| Processus séparé worker.ts | Fichier racine importe lib/. `node worker.ts` | ✓ |
| Intégré dans Next.js | Worker dans route handler / edge runtime | |

**User's choice:** Processus séparé worker.ts
**Notes:** Partage `src/lib/` avec l'app Next.js. BullMQ Worker tourne comme processus indépendant.

## Schedule UI View

| Option | Description | Selected |
|--------|-------------|----------|
| Vue liste + calendrier | Page avec deux onglets : liste chronologique et vue calendrier (mois/semaine) | ✓ |
| Vue liste uniquement | Tableau simple avec filtres | |
| Vue calendrier uniquement | Calendrier mois/semaine avec pastilles | |

**User's choice:** Vue liste + calendrier
**Notes:** Page avec deux onglets : liste chronologique + calendrier interactif.

## Timezone Handling

| Option | Description | Selected |
|--------|-------------|----------|
| IANA picker + storage UTC | Stockage UTC en base, sélecteur de timezone IANA dans l'UI, conversion côté serveur | ✓ |
| UTC uniquement | Forcer UTC partout, pas de sélecteur | |
| Auto-détection navigateur | Basé sur le fuseau du navigateur | |

**User's choice:** IANA picker + storage UTC
**Notes:** `scheduledAt` stocké en UTC (timestamptz). L'utilisateur choisit son IANA timezone via un sélecteur. Conversion serveur.

## Per-Target Status State Machine

| Option | Description | Selected |
|--------|-------------|----------|
| scheduled → running → published/failed | Simple, clair | ✓ |
| Avec état draft | draft → scheduled → running → completed → failed | |
| Terminal states: published/failed | scheduled → running → published → failed | |

**User's choice:** scheduled → running → published/failed
**Notes:** running = tentative en cours. published/failed = états terminaux. On peut ajouter running aux colonnes dans `publish_targets`.
