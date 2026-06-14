# Within OS — PROGRESS

## ✅ Phase 0 — Σταθεροποίηση + redirect loop
- `middleware.ts`: authenticated users σε auth-landing pages → `/onboarding` (αν δεν έγινε onboarding) ή `/dashboard`. Έλεγχος `profiles.onboarding_done` ΚΑΙ `onboarding_answers` (non-breaking για παλιούς χρήστες).

## ✅ Phase 1 — Data model + RLS
- `supabase/within_os_schema.sql` — **ΕΧΕΙ ΤΡΕΞΕΙ LIVE** στο Supabase (`ggzohctistxaaiguufjw`). 8 πίνακες + RLS ενεργό.

## ✅ Phase 2 — Design system + Within Grid
- `app/globals.css`: tokens (ink/paper/gold/grey), `.within-btn`, animations, `--font-within`.
- `components/WithinGrid.tsx`: reusable 2-axis grid + `quadrantOf()` helper.

## ✅ Phase 3 — Onboarding (10 οθόνες)
- `app/onboarding/page.tsx`: πλήρες flow με ακριβές ελληνικό copy. Gender επιλογή (f/m/n), identity input + whispered παραδείγματα (6''), mirror moment (5'' χωρίς κουμπί), anti-promise, first taste (WithinGrid), first reflection (quadrant × answer × gender), glimpse, notifications. Στο τέλος γράφει `profiles` (identity_statement, identity_gender, identity_locked_until=+30, within_path_stage='awake', onboarding_done=true, notify_time) → redirect `/dashboard`.

## ✅ Phase 4 — State Engine + nightly cron
- `app/api/cron/compute-state/route.ts`: protected με `CRON_SECRET`. Υπολογίζει AR_7d, trajectory, volatility, engagement_integrity, body_gap, early signals. Rule engine 7 καταστάσεων (**masking ελέγχεται ΠΡΙΝ το momentum**). Γράφει `user_state_daily` (σήμερα) + `task_calibration` (αύριο) μέσω admin client.
- `vercel.json`: cron `/api/cron/compute-state` κάθε βράδυ 23:30 (`30 23 * * *`).
- ✅ `npx tsc --noEmit` περνάει χωρίς errors.

## ✅ Phase 5 — Daily flow
- `app/api/tasks/today/route.ts`: πρωινό task generation (Claude), πλήθος βάσει `task_size`, idempotent, γράφει `evidence_tasks`.
- `app/api/checkin/route.ts`: βραδινό check-in → upsert `daily_checkins` + tone-appropriate μήνυμα (Claude, βάσει `tone_profile`).
- `app/checkin/page.tsx`: ροή 15'' (grid → ερώτηση ταυτότητας → tasks → λέξη → tone μήνυμα).
- ✅ tsc καθαρό.

## ✅ Phase 6 — Pattern Mirror (weekly)
- `app/api/cron/pattern-mirror/route.ts`: Κυριακή 21:00. Rule engine (priority: avoidance→restoration→identity→patterns→return→continuation), stage-adaptive Claude prompt, γράφει `pattern_mirrors`. Manual override: skip αν υπάρχει ήδη row για την εβδομάδα.
- `vercel.json`: + cron `0 21 * * 0`.

## ✅ Phase 7 — Within Path + Admin
- `app/api/admin/promote/route.ts`: admin-only. Ενημερώνει `profiles.within_path_stage` + `stage_updated_at` (+ `user_journey` compat) και γράφει `path_letters` αν δοθεί γράμμα.
- `AdminUsersClient`: το "Αποθήκευση" ζητά προαιρετικό personal letter (prompt) → καλεί `/api/admin/promote`.
- `app/api/path-letter/route.ts`: GET αδιάβαστο γράμμα / POST mark-read.
- `components/PathLetterModal.tsx` mountαρισμένο στο `layout.tsx`: ο χρήστης βλέπει το γράμμα ως modal μία φορά.

## 🟡 Phase 8 — Polish (μερικώς)
- `app/manifest.ts` (PWA, installable) + `viewport`/theme-color + appleWebApp στο `layout.tsx`. **ΣΗΜ:** πρόσθεσε icon files στο `/public/` + ξεμπλόκαρε το `icons` array.
- `lib/access.ts`: trial (14 ημέρες) + subscription helper `computeAccess()`. (Δεν hard-gate-άρει — paywall enforcement μπαίνει όταν θες, χρησιμοποιώντας το helper στο /pricing/premium features.)
- **Εκκρεμεί:** CMU Concrete font file· offline service worker· hard paywall enforcement μετά το trial· post-onboarding loading screen.

---
## ✅ ΣΥΝΟΨΗ: Phases 0→7 πλήρη + Phase 8 core. Όλο το core του brief λειτουργικό, tsc καθαρό.

## ⚠️ Χειροκίνητες ενέργειες owner
1. **Push** τα τοπικά commits.
2. **Env vars** (Vercel): `ANTHROPIC_API_KEY`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_*` (test), `NEXT_PUBLIC_APP_URL`. (Vercel cron στέλνει αυτόματα `Authorization: Bearer $CRON_SECRET` όταν υπάρχει το env var.)
3. **CMU Concrete font** files στο `/public/fonts/` + `@font-face` (αλλιώς serif fallback).
4. Το `/api/cron/compute-state` χρειάζεται **Vercel Pro** για να τρέξει αυτόματα το cron (Hobby: περιορισμένα/καθόλου). Εναλλακτικά external trigger (GitHub Actions) με το `CRON_SECRET` header.
