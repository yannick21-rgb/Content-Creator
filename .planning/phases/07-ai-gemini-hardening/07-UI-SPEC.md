# Phase 07: AI (Gemini) & Hardening — UI Design Contract

**Gathered:** 2026-07-12
**Status:** Ready for planning

## UI Components

### AiModal (NEW)
**Type:** Create — `src/components/compose/AiModal.tsx`
**Pattern:** Follows `PublishModal.tsx` (shadcn/ui Dialog)

**States:**
| State | Behaviour |
|-------|-----------|
| Default | Modal closed. Triggered by "Générer" or "Améliorer" buttons in composer. |
| Loading | Spinner + "Génération en cours..." text. Disabled action buttons. |
| Success | Generated text displayed in a scrollable textarea/div. "Insérer" and "Régénérer" buttons active. |
| Error | Error message (timeout, API key missing, safety filter) with "Réessayer" button. |
| Empty (generate) | Instructions field empty — "Générer" button disabled until instructions entered. |
| Empty (improve) | Existing text auto-filled. "Améliorer" button always active. |

**Accessibility:**
- Modal role="dialog", aria-modal="true"
- Focus trap within modal
- Close on Escape and backdrop click
- aria-live="polite" for result area

### BrandVoicePage (NEW)
**Type:** Create — `src/app/clients/[id]/brand-voice/page.tsx`
**Pattern:** Server component page with client component form

**States:**
| State | Behaviour |
|-------|-----------|
| Loading | Skeleton/spinner while fetching current profile |
| Empty / No profile | Empty form fields with placeholder text. "Aucun profil de marque défini" info banner. |
| Editing | Two fields: "Tonalité" (text input) + "Consignes de style" (textarea). Save button. |
| Saving | Button shows "Enregistrement..." with spinner. Fields disabled. |
| Saved | Success toast. Button returns to "Enregistré ✓" for 2s then back to "Enregistrer". |
| Save error | Error toast with message. Fields remain editable. |
| Delete | "Réinitialiser" link to clear profile (PATCH with null values). |

**Accessibility:**
- Labels on both fields
- Form submission on Enter (single-line) / Cmd+Enter (textarea)
- Error messages linked via aria-describedby

### PublishStatusView Retry Button (MODIFY)
**Type:** Modify — `src/components/compose/PublishStatusView.tsx`

**States:**
| State | Behaviour |
|-------|-----------|
| Default (no failed) | No retry UI shown. Existing status badges unchanged. |
| Failed target | Red "Failed" badge + error message + "Retry" button per target. |
| Retrying | Button shows "Retrying..." with spinner. Disabled. |
| Retry success | Target status updates via existing polling (3s refresh). |
| Retry error | Error toast. Button re-enabled. |

**Integration:**
- Retry calls `POST /api/posts/[id]/publish` with `{ socialAccountIds: [targetId] }`
- Triggers re-fetch of publish status data after retry

### Composer AI Buttons (MODIFY)
**Type:** Modify — `src/app/compose/new/page.tsx`

**Changes:**
- Add "Générer" button (secondary style) beside textarea when textarea is empty
- Add "Améliorer" button (secondary style) beside textarea when textarea has text
- Both buttons open AiModal
- Buttons positioned after the textarea, before the Publish/Schedule button row

**States:**
| State | Behaviour |
|-------|-----------|
| Textarea empty | "Générer" shown, "Améliorer" hidden |
| Textarea has text | "Générer" hidden, "Améliorer" shown |
| Modal open | Buttons disabled (modal active) |
| No AI_MODE | Both buttons hidden (if AI_MODE not set or mock) |

## Routes

| Path | Type | Components | States |
|------|------|------------|--------|
| `/clients/[id]/brand-voice` | Page (server + client) | BrandVoicePage | loading / empty / editing / saving / error |
| `POST /api/ai/generate` | Route handler (JSON) | — | validation error / success / auth error / AI error / safety block |

## Design Spec — Key UX Flows

### AI Generation Flow
```
[Composer] ➜ "Générer" button ➜ [AiModal opens]
  ➜ User enters instructions (optional)
  ➜ User selects: Tone (optional, from profile or override), Length (short/medium/long), Platform (FB/IG/LI)
  ➜ "Générer" button in modal
  ➜ Loading spinner
  ➜ Result displayed in modal
  ➜ Options: "Insérer" (fills textarea, closes modal) or "Régénérer" (re-generates)
```

### AI Improvement Flow
```
[Composer] ➜ Type text ➜ "Améliorer" button ➜ [AiModal opens]
  ➜ Existing text pre-filled in context
  ➜ Same options as generation
  ➜ "Améliorer" button
  ➜ Result replaces existing text area (or inserts)
```

### Brand-Voice Editing Flow
```
[Nav ➜ Client ➜ Brand Voice] ➜ [BrandVoicePage loads]
  ➜ Existing profile shown (or empty)
  ➜ Edit "Tonalité" and/or "Consignes de style"
  ➜ "Enregistrer" button
  ➜ Saving spinner
  ➜ Success toast + button confirmation
  ➜ Profile immediately active for next AI generation
```

### Retry Failed Publish Flow
```
[Post detail view] ➜ PublishStatusView shows failed target
  ➜ "Retry" button visible
  ➜ Click → button shows "Retrying..."
  ➜ API call to POST /api/posts/[id]/publish
  ➜ Polling picks up new status → updated badge
```

### Mobile / Responsive Considerations
- AiModal: Full-screen on mobile (<640px), centered dialog on desktop
- Brand-voice form: Stack fields vertically on mobile, two-column on desktop
- Retry button: Full-width on mobile, inline on desktop
- AI buttons in composer: Below textarea on all sizes (not side-by-side)

## Integration Points

| Integration | Existing File | Change |
|-------------|---------------|--------|
| AI trigger | `src/app/compose/new/page.tsx` | Add two buttons beside textarea |
| AI modal | `src/components/compose/PublishModal.tsx` | Pattern reference only (separate component) |
| Retry button | `src/components/compose/PublishStatusView.tsx` | Add Retry button per failed target |
| Brand voice nav | `src/components/nav/AppNav.tsx` | Add "Brand Voice" link in client sub-navigation |

---

*Phase: 07-ai-gemini-hardening*
*UI Design Contract: 2026-07-12*
