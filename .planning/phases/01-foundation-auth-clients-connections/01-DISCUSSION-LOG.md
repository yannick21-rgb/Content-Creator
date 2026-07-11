# Phase 1: Foundation — Auth, Clients & Connections - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-11
**Phase:** 01-foundation-auth-clients-connections
**Areas discussed:** Contexte client actif

---

## Contexte client actif

| Option | Description | Selected |
|--------|-------------|----------|
| Menu déroulant (nav) | Sélection persistante dans la barre de nav ; pas de config DNS | ✓ |
| Routes par URL | Client dans le chemin (/clients/:id/...) | |
| Sous-domaine | Isolation maximale mais config DNS wildcard + certs | |
| Agent décide | Laisser l'agent choisir | |

**User's choice:** Menu déroulant dans la barre de navigation
**Notes:** Sélection persistante ; point d'entrée central de navigation.

| Option | Description | Selected |
|--------|-------------|----------|
| Cookie (serveur) | Cookie lisible côté serveur ; scoping appliqué server-side | ✓ |
| localStorage | Côté client uniquement | |
| Param URL | Partageable mais pollue les liens | |

**User's choice:** Cookie lisible côté serveur
**Notes:** Cohérent avec l'isolation par FK `client_id`.

| Option | Description | Selected |
|--------|-------------|----------|
| Onboarding création | Redirection vers création de client si aucun n'existe | ✓ |
| Dashboard + état vide | Afficher dashboard avec CTA | |
| Agent décide | Laisser l'agent choisir | |

**User's choice:** Onboarding création client
**Notes:** Pas d'écran vide après login.

| Option | Description | Selected |
|--------|-------------|----------|
| Connexions | Liste des connexions sociales du client | ✓ |
| Vue client | Profil client | |
| Dashboard client | Dashboard général | |

**User's choice:** Liste des connexions sociales
**Notes:** Cœur de la Phase 1 ; doit afficher l'état "Reconnect required".

| Option | Description | Selected |
|--------|-------------|----------|
| Nom seul | Minimal | |
| Nom + badges | Nom + badge statut (nb comptes / reconnect) | ✓ |
| Nom + avatar | Avatar couleur dérivé du nom | |

**User's choice:** Nom + badges de statut
**Notes:** Info en un coup d'œil.

| Option | Description | Selected |
|--------|-------------|----------|
| Param state OAuth | Client actif dans le state ; callback lie la connexion | ✓ |
| Cookie au callback | Réutiliser le cookie actif au retour | |
| Contexte implicite | Bouton déjà dans le contexte client | |

**User's choice:** Paramètre state OAuth
**Notes:** Sécurisé contre la confusion de cible lors du flux redirect.

| Option | Description | Selected |
|--------|-------------|----------|
| Bascule auto | Vers premier client restant ; sinon onboarding | ✓ |
| Retour à la liste | Rediriger vers la liste des clients | |
| Page erreur | Afficher erreur explicite | |

**User's choice:** Bascule auto
**Notes:** Jamais de page cassée.

| Option | Description | Selected |
|--------|-------------|----------|
| Recherche dans le menu | Filtre côté client | ✓ |
| Liste simple | Scrollable | |
| Agent décide | Laisser l'agent choisir | |

**User's choice:** Recherche dans le menu
**Notes:** Pour un grand nombre de clients.

## the agent's Discretion

- Détails de mise en page des cartes de connexion, rotation de la clé de chiffrement, et aspects purement techniques non couverts — laissés à l'agent (research/planning).

## Deferred Ideas

Aucune — discussion restée dans le périmètre de la phase.
