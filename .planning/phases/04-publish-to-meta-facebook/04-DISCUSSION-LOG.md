# Phase 4: Publish to Meta (Facebook) — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-12
**Phase:** 04-publish-to-meta-facebook
**Areas discussed:** Upload media vers Meta, Sélection des comptes cibles, UI publication immédiate, Dégradation app review

---

## Upload media vers Meta

| Option | Description | Selected |
|--------|-------------|----------|
| Dans prepare() | Sépare clairement 'préparer les assets' de 'publier' | |
| Dans publish() | Plus simple : tout se fait dans publish() | ✓ |
| Les deux étapes | prepare() pour images, publish() pour texte + refs | |

**User's choice:** Dans publish()
**Notes:** L'upload des médias vers Meta se fait dans publish(), pas dans prepare()

---

| Option | Description | Selected |
|--------|-------------|----------|
| URL publique directe | Meta accepte les URLs publiques pour les photos | ✓ |
| Téléchargement serveur puis upload | Plus de contrôle, compatible vidéo, mais coûteux | |

**User's choice:** URL publique directe
**Notes:** Utiliser l'URL publique R2 directe vers Meta (pas de téléchargement serveur)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Oui, URL publique aussi | Meta Video API accepte aussi file_url | ✓ |
| Non, upload binaire serveur | Les vidéos Meta nécessitent un upload multipart | |
| Pas de vidéo pour cette phase | Se concentrer sur text+image | |

**User's choice:** Oui, URL publique aussi
**Notes:** Les vidéos utilisent aussi l'URL publique R2 via file_url

---

| Option | Description | Selected |
|--------|-------------|----------|
| Échec = échec complet | Tout le publish_target passe en failed | |
| Fallback texte seul | Publier le texte uniquement si l'upload média échoue | ✓ |

**User's choice:** Fallback texte seul
**Notes:** Si l'upload média échoue, fallback texte seul avec statut "published (media failed)"

---

## Sélection des comptes cibles

| Option | Description | Selected |
|--------|-------------|----------|
| Tous les comptes Meta cochés par défaut | Pré-cochés, rapide pour multi-comptes | |
| Sélecteur vide (choice) | Pas de présélection, plus explicite | ✓ |
| Compte unique puis batch | UX plus guidée | |

**User's choice:** Sélecteur vide (choice)
**Notes:** Pas de pré-sélection, l'utilisateur choisit activement

---

| Option | Description | Selected |
|--------|-------------|----------|
| Facebook uniquement | Phase 4 seulement Facebook | ✓ |
| Tous les comptes Meta | Facebook ET Instagram | |

**User's choice:** Facebook uniquement
**Notes:** Le sélecteur montre uniquement les comptes Facebook en Phase 4

---

| Option | Description | Selected |
|--------|-------------|----------|
| Même sélecteur réutilisé | Composant partagé entre publier et planifier | |
| Sélecteurs séparés | Deux sélecteurs différents | ✓ |

**User's choice:** Sélecteurs séparés
**Notes:** Les sélecteurs pour publication immédiate et scheduling sont séparés

---

| Option | Description | Selected |
|--------|-------------|----------|
| Bouton grisé + message | Tooltip + lien vers connexions | ✓ |
| Cacher le bouton | Ne pas montrer l'option si aucun compte | |
| Redirection vers connexions | Rediriger l'utilisateur pour ajouter un compte | |

**User's choice:** Bouton grisé + message
**Notes:** Si le client n'a aucun compte Facebook, le bouton Publier est grisé

---

## UI publication immédiate

| Option | Description | Selected |
|--------|-------------|----------|
| Dans la vue détail du post | Sur la page /compose/post/[id] | |
| Dans le composeur (fin de composition) | Après avoir écrit le post, deux boutons | ✓ |
| Les deux | Composeur ET vue détail | |

**User's choice:** Dans le composeur (fin de composition)
**Notes:** Bouton "Publier maintenant" à la fin du composeur aux côtés de "Planifier"

---

| Option | Description | Selected |
|--------|-------------|----------|
| Modal avec sélecteur + confirmation | Modal s'ouvre avec sélecteur et confirmation | ✓ |
| Inline expand | Sélecteur qui se déplie dans le composeur | |

**User's choice:** Modal avec sélecteur + confirmation
**Notes:** Un modal s'ouvre au clic sur "Publier maintenant"

---

| Option | Description | Selected |
|--------|-------------|----------|
| Toast + redirection | Toast puis redirection vers la vue détail | ✓ |
| Modal de progression | Modal reste ouvert avec statut en temps réel | |
| Page de résultat dédiée | Redirection vers /publish/[id]/result | |

**User's choice:** Toast + redirection
**Notes:** Toast "Publication en cours..." puis redirection vers la vue détail avec polling

---

## Dégradation app review

| Option | Description | Selected |
|--------|-------------|----------|
| Détection + message explicite | À la publication, si erreur Meta, message clair | |
| Bannière préventive | Vérifier statut à la connexion Meta | |
| Les deux | Bannière préventive + détection erreur | ✓ |

**User's choice:** Les deux
**Notes:** Double mécanisme : bannière à la connexion + détection d'erreur à la publication

---

| Option | Description | Selected |
|--------|-------------|----------|
| App ID check via API | Appeler /{app-id}?fields=app_review_status | ✓ |
| Détection basée sur l'erreur | Détecter erreur au moment de la publication | |
| Variable d'env + fallback | META_APP_REVIEWED=true/false | |

**User's choice:** App ID check via API
**Notes:** Vérification du statut app review à la connexion OAuth via l'API Meta

---

| Option | Description | Selected |
|--------|-------------|----------|
| Accepter les erreurs Meta | Meta gère la limitation des testeurs | ✓ |
| Filtre UI + Meta | Bloquer le bouton Publier dans l'UI | |

**User's choice:** Accepter les erreurs Meta
**Notes:** En mode Développement, laisser Meta gérer et afficher les erreurs

---

## the agent's Discretion

- **File d'attente pour publication immédiate :** BullMQ delay=0 vs appel direct. Non discuté.
- **Rafraîchissement token Meta :** Vérifier/rafraîchir avant publication ou non. Non discuté.

## Deferred Ideas

- Publication Instagram (carrousels) — Phase 5
- Publication LinkedIn — Phase 6
