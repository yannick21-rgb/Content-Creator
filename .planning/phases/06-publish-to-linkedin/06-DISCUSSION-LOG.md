# Phase 6: Publish to LinkedIn — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-12
**Phase:** 6-publish-to-linkedin
**Areas discussed:** Stratégie d'upload média, Expiration token & reconnexion, Types de publication supportés, Gestion d'erreurs & limites de débit

---

## Stratégie d'upload média

**Q1: Où doit se faire l'upload média vers LinkedIn ?**
| Option | Description | Selected |
|--------|-------------|----------|
| Dans publish() (recommandé) | Upload LinkedIn dans publish(), cohérent avec Meta/IG (Phase 4 D-01) | ✓ |
| Dans prepare() | Upload dans prepare(), publish() ne fait que poster le texte avec URN | |
| Tu décides | Laisse ouvert à l'agent | |

**User's choice:** Dans publish()
**Notes:** Cohérent avec le pattern existant

**Q2: Validation format/taille dans prepare() ?**
| Option | Description | Selected |
|--------|-------------|----------|
| Valider dans prepare() (recommandé) | Vérifier format JPEG/PNG/GIF, taille max 5MB avant appel API | ✓ |
| Pas de validation | Laisser LinkedIn rejeter | |
| Tu décides | | |

**User's choice:** Valider dans prepare()

**Q3: Comportement si upload média échoue ?**
| Option | Description | Selected |
|--------|-------------|----------|
| Publier texte seul + flag (recommandé) | Même pattern que Meta D-04 : "published (media failed)" | ✓ |
| Échec complet + retry | Soit tout passe, soit rien | |
| Tu décides | | |

**User's choice:** Publier texte seul + flag media failed

**Q4: Types de médias supportés ?**
| Option | Description | Selected |
|--------|-------------|----------|
| Photo + vidéo (recommandé) | Photo via registerUpload, vidéo si format accepté. Pas de carrousel | ✓ |
| Photo uniquement | Vidéo reportée | |
| Tu décides | | |

**User's choice:** Photo uniquement (clarifié dans la discussion suivante — vidéo hors scope)

---

## Types de publication supportés

**Q1: Quels types de publication LinkedIn dans le scope ?**
| Option | Description | Selected |
|--------|-------------|----------|
| Texte + image unique (recommandé) | Strict minimum pour valider le pipeline | ✓ |
| Texte + image + vidéo | Inclut vidéo si médium existe | |
| Tout (texte/image/vidéo/article) | Tout ce que LinkedIn supporte | |

**User's choice:** Texte + image unique

**Q2: Aperçus de liens ?**
| Option | Description | Selected |
|--------|-------------|----------|
| Support passif inclus (recommandé) | LinkedIn expand automatiquement l'URL | ✓ |
| Hors scope pour l'instant | URLs sans garantie de preview | |
| Tu décides | | |

**User's choice:** Support passif inclus

**Q3: LinkedIn Articles dans le scope ?**
| Option | Description | Selected |
|--------|-------------|----------|
| Hors scope (recommandé) | API différente de Share API | ✓ |
| Dans le scope | Même endpoint, format différent | |
| Tu décides | | |

**User's choice:** Hors scope

**Q4: Vidéos dans le scope ?**
| Option | Description | Selected |
|--------|-------------|----------|
| Hors scope (recommandé) | Focus texte + image uniquement | ✓ |
| Dans le scope | Flow registerUpload pour VIDEO | |
| Tu décides | | |

**User's choice:** Hors scope

---

## Expiration token & reconnexion (60 jours)

**Q1: Où afficher l'état Reconnect Required ?**
| Option | Description | Selected |
|--------|-------------|----------|
| PublishModal + page Connexions (recommandé) | Badge rouge dans sélecteur + page dédiée | ✓ |
| Toast / bannière globale | Notification quand ouvre le composeur | |
| Page Connexions seulement | L'utilisateur doit y aller pour voir | |

**User's choice:** PublishModal + page Connexions

**Q2: Comportement au clic Reconnecter ?**
| Option | Description | Selected |
|--------|-------------|----------|
| OAuth simple (recommandé) | Rediriger vers page connexions avec flow pré-rempli | ✓ |
| Reconnexion inline | Lancement OAuth depuis le modal | |
| Tu décides | | |

**User's choice:** OAuth simple

**Q3: Comportement si token expiré ?**
| Option | Description | Selected |
|--------|-------------|----------|
| Compte désactivé sélectivement (recommandé) | LinkedIn grisé, autres comptes fonctionnent | ✓ |
| Blocage complet | Post entier ne peut pas être publié | |
| Tu décides | | |

**User's choice:** Compte désactivé sélectivement

**Q4: Jours avant expiration pour l'avertissement ?**
| Option | Description | Selected |
|--------|-------------|----------|
| 7 jours (recommandé) | Assez tôt pour agir sans bruit | ✓ |
| 14 jours | Plus de marge week-end/jours fériés | |
| 30 jours | Visible mais peut devenir du bruit | |

**User's choice:** 7 jours

---

## Gestion d'erreurs & limites de débit

**Q1: Comment remonter les erreurs LinkedIn ?**
| Option | Description | Selected |
|--------|-------------|----------|
| Message brut stocké + affiché (recommandé) | Stocker errorMessage + serviceErrorCode | ✓ |
| Mapper en messages utilisateur | Afficher version friendly | |
| Tu décides | | |

**User's choice:** Message brut stocké + affiché

**Q2: Gestion des rate limits ?**
| Option | Description | Selected |
|--------|-------------|----------|
| Backoff BullMQ seulement (recommandé) | 429 géré par backoff existant, documented pour Phase 7 | ✓ |
| Throttle basique dans l'adaptateur | Limiter 100 appels/jour par token | |
| Tu décides | | |

**User's choice:** Backoff BullMQ seulement + documenté

**Q3: Stratégie de retry ?**
| Option | Description | Selected |
|--------|-------------|----------|
| 3 retries, backoff exponentiel (recommandé) | 30s, 2min, 10min — même pattern Meta/IG | ✓ |
| 5 retries, backoff plus long | 1min, 5min, 15min, 30min, 1h | |
| Tu décides | | |

**User's choice:** 3 retries, backoff exponentiel

---

## the agent's Discretion

- Choix exact entre `registerUpload` vs `/rest/images` pour l'upload image LinkedIn.
- Format exact des messages d'erreur LinkedIn à stocker.

## Deferred Ideas

- Publication vidéo LinkedIn — nécessite registerUpload VIDEO
- LinkedIn Articles API — API différente, pas Share API
- Rate-limiting avancé (throttle) — Phase 7 hardening
- Mapping d'erreurs LinkedIn en messages utilisateur
- LinkedIn carrousels organiques — non supportés par l'API (sponsored only)
