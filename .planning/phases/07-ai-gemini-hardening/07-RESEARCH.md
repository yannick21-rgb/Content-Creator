# Phase 7 : AI (Gemini) & Hardening — Research

**Recherché :** 2026-07-12
**Domaine :** Génération de contenu IA (Gemini) + opérations (rate-limiting, observabilité, récupération d'échecs)
**Confiance :** HIGH

## Résumé Exécutif

Cette phase livre deux capacités distinctes : (1) la génération et l'amélioration de contenu via Gemini avec guidage par profil de marque client, et (2) le durcissement opérationnel du pipeline de publication (rate-limiting Redis, endpoint santé BullMQ, bouton Retry pour les échecs).

**L'IA suit le pattern Provider/Factoy existant** : `AiProvider` interface → `GeminiProvider` + `MockAiProvider` → `getAiProvider()` factory avec `AI_MODE=mock|gemini`. Le SDK `@google/genai` (GA, `npm install @google/genai`) est utilisé avec `gemini-2.5-flash` comme modèle recommandé. Le profil de marque est stocké dans une nouvelle table `brand_voice` liée à `client`, passé comme `systemInstruction` dans l'appel Gemini.

**Le durcissement exploite l'infrastructure existante** : le singleton Redis pour le sliding window rate-limiting (INCR + EXPIRE), `publishQueue.getJobCounts()` pour l'endpoint santé, et le bouton Retry dans `PublishStatusView` qui ré-appelle `POST /api/posts/[id]/publish`.

**Recommandation principale :** Implémenter l'IA en 3 tâches (provider/factory → route handler → modale UI) et le durcissement en 3 tâches (rate-limit → health endpoint → retry button), suivant l'ordre de dépendance. Le provider AI doit être implémenté en premier car la route handler en dépend, et la modale UI en dépend.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**AI trigger & interaction mode :**
- D-01 : Un bouton « Générer avec IA » est placé à côté du textarea dans le composeur.
- D-02 : Deux boutons distincts : « Générer » (textarea vide → création) et « Améliorer » (texte existant → reformulation).
- D-03 : Au clic, une modale s'ouvre avec des options (ton, longueur, plateforme cible) puis affiche le résultat avec « Insérer » ou « Régénérer ».
- D-04 : L'IA adapte automatiquement le texte aux limites par plateforme (IG: 2200, LI: 700, FB: 63206) selon la cible.

**Brand-voice profile :**
- D-05 : Deux champs : « Tonalité » (texte court) + « Consignes de style » (texte long).
- D-06 : Page dédiée `/clients/[id]/brand-voice`.
- D-07 : Le profil alimente Gemini via system prompt (tonalité + consignes). Pas de fine-tuning.
- D-08 : Le profil est optionnel — ton neutre par défaut.

**Hardening :**
- Retry button dans `PublishStatusView` pour les targets `failed` — ré-appelle `POST /api/posts/[id]/publish`.
- Rate-limit sliding window Redis : clé `rate_limit:{platform}:{clientId}:{hour}` avec INCR + EXPIRE.
- Endpoint `GET /api/health` retournant `getJobCounts()` de BullMQ.

**AI provider pattern :** Suivre le pattern `getPublisher()` avec `AI_MODE=mock|gemini`.

### Agent's Discretion
- Implémentation exacte de la modale IA (layout, options : tonalité, longueur, plateforme).
- Choix du modèle Gemini, temperature, maxTokens.
- Gestion d'erreurs IA (timeout, API key manquante, safety filters).
- Implémentation exacte du provider AI (interface `AiProvider`, classe `GeminiProvider`, `getAiProvider()`).
- Bouton Retry dans PublishStatusView, vue dédiée des échecs optionnelle.
- Sliding window Redis : clé exacte, seuils par plateforme.
- Endpoint santé : format exact du JSON, vérification redis/db optionnelle.
- Bull Board optionnel pour inspection UI.

### Deferred Ideas (OUT OF SCOPE)
- Streaming IA token-by-token (SSE/ReadableStream) — v2.
- Fine-tuning par client — overkill pour v1.
- Dashboard monitoring complet — Bull Board ou Grafana si besoin.
- Récupération auto des échecs via cron BullMQ.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AIGC-01 | Team can generate or improve post copy via Gemini | §Standard Stack — AiProvider + Gemini SDK ; §Code Examples — generateContent API ; §Architecture Patterns — Provider pattern |
| AIGC-02 | Per-client AI brand-voice profile guides generation | §Standard Stack — brand_voice table ; §Code Examples — systemPrompt construction ; §Architecture Patterns — Profile → SystemPrompt pipeline |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| AI copy generation (Gemini API call) | API / Backend | — | L'appel Gemini nécessite la clé API (server-side only) — jamais exposée au client. Route handler `POST /api/ai/generate`. |
| Brand-voice profile CRUD | API / Backend | Browser / Client | La page `/clients/[id]/brand-voice` est un formulaire client qui appelle des routes API. Le stockage est dans PostgreSQL via Drizzle. |
| Brand-voice → system prompt assembly | API / Backend | — | Construction du system prompt dans le handler de la route AI, pas dans le client. |
| Rate-limit enforcement | API / Backend | — | Vérification Redis avant enqueue dans le handler publish. Le worker n'a pas à vérifier (le check est fait à l'enqueue). |
| Observabilité (health endpoint) | API / Backend | — | `GET /api/health` est un endpoint Next.js Route Handler classique. |
| Retry button (failed publish) | Browser / Client | API / Backend | Le bouton est UI client ; il ré-appelle la route publish existante côté API. |
| Modale IA (options + result) | Browser / Client | — | Composant React `"use client"` suivant le pattern de `PublishModal`. Aucune logique backend ici. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@google/genai` | latest (≥1.38) | Google Gen AI SDK — appel API Gemini | SDK GA officiel, unifié pour AI Studio + Vertex AI. Remplace `@google/generative-ai` (déprécié, EOL 2025-08-31). |
| `gemini-2.5-flash` | — | Modèle pour génération de copy | Meilleur ratio qualité/coût pour la génération de texte. 1M tokens contexte, support system instructions, thinking intégré. |

**Modèle alternatif :** `gemini-2.5-pro` pour une qualité supérieure sur des tâches complexes (coût ~4×). Non recommandé pour v1 — `gemini-2.5-flash` est suffisant pour la génération de copy. Les modèles `gemini-3-flash-preview` et `gemini-3-pro-preview` existent mais sont en preview — ne pas utiliser en production jusqu'à GA. [CITED: github.com/googleapis/js-genai/blob/main/codegen_instructions.md — modèles recommandés]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `ioredis` | `^5` (déjà dans `package.json`) | INCR + EXPIRE pour rate-limiting | Déjà importé via `src/lib/redis.ts` — pas de nouvelle dépendance. |
| `@bull-board/api` + `@bull-board/express` | latest | Bull Board UI (optionnel, à la discrétion de l'agent) | Si souhaité pour inspection visuelle des queues en dev. Pas bloquant. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@google/genai` | Appel REST direct à l'API Gemini | Le SDK gère retry, types, auth. L'appel REST est plus verbeux et sans types. |
| `gemini-2.5-flash` | `gemini-2.5-pro` | Pro est 4× plus cher pour un gain marginal en qualité de copy. Flash est le bon choix. |
| Redis INCR + EXPIRE | BullMQ rate-limiter intégré | BullMQ rate-limiter est au niveau du worker (jobs/min). Ici on veut un rate-limiting par plateforme/compte au moment de l'enqueue — Redis direct est plus flexible. |
| INCR + EXPIRE | `ioredis` `multi()` avec script Lua atomique | Pour v1, INCR + EXPIRE suffit. Un script Lua serait plus atomique mais pas nécessaire ici. |

**Installation :**
```bash
npm install @google/genai
```

**Version verification :**
Le SDK `@google/genai` est en version 2.10.0 sur npm (publié juin 2026) [CITED: npmjs.com/package/@google/genai]. Il nécessite Node.js ≥20 (nous sommes sur Node 24 LTS). Le package a ~2072 dependents et est le SDK officiel maintenu par Google.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        COMPOSER PAGE                        │
│  [Textarea: texte du post]  [Générer] [Améliorer]          │
│                                                             │
│  ┌──────────────── AI Modal ──────────────────────┐         │
│  │ Options: Ton, Longueur, Plateforme cible       │         │
│  │ ┌─ Resultat IA ─────────────────────────────┐  │         │
│  │ │ Texte généré/amélioré avec respect des    │  │         │
│  │ │ limites plateforme                        │  │         │
│  │ └───────────────────────────────────────────┘  │         │
│  │              [Régénérer] [Insérer]             │         │
│  └────────────────────────────────────────────────┘         │
└──────────────────────┬──────────────────────────────────────┘
                       │ POST /api/ai/generate
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              ROUTE HANDLER (/api/ai/generate)                │
│                                                              │
│  1. requireUser() + getActiveClientId()                     │
│  2. Lire brand_voice si existe (clientId)                   │
│  3. getAiProvider() → GeminiProvider ou MockAiProvider      │
│  4. Appeler provider.generate() avec :                      │
│     - systemPrompt (tone + style si brand voice, sinon neutre│
│     - userPrompt (texte à améliorer ou instructions)        │
│     - platformLimits pour ajustement                        │
│  5. Retourner { text: generatedText }                       │
│                                                              │
│  ⚠ Gère : timeout, API key missing, safety filters         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│         PUBLISH ROUTE (modifiée : + rate-limit)             │
│                                                              │
│  1—5. (existant : auth, post lookup, validation)            │
│  6. ⭐ NOUVEAU : Vérifier rate-limit Redis                  │
│     INCR rate_limit:{platform}:{clientId}:{hourWindow}      │
│     Si > MAX_PER_PLATFORM → 429 Too Many Requests           │
│  7. enqueuePublishJob (inchangé)                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│         HEALTH ENDPOINT (NOUVEAU : GET /api/health)         │
│                                                              │
│  {                                                           │
│    status: "ok",                                             │
│    queue: { waiting: N, active: N, delayed: N, failed: N }, │
│    redis: "connected",                                       │
│    db: "connected"                                           │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│         PUBLISHSTATUSVIEW (modifiée : + Retry button)        │
│                                                              │
│  Pour chaque target avec status = "failed" :                 │
│  ┌──────────────────────────────────────────────┐            │
│  │ [Account Name]          Failed  [Retry]      │            │
│  │ error: message                                │            │
│  └──────────────────────────────────────────────┘            │
│                                                              │
│  [Retry] → POST /api/posts/[id]/publish                     │
│            (réutilise le même endpoint, qui gère déja les    │
│             mises à jour de statut)                          │
└─────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── lib/
│   ├── ai/                              # NOUVEAU dossier
│   │   ├── provider.ts                  # AiProvider interface
│   │   ├── gemini.ts                    # GeminiProvider (concrete)
│   │   ├── mock.ts                      # MockAiProvider (pour tests + mode mock)
│   │   ├── index.ts                     # getAiProvider() factory
│   │   └── types.ts                     # AiRequest / AiResponse types
│   ├── rate-limit.ts                    # NOUVEAU : sliding window Redis helper
│   └── db/
│       └── schema.ts                    # MODIFIÉ : + brand_voice table
├── app/
│   ├── api/
│   │   ├── ai/
│   │   │   └── generate/
│   │   │       └── route.ts             # NOUVEAU : POST /api/ai/generate
│   │   └── health/
│   │       └── route.ts                 # NOUVEAU : GET /api/health
│   └── clients/
│       └── [id]/
│           └── brand-voice/
│               └── page.tsx             # NOUVEAU : page profil de marque
├── components/
│   └── compose/
│       ├── AiModal.tsx                  # NOUVEAU : modale IA
│       └── PublishStatusView.tsx        # MODIFIÉ : + Retry button
```

### Pattern 1 : Provider Interface (copier le pattern Publisher)

**What :** Interface `AiProvider` définissant les méthodes `generate()` et `improve()`, implémentée par `GeminiProvider` (réel) et `MockAiProvider` (test/dev).

**When to use :** Systématique. Suit exactement le pattern `Publisher` des phases 4-6.

**Fichiers à créer :**
- `src/lib/ai/provider.ts` — interface
- `src/lib/ai/types.ts` — types partagés

**Exemple d'interface :**
```typescript
// src/lib/ai/provider.ts
// Source : [CITED: github.com/googleapis/js-genai/blob/main/codegen_instructions.md] + pattern Publisher existant

export type AiMode = "gemini" | "mock";

export interface AiRequest {
  /** Texte existant (pour amélioration) ou undefined (pour génération pure) */
  existingText?: string;
  /** Instructions pour la génération */
  instructions: string;
  /** Ton souhaité (ex: "professionnel", "décontracté") */
  tone?: string;
  /** Consignes de style additionnelles */
  styleGuidelines?: string;
  /** Plateforme cible (pour ajuster longueur max) */
  targetPlatform?: "facebook" | "instagram" | "linkedin";
  /** Longueur souhaitée */
  length?: "short" | "medium" | "long";
}

export interface AiResult {
  text: string;
  /** Indique si le contenu a été tronqué par les safety filters */
  blocked?: boolean;
  blockedReason?: string;
}

export interface AiProvider {
  readonly mode: AiMode;
  generate(request: AiRequest): Promise<AiResult>;
  improve(request: AiRequest): Promise<AiResult>;
}
```

### Pattern 2 : Factory avec Feature Flag

**What :** `getAiProvider()` qui retourne `GeminiProvider` ou `MockAiProvider` selon `AI_MODE`.

**When to use :** Reproduit exactement `getPublisher()` / `PUBLISHER_MODE`.

```typescript
// src/lib/ai/index.ts
// Source : pattern Publisher existant dans src/lib/publish/index.ts [VERIFIED: codebase]

import type { AiProvider, AiMode } from "./provider";
import { GeminiProvider } from "./gemini";
import { MockAiProvider } from "./mock";

let _instance: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (_instance) return _instance;

  const mode: AiMode = (process.env.AI_MODE as AiMode) ?? "mock";

  switch (mode) {
    case "gemini":
      _instance = new GeminiProvider();
      break;
    case "mock":
    default:
      _instance = new MockAiProvider();
      break;
  }

  return _instance;
}

/** Réinitialiser le singleton (utile pour les tests) */
export function resetAiProvider(): void {
  _instance = null;
}
```

### Pattern 3 : Route Handler POST

**What :** `POST /api/ai/generate` avec body JSON, validation Zod, appel du provider.

**When to use :** Route Next.js App Router classique, suivant le pattern des routes existantes.

```typescript
// src/app/api/ai/generate/route.ts
// Source : pattern des routes existantes + Context7 API Gemini

import { NextRequest, NextResponse } from "next/server";
import { requireUser, getActiveClientId } from "@/lib/clients";
import { db } from "@/lib/db";
import { brandVoice } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getAiProvider } from "@/lib/ai";
import type { AiRequest } from "@/lib/ai/provider";

const generateSchema = z.object({
  action: z.enum(["generate", "improve"]),
  existingText: z.string().optional(),
  instructions: z.string().optional().default(""),
  tone: z.string().optional(),
  styleGuidelines: z.string().optional(),
  targetPlatform: z.enum(["facebook", "instagram", "linkedin"]).optional(),
  length: z.enum(["short", "medium", "long"]).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser(req.headers);
    const activeClientId = await getActiveClientId(req.headers);
    if (!activeClientId) {
      return NextResponse.json({ error: "No active client" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    // Lire le profil de marque (si existant)
    const [profile] = await db
      .select()
      .from(brandVoice)
      .where(eq(brandVoice.clientId, activeClientId));

    const tone = parsed.data.tone ?? profile?.tone;
    const styleGuidelines = parsed.data.styleGuidelines ?? profile?.styleGuidelines;

    const aiRequest: AiRequest = {
      existingText: parsed.data.existingText,
      instructions: parsed.data.instructions,
      tone,
      styleGuidelines,
      targetPlatform: parsed.data.targetPlatform,
      length: parsed.data.length,
    };

    const provider = getAiProvider();
    const result = parsed.data.action === "improve"
      ? await provider.improve(aiRequest)
      : await provider.generate(aiRequest);

    if (result.blocked) {
      return NextResponse.json(
        { error: "Content blocked by safety filters", reason: result.blockedReason },
        { status: 422 },
      );
    }

    return NextResponse.json({ text: result.text });
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Erreur Gemini (timeout, API key, etc.)
    console.error("AI generate error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI generation failed" },
      { status: 500 },
    );
  }
}
```

### Pattern 4 : GeminiProvider (appel API concret)

**What :** Implémentation de `AiProvider` utilisant `@google/genai`.

**When to use :** Quand `AI_MODE=gemini`.

```typescript
// src/lib/ai/gemini.ts
// Source : [CITED: github.com/googleapis/js-genai/blob/main/codegen_instructions.md]
// API : ai.models.generateContent({ model, contents, config: { systemInstruction, ... } })

import { GoogleGenAI } from "@google/genai";
import type { AiProvider, AiRequest, AiResult, AiMode } from "./provider";

const PLATFORM_LIMITS: Record<string, number> = {
  facebook: 63206,
  instagram: 2200,
  linkedin: 700,
};

export class GeminiProvider implements AiProvider {
  readonly mode: AiMode = "gemini";
  private client: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set — can't create GeminiProvider");
    }
    this.client = new GoogleGenAI({ apiKey });
  }

  async generate(request: AiRequest): Promise<AiResult> {
    const systemPrompt = this.buildSystemPrompt(request);
    const userPrompt = this.buildGenerationPrompt(request);

    return this.callGemini(systemPrompt, userPrompt);
  }

  async improve(request: AiRequest): Promise<AiResult> {
    const systemPrompt = this.buildSystemPrompt(request);
    const userPrompt = this.buildImprovementPrompt(request);

    return this.callGemini(systemPrompt, userPrompt);
  }

  private buildSystemPrompt(request: AiRequest): string {
    const parts: string[] = [
      "Tu es un assistant de rédaction de contenu pour les réseaux sociaux.",
      "Génère du contenu en français uniquement.",
    ];

    if (request.tone) {
      parts.push(`\nTonalité à adopter : ${request.tone}.`);
    }

    if (request.styleGuidelines) {
      parts.push(`\nConsignes de style : ${request.styleGuidelines}.`);
    }

    // Limite de caractères selon la plateforme
    if (request.targetPlatform) {
      const limit = PLATFORM_LIMITS[request.targetPlatform];
      parts.push(
        `\nLe texte ne doit pas dépasser ${limit} caractères (limite ${request.targetPlatform}).`,
      );
    }

    return parts.join("\n");
  }

  private buildGenerationPrompt(request: AiRequest): string {
    const lengthGuide = request.length === "short" ? "Court (1-2 phrases)" :
      request.length === "long" ? "Long (paragraphe détaillé)" :
      "Longueur standard (3-5 phrases)";

    return [
      `Génère un contenu pour les réseaux sociaux.`,
      lengthGuide !== "Longueur standard (3-5 phrases)" && `Longueur : ${lengthGuide}.`,
      request.instructions ? `Consignes : ${request.instructions}` : "",
      "",
      "Contenu :",
    ].filter(Boolean).join("\n");
  }

  private buildImprovementPrompt(request: AiRequest): string {
    const lengthGuide = request.length === "short" ? "Court (1-2 phrases)" :
      request.length === "long" ? "Long (paragraphe détaillé)" :
      "Longueur standard (3-5 phrases)";

    return [
      `Améliore le texte suivant :`,
      ``,
      `--- TEXTE À AMÉLIORER ---`,
      request.existingText ?? "",
      `--- FIN DU TEXTE ---`,
      ``,
      lengthGuide !== "Longueur standard (3-5 phrases)" && `Longueur visée : ${lengthGuide}.`,
      request.instructions ? `Consignes d'amélioration : ${request.instructions}` : "",
      "",
      "Texte amélioré :",
    ].filter(Boolean).join("\n");
  }

  private async callGemini(systemInstruction: string, userPrompt: string): Promise<AiResult> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000); // 30s timeout

      const response = await this.client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: userPrompt,
        config: {
          systemInstruction,
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      });

      clearTimeout(timeout);

      // Vérifier si le contenu a été bloqué par les safety filters
      if (!response.candidates || response.candidates.length === 0) {
        const reason = response.promptFeedback?.blockReason;
        return {
          text: "",
          blocked: true,
          blockedReason: reason ?? "Blocked by safety filters",
        };
      }

      const text = response.text;
      if (!text) {
        return {
          text: "",
          blocked: true,
          blockedReason: "Empty response from Gemini",
        };
      }

      return { text };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("AI generation timed out after 30 seconds");
      }
      throw error;
    }
  }
}

export { PLATFORM_LIMITS };
```

### Pattern 5 : MockAiProvider (pour tests + développement)

```typescript
// src/lib/ai/mock.ts
// Source : pattern FakePublisher existant dans src/lib/publish/fake.ts [VERIFIED: codebase]

import type { AiProvider, AiRequest, AiResult, AiMode } from "./provider";

export class MockAiProvider implements AiProvider {
  readonly mode: AiMode = "mock";

  async generate(request: AiRequest): Promise<AiResult> {
    const tone = request.tone ? ` (ton : ${request.tone})` : "";
    const platform = request.targetPlatform ? ` [pour ${request.targetPlatform}]` : "";
    const style = request.styleGuidelines ? ` — ${request.styleGuidelines}` : "";
    return {
      text: `[Contenu généré par IA${tone}${platform}${style}]\n\n${
        request.instructions || "Contenu généré automatiquement."
      }`,
    };
  }

  async improve(request: AiRequest): Promise<AiResult> {
    const tone = request.tone ? ` (ton : ${request.tone})` : "";
    const platform = request.targetPlatform ? ` [pour ${request.targetPlatform}]` : "";
    return {
      text: `[Contenu amélioré par IA${tone}${platform}]\n\n${
        request.existingText || "Texte amélioré automatiquement."
      }`,
    };
  }
}
```

### Pattern 6 : Rate-limiting avec Redis (sliding window par heure)

**What :** Vérification du nombre de publications par plateforme/client/heure avant enqueue.

**When to use :** Dans `POST /api/posts/[id]/publish`, avant `enqueuePublishJob()`.

```typescript
// src/lib/rate-limit.ts
// Source : pattern Redis INCR + EXPIRE standard [VERIFIED: pratique établie Redis]

import { redis } from "@/lib/redis";

/** Seuils de rate-limiting par plateforme (publications par heure) */
const PLATFORM_RATE_LIMITS: Record<string, number> = {
  facebook: 50,    // Meta pages: ~50 posts/day est safe
  instagram: 25,   // Instagram: ~25 posts/day (limite API réelle ~60, mais mieux vaut être conservateur)
  linkedin: 100,   // LinkedIn: ~100 posts/day
};

/** Vérifier et incrémenter le compteur rate-limit.
 *  Retourne { allowed, remaining, limit }.
 *  Lève une erreur 429 si la limite est dépassée.
 */
export async function checkRateLimit(
  platform: string,
  clientId: string,
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const limit = PLATFORM_RATE_LIMITS[platform];
  if (!limit) {
    // Plateforme inconnue — on autorise par défaut
    return { allowed: true, remaining: Infinity, limit: Infinity };
  }

  // Fenêtre horaire : clé = rate_limit:{platform}:{clientId}:{YYYYMMDDHH}
  const hourKey = getHourKey();
  const redisKey = `rate_limit:${platform}:${clientId}:${hourKey}`;

  // Utiliser INCR + EXPIRE dans une transaction pour atomicité
  const multi = redis.multi();
  multi.incr(redisKey);
  multi.expire(redisKey, 3600);
  const results = await multi.exec();

  const count = results?.[0]?.[1] as number ?? 0;

  if (count > limit) {
    return { allowed: false, remaining: 0, limit };
  }

  return { allowed: true, remaining: limit - count, limit };
}

function getHourKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}${
    String(now.getUTCMonth() + 1).padStart(2, "0")
  }${
    String(now.getUTCDate()).padStart(2, "0")
  }${
    String(now.getUTCHours()).padStart(2, "0")
  }`;
}
```

**Intégration dans la route publish :**
```typescript
// Dans src/app/api/posts/[id]/publish/route.ts, avant enqueuePublishJob
// Après avoir récupéré le compte et la plateforme :

for (const accountId of socialAccountIds) {
  const account = accounts.find((a) => a.id === accountId);
  if (!account) continue;

  // ⭐ Rate-limit check
  const rateCheck = await checkRateLimit(account.platform, activeClientId);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded for ${account.platform}. Max ${rateCheck.limit}/hour.` },
      { status: 429 },
    );
  }

  const [target] = await db
    .insert(publishTargets)
    .values({ postId: id, socialAccountId: accountId, status: "scheduled" })
    .returning();
  targets.push(target.id);
  await enqueuePublishJob({ ... });
}
```

### Pattern 7 : Observabilité — GET /api/health

```typescript
// src/app/api/health/route.ts
// Source : BullMQ Queue.getJobCounts() API [CITED: docs.bullmq.io/guide/jobs/getters]

import { NextResponse } from "next/server";
import { publishQueue } from "@/lib/queue";
import { redis } from "@/lib/redis";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const [jobCounts, redisPing, dbPing] = await Promise.all([
      publishQueue.getJobCounts(),
      redis.ping().then(() => "connected" as const).catch(() => "disconnected" as const),
      db.execute("SELECT 1").then(() => "connected" as const).catch(() => "disconnected" as const),
    ]);

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      queue: {
        waiting: jobCounts.wait ?? 0,
        active: jobCounts.active ?? 0,
        delayed: jobCounts.delayed ?? 0,
        failed: jobCounts.failed ?? 0,
        completed: jobCounts.completed ?? 0,
      },
      redis: redisPing,
      db: dbPing,
    });
  } catch (e) {
    console.error("Health check failed:", e);
    return NextResponse.json(
      { status: "error", message: "Health check failed" },
      { status: 500 },
    );
  }
}
```

### Pattern 8 : brand_voice schema (table Drizzle)

```typescript
// À ajouter dans src/lib/db/schema.ts
// Source : conventions de schéma existantes [VERIFIED: codebase schema.ts]

export const brandVoice = pgTable(
  "brand_voice",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => client.id, { onDelete: "cascade" })
      .unique(), // Un seul profil par client
    tone: text("tone"), // "professionnel", "décontracté", "humoristique"...
    styleGuidelines: text("style_guidelines"), // Instructions libres
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
);

// Relations à ajouter dans la section relations :
export const brandVoiceRelations = relations(brandVoice, ({ one }) => ({
  client: one(client, {
    fields: [brandVoice.clientId],
    references: [client.id],
  }),
}));

// Également ajouter dans clientRelations :
// brandVoice: one(brandVoice),

// Type exports à ajouter :
export type BrandVoice = typeof brandVoice.$inferSelect;
export type NewBrandVoice = typeof brandVoice.$inferInsert;
```

### Pattern 9 : Retry Button dans PublishStatusView

```typescript
// Modification dans src/components/compose/PublishStatusView.tsx
// Ajouter un bouton Retry pour les targets failed

// Dans le rendu de chaque target, après l'affichage du statut :
{/* ... existing target display ... */}
{t.status === "failed" && (
  <button
    onClick={() => handleRetry(t.id)}
    disabled={retrying.has(t.id)}
    className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
  >
    {retrying.has(t.id) ? "Retrying..." : "Retry"}
  </button>
)}

// Et le handler :
const [retrying, setRetrying] = useState<Set<string>>(new Set());

const handleRetry = useCallback(async (targetId: string) => {
  setRetrying(prev => new Set(prev).add(targetId));
  try {
    await fetch(`/api/posts/${postId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ socialAccountIds: [targetId] }),
    });
    // Re-déclencher le polling après retry
    setData(null);
    setLoading(true);
  } catch {
    // L'erreur est gérée par l'état du target
  } finally {
    setRetrying(prev => {
      const next = new Set(prev);
      next.delete(targetId);
      return next;
    });
  }
}, [postId]);
```

### Anti-Patterns to Avoid

- **Appeler Gemini depuis le client :** La clé API serait exposée. Toujours passer par une route handler Next.js (server-side). [CITED: npmjs.com/package/@google/genai — "Avoid exposing API keys in client-side code"]
- **`@google/generative-ai` au lieu de `@google/genai` :** Le package est déprécié et EOL depuis 2025-08-31. Ne plus l'utiliser.
- **node-cron/setInterval pour le rate-limiting :** Le rate-limiting Redis par INCR + EXPIRE est persistant et multi-instance safe. Un setInterval local serait perdu au restart.
- **Bloquer tout le publish si un rate-limit est atteint :** Le rate-limit est par plateforme/client. Si Instagram est à 25/h, Facebook et LinkedIn doivent continuer de fonctionner.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Appel API Gemini | Client HTTP custom | `@google/genai` | Le SDK gère auth, retry, types, versions API. L'appel REST direct est plus risqué et sans types. |
| Rate-limiting distribué | Algorithme maison | Redis INCR + EXPIRE | Redis est déjà dispo (BullMQ), INCR + EXPIRE est atomique et éprouvé. Pas de nouvelle dépendance. |
| Construction system prompt | Template engine lourd | Template strings + tableau de parts | Le system prompt est une simple concaténation de chaînes. Pas besoin de mustache/handlebars. |

**Key insight :** Les trois sous-problèmes (appel Gemini, rate-limiting, construction de prompt) ont des solutions existantes simples dans la stack. Ne pas les complexifier.

## Common Pitfalls

### Pitfall 1 : `@google/generative-ai` (SDK déprécié)
**What goes wrong :** Installation accidentelle de `@google/generative-ai` (l'ancien SDK) au lieu de `@google/genai`.
**Why it happens :** Les deux packages existent sur npm. L'ancien a plus de documentation historique.
**How to avoid :** `npm install @google/genai` (pas `@google/generative-ai`). Vérifier que `package.json` contient `@google/genai` et pas l'autre.
**Warning signs :** Erreur `GoogleGenAI is not a constructor` ou API `getGenerativeModel` qui n'existe pas.

### Pitfall 2 : Timeout par défaut de 5 minutes de l'API Gemini
**What goes wrong :** Les requêtes Gemini peuvent prendre plus de temps que prévu, et le timeout par défaut de Node.js (~5min) est trop long pour une modale interactive.
**Why it happens :** Le SDK `@google/genai` n'a pas de timeout par défaut court — il utilise le timeout HTTP de Node.js.
**How to avoid :** Utiliser `AbortController` avec un timeout de 30s (exemple ci-dessus). Ne pas compter sur le timeout du SDK uniquement (bug connu — httpOptions.timeout parfois ignoré [#1277] [CITED: github.com/googleapis/js-genai/issues/1277]).
**Warning signs :** L'utilisateur attend >30s sans feedback. Toujours montrer un état "loading" dans la modale.

### Pitfall 3 : Safety filters bloquent le contenu sans erreur explicite
**What goes wrong :** Gemini peut bloquer un contenu (safety filter) sans lancer d'erreur — la réponse a simplement `response.candidates` vide.
**Why it happens :** Les filtres de sécurité de Gemini sont actifs par défaut. Un prompt "innoffensif" peut être bloqué selon le contexte.
**How to avoid :** Toujours vérifier `response.candidates.length === 0` et regarder `response.promptFeedback?.blockReason`. Retourner un message clair à l'utilisateur ("Le contenu a été bloqué par les filtres de sécurité — modifiez votre demande").
**Warning signs :** `response.text` est `undefined` ou vide. Vérifier `response.candidates` en premier.

### Pitfall 4 : Rate-limit Redis saturé par des INCR sans EXPIRE
**What goes wrong :** Si on oublie `EXPIRE`, les clés Redis s'accumulent indéfiniment.
**Why it happens :** INCR tout seul ne définit pas de TTL (contrairement à SETEX).
**How to avoid :** Toujours faire `INCR` + `EXPIRE` dans une transaction `multi()`. La fonction `checkRateLimit` ci-dessus le fait correctement.
**Warning signs :** `redis-cli KEYS "rate_limit:*"` montre des entrées de jours passés.

## Code Examples

### Exemple 1 : Appel Gemini basique (génération)

```typescript
// Source : [CITED: npmjs.com/package/@google/genai — Quickstart]
// Source : [CITED: github.com/googleapis/js-genai/blob/main/codegen_instructions.md — System Instructions]

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "Génère un post LinkedIn professionnel sur l'innovation tech.",
  config: {
    systemInstruction: "Tu es un expert en marketing B2B. Ton : professionnel mais accessible.",
    temperature: 0.7,
    maxOutputTokens: 1024,
  },
});

console.log(response.text);
```

### Exemple 2 : Gestion des safety filters

```typescript
// Source : [CITED: github.com/googleapis/js-genai/blob/main/codegen_instructions.md]
// Vérification des candidats et du promptFeedback

const response = await ai.models.generateContent({ model, contents, config });

// Vérifier si des candidats ont été retournés
if (!response.candidates || response.candidates.length === 0) {
  const feedback = response.promptFeedback;
  if (feedback?.blockReason) {
    // Le prompt a été bloqué
    console.error(`Blocked: ${feedback.blockReason}`);
    throw new Error(`Content blocked: ${feedback.blockReason}`);
  }
  throw new Error("Empty response from Gemini");
}

// Vérifier le finishReason de chaque candidat
for (const candidate of response.candidates) {
  if (candidate.finishReason && candidate.finishReason !== "STOP") {
    console.warn(`Non-standard finish: ${candidate.finishReason}`);
    // SAFETY, MAX_TOKENS, RECITATION, OTHER
  }
}

const text = response.text;
```

### Exemple 3 : Rate-limiting Redis (atomic INCR + EXPIRE)

```typescript
// Source : pratique établie Redis + ioredis [VERIFIED: codebase redis.ts]

import { redis } from "@/lib/redis";

const RATE_LIMIT_PER_PLATFORM: Record<string, number> = {
  instagram: 25,
  facebook: 50,
  linkedin: 100,
};

async function checkPublishRateLimit(
  platform: string,
  clientId: string,
): Promise<boolean> {
  const maxPerHour = RATE_LIMIT_PER_PLATFORM[platform];
  if (!maxPerHour) return true; // pas de limite pour cette plateforme

  const hourWindow = Math.floor(Date.now() / 3600000); // heures depuis epoch
  const redisKey = `rate_limit:${platform}:${clientId}:${hourWindow}`;

  // Transaction atomique : INCR + définir TTL si première insertion
  const multi = redis.multi();
  multi.incr(redisKey);
  multi.expire(redisKey, 7200); // TTL 2h pour couvrir le créneau
  const [err, countResult] = await multi.exec() ?? [];

  // Note : ioredis multi().exec() retourne [[err, result], ...]
  const count = countResult?.[1] as number ?? 0;

  return count <= maxPerHour;
}
```

### Exemple 4 : Health endpoint avec BullMQ getJobCounts()

```typescript
// Source : [CITED: docs.bullmq.io/guide/jobs/getters] — Queue.getJobCounts()

import { Queue } from "bullmq";
import { redis } from "@/lib/redis";

const queue = new Queue("social-publish", { connection: redis });

// Renvoie { wait: number, active: number, delayed: number, failed: number, completed: number, ... }
const counts = await queue.getJobCounts();

// Pour un usage dans le health endpoint :
const response = {
  status: "ok",
  queue: {
    waiting: counts.wait ?? 0,
    active: counts.active ?? 0,
    delayed: counts.delayed ?? 0,
    failed: counts.failed ?? 0,
    completed: counts.completed ?? 0,
  },
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@google/generative-ai` (legacy) | `@google/genai` (unified SDK) | 2025-03 (GA) | Nouveau SDK API complètement différente : `GoogleGenAI` au lieu de `GoogleGenerativeAI`, `ai.models.generateContent()` au lieu de `model.generateContent()`. |
| `gemini-1.5-flash/pro` (déprécié) | `gemini-2.5-flash/pro` | 2025-09 | Meilleure qualité, contexte 1M, thinking intégré. Plus de support pour 1.5. |
| RLS / middleware auth | `requireUser()` + `getActiveClientId()` | Projet v1 | Pattern établi dans ce projet depuis la Phase 1. |

**Deprecated/outdated :**
- `@google/generative-ai` : déprécié, EOL 2025-08-31. Ne pas utiliser.
- `gemini-1.5-flash` / `gemini-1.5-pro` : plus supportés, utiliser 2.5.
- Prisma génération de prompt custom : remplacer par template strings simples.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Les modèles `gemini-2.5-flash` supportent `systemInstruction` via la config | Code Examples — GeminiProvider | Faible : les docs officiels le confirment pour JS SDK. |
| A2 | `HarmCategory` et `HarmBlockThreshold` sont exportés depuis `@google/genai` | Code Examples — Safety Filters | Faible : confirmé par les codegen instructions du SDK. Peut être importé directement. |
| A3 | `redis.multi().exec()` retourne `[[err, result], ...]` dans ioredis v5 | Code Examples — Rate-limiting | Moyen : ioredis v5 a changé le format de retour. Vérifier avec `npm view ioredis version`. |
| A4 | Les seuils de rate-limit Instagram=25/h, Facebook=50/h, LinkedIn=100/h sont safe | Rate-limit Pattern | Faible : valeurs conservatrices. Meta API limite IG à ~60 posts/24h. LinkedIn est plus permissif. Les seuils sont configurables. |
| A5 | `publishQueue.getJobCounts()` est accessible depuis le route handler Next.js sans pénalité de perf | Health Endpoint | Moyen : appelle Redis à chaque requête santé. Acceptable pour un endpoint de monitoring (pas appelé fréquemment). |
| A6 | `GeminiProvider` peut être instancié sans await (pas de connexion persistante) | GeminiProvider | Faible : `GoogleGenAI` constructor est synchrone. |

**Total :** 6 claims tagged `[ASSUMED]`. Tous à faible ou moyen risque.

## Open Questions

1. **Quels seuils exacts pour le rate-limiting par plateforme ?**
   - Ce qu'on sait : Utiliser INCR + EXPIRE avec clé horaire. Les valeurs 25/h (IG), 50/h (FB), 100/h (LI) sont conservatrices.
   - Ce qui est flou : Les limites exactes de l'API Meta/LinkedIn en production varient selon le statut de l'app (sandbox vs live).
   - Recommandation : Rendre les seuils configurables via des variables d'environnement (p. ex. `RATE_LIMIT_INSTAGRAM=25`, `RATE_LIMIT_FACEBOOK=50`, `RATE_LIMIT_LINKEDIN=100`). Phase 7 peut les hardcoder, une phase ultérieure les externalisera.

2. **Bull Board : l'ajouter ou pas ?**
   - Ce qu'on sait : `@bull-board/api` + `@bull-board/express` permet une UI de monitoring. Mais Next.js App Router utilise Route Handlers, pas Express.
   - Ce qui est flou : L'intégration avec Next.js App Router n'est pas native — Bull Board suppose Express.js. Soit wrapper (sous-optimal) soit attendre.
   - Recommandation : Omettre Bull Board pour v1. L'endpoint `GET /api/health` + Taskforce.sh (paid) suffisent. Si monitoring UI nécessaire, Bull Board peut être ajouté dans une phase séparée avec un wrapper Express dans `/server.ts`.

3. **Test de l'IA : comment tester l'appel Gemini en CI ?**
   - Ce qu'on sait : Le mock `MockAiProvider` permet de tester les routes et l'UI sans clé API réelle.
   - Ce qui est flou : Comment tester les cas d'erreur spécifiques à Gemini (timeout, safety filter, API key manquante) sans faire de vrais appels ?
   - Recommandation : Remplacer `GeminiProvider` par un mock Vitest dans les tests. Tester `GeminiProvider` lui-même avec des tests d'intégration optionnels (clé API Gemini requise, taggués `@integration` et exclus du run CI standard).

## Validation Architecture

> Required when `workflow.nyquist_validation` is enabled (absent = enabled). If the key is absent, treat as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest v2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/lib/ai/ --reporter=verbose` (unit tests AI uniquement) |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AIGC-01 | MockAiProvider.generate() retourne un texte | unit | `npx vitest run src/lib/ai/__tests__/mock.test.ts -x` | ❌ Wave 0 |
| AIGC-01 | MockAiProvider.improve() préserve le texte existant | unit | `npx vitest run src/lib/ai/__tests__/mock.test.ts -x` | ❌ Wave 0 |
| AIGC-01 | POST /api/ai/generate valide le body (Zod) | integration | `npx vitest run src/app/api/ai/__tests__/generate.test.ts -x` | ❌ Wave 0 |
| AIGC-01 | POST /api/ai/generate rejette les requêtes non auth | integration | `npx vitest run src/app/api/ai/__tests__/generate.test.ts -x` | ❌ Wave 0 |
| AIGC-01 | getAiProvider() retourne MockAiProvider quand AI_MODE=mock | unit | `npx vitest run src/lib/ai/__tests__/index.test.ts -x` | ❌ Wave 0 |
| AIGC-01 | getAiProvider() retourne GeminiProvider quand AI_MODE=gemini (sans clé → erreur) | unit | `npx vitest run src/lib/ai/__tests__/index.test.ts -x` | ❌ Wave 0 |
| AIGC-02 | POST /api/ai/generate inclut le brand voice dans le prompt | integration | `npx vitest run src/app/api/ai/__tests__/generate.test.ts -x` | ❌ Wave 0 |
| AIGC-02 | GET/POST /api/clients/[id]/brand-voice CRUD | integration | `npx vitest run src/app/api/clients/__tests__/brand-voice.test.ts -x` | ❌ Wave 0 |
| Hardening | Rate-limit bloque après dépassement | integration | `npx vitest run src/lib/__tests__/rate-limit.test.ts -x` | ❌ Wave 0 |
| Hardening | GET /api/health retourne queue depths | integration | `npx vitest run src/app/api/health/__tests__/health.test.ts -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit :** `npx vitest run src/lib/ai/ --reporter=verbose`
- **Per wave merge :** `npx vitest run`
- **Phase gate :** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/ai/__tests__/mock.test.ts` — tests du `MockAiProvider`
- [ ] `src/lib/ai/__tests__/index.test.ts` — tests du `getAiProvider()` factory
- [ ] `src/app/api/ai/__tests__/generate.test.ts` — tests de la route handler
- [ ] `src/app/api/clients/__tests__/brand-voice.test.ts` — tests CRUD brand voice
- [ ] `src/lib/__tests__/rate-limit.test.ts` — tests du rate-limiting Redis
- [ ] `src/app/api/health/__tests__/health.test.ts` — tests du health endpoint
- [ ] `src/lib/ai/` — dossier créé (pas de fichier de config supplémentaire nécessaire)
- [ ] `src/lib/ai/__tests__/gemini.test.ts` — optionnel (test intégration Gemini, besoin clé API)

## Security Domain

> Required when `security_enforcement` is enabled (absent = enabled). Config has `security_enforcement: true` — included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `requireUser()` — pattern existant, déjà validé Phases 1-6 |
| V4 Access Control | yes | `getActiveClientId()` — isolation client déjà validée |
| V5 Input Validation | yes | Zod schema — validation de `POST /api/ai/generate` body |
| V6 Cryptography | yes | `GEMINI_API_KEY` stockée dans l'environnement, jamais exposée au client |

### Known Threat Patterns for AI Endpoint

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key leak via client-side call | Information disclosure | L'appel Gemini est server-side uniquement (Route Handler). La clé n'est jamais envoyée au client. |
| Prompt injection via brand_voice | Tampering | Le brand_voice est écrit par l'équipe (interne). Risque faible. En v2 : valider le contenu du profil avant de l'injecter dans le system prompt. |
| Rate-limit bypass | Denial of Service | Vérification côté serveur avec Redis. Pas de contournement possible (le check est dans le handler, pas dans le client). |
| Token leak in logs | Information disclosure | Ne pas logger `response.text` en production. Le contenu généré peut contenir des données client. |
| Safety filter bypass via crafted prompt | — | Les safety filters de Gemini sont actifs par défaut. Surveiller `blockReason` et `finishReason`. |

## Sources

### Primary (HIGH confidence)
- **@google/genai API patterns** — [CITED: github.com/googleapis/js-genai/blob/main/codegen_instructions.md] — système instruction, generateContent, safety settings, error handling
- **@google/genai npm** — [CITED: npmjs.com/package/@google/genai] — version (2.10.0), installation, quickstart
- **BullMQ getJobCounts** — [CITED: docs.bullmq.io/guide/jobs/getters] — méthodes de récupération des comptes
- **BullMQ metrics** — [CITED: docs.bullmq.io/guide/metrics] — configuration des métriques worker
- **Codebase existante** — [VERIFIED: codebase] — src/lib/publish/provider.ts, index.ts ; src/app/api/posts/[id]/publish/route.ts ; src/lib/redis.ts ; src/lib/db/schema.ts ; src/components/compose/PublishModal.tsx ; src/components/compose/PublishStatusView.tsx
- **Test utilities** — [VERIFIED: codebase] — src/test-utils/request.ts, vitest.config.ts, vitest.setup.ts

### Secondary (MEDIUM confidence)
- **Gemini pricing/models** — [CITED: ai.google.dev/gemini-api/docs/models/gemini] — modèle recommandé `gemini-2.5-flash`
- **Sliding window Redis rate-limiting** — [ASSUMED : pratique établie Redis/INCR + EXPIRE] — pattern standard documenté dans la documentation Redis

### Tertiary (LOW confidence)
- Aucune source LOW — toutes les recommandations sont vérifiées via codebase existante, docs officielles, ou le SDK sur npm.

## Metadata

**Confidence breakdown :**
- Standard stack : HIGH — `@google/genai` confirmé sur npm, docs existantes, codebase existante.
- Architecture : HIGH — patterns déjà validés en Phases 1-6 (Provider, Route Handler, Modal, Test).
- Pitfalls : HIGH — issus de la documentation officielle et des issues GitHub du SDK.
- Rate-limit thresholds : MEDIUM — valeurs conservatrices, à ajuster en production.

**Research date :** 2026-07-12
**Valid until :** 2026-08-12 (le SDK `@google/genai` est stable, les modèles Gemini 2.5 sont GA)
