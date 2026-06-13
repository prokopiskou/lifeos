# Within OS — DECISIONS (αποφάσεις κατά το build)

- **Redirect logic (Phase 0):** Authenticated users σε auth-landing → `/onboarding` αν δεν υπάρχει εγγραφή στο `onboarding_answers`, αλλιώς `/dashboard`. Αφαιρέθηκε το παλιό `hasSubscription` gate που άφηνε νέους χρήστες κολλημένους στο `/pricing`. Λόγος: trial δίνει πρόσβαση· paywall μπαίνει αργότερα (μετά το πρώτο Pattern Mirror).
- **onboarding flag:** Χρησιμοποιήθηκε το υπάρχον `onboarding_answers` ως ένδειξη "onboarding done" (συμβατότητα με Life OS). Το νέο `profiles.onboarding_done` θα συγχρονιστεί στο Phase 3.
- **RLS:** Ενεργοποιήθηκε μέσα στο SQL (do-block, idempotent). Στο Supabase warning επιλέχθηκε "Run without RLS" επειδή το ίδιο το SQL κάνει το enable RLS + policies (όχι διπλό handling).
- **CMU Concrete:** Δεν είναι διαθέσιμο ως Google Font. Ορίστηκε `--font-within: "CMU Concrete", Georgia, serif` ώστε να δουλεύει με fallback. Χρειάζεται προσθήκη font files + `@font-face` για το πραγματικό typeface.
- **WithinGrid:** Τοποθετήθηκε στο `components/` (δίπλα στα υπάρχοντα BottomNav/LogoutButton). Καταγράφει συνεχείς συντεταγμένες· y-άξονας με πάνω=καθαρή. Export και `quadrantOf()` helper για reuse στο state engine.
