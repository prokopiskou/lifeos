"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeOnboardingAnswers } from "@/lib/onboarding-answers";
import { createClient } from "@/lib/supabase/client";

type Question = {
  prompt: string;
  choices: string[];
};

export default function OnboardingPage() {
  const router = useRouter();
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(
    null
  );

  const questions: Question[] = useMemo(
    () => [
      {
        prompt: "Πώς θα περιέγραφες τον εαυτό σου αυτή τη στιγμή;",
        choices: [
          "Ξέρω τι θέλω αλλά δεν κινούμαι",
          "Δεν ξέρω τι θέλω και νιώθω χαμένος",
          "Νιώθω καλά αλλά θέλω κάτι περισσότερο",
          "Είμαι σε μια δύσκολη περίοδο και χρειάζομαι στήριξη",
        ],
      },
      {
        prompt: "Τι σε κρατάει πίσω περισσότερο;",
        choices: [
          "Ο φόβος της αποτυχίας ή της κριτικής",
          "Η υπερανάλυση — σκέφτομαι πολύ, κάνω λίγο",
          "Η έλλειψη αυτοπεποίθησης",
          "Το άγχος και η ένταση που νιώθω συχνά",
        ],
      },
      {
        prompt: "Αν άλλαζε ένα πράγμα στη ζωή σου, τι θα ήταν;",
        choices: [
          "Η σχέση μου με τον εαυτό μου",
          "Η δουλειά μου / ο σκοπός μου",
          "Οι σχέσεις μου με άλλους",
          "Η καθημερινότητά μου / η ρουτίνα μου",
        ],
      },
      {
        prompt: "Πώς μαθαίνεις και αλλάζεις καλύτερα;",
        choices: [
          "Με μικρά βήματα κάθε μέρα",
          "Με βαθιά κατανόηση του γιατί",
          "Με υποστήριξη από άλλους",
          "Με δράση — δοκιμάζω και βλέπω",
        ],
      },
      {
        prompt: "Πού βρίσκεσαι τώρα;",
        choices: [
          "Έτοιμος να κάνω αλλαγές, χρειάζομαι κατεύθυνση",
          "Θέλω αλλαγή αλλά φοβάμαι",
          "Ψάχνω ακόμα — δεν είμαι σίγουρος",
          "Είμαι σε κρίση και χρειάζομαι στήριξη τώρα",
        ],
      },
    ],
    []
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => Array(5).fill(""));

  const [phase, setPhase] = useState<"in" | "out">("in");
  const [isAdvancing, setIsAdvancing] = useState(false);
  const advanceTimeoutRef = useRef<number | null>(null);

  const [authReady, setAuthReady] = useState(false);
  const [savingError, setSavingError] = useState<string | null>(null);
  /** Stripe return URL: middleware skips subscription until webhook writes DB — no client-side subscription gate. */
  const [postPaymentReturn, setPostPaymentReturn] = useState(false);

  useEffect(() => {
    setPostPaymentReturn(
      new URLSearchParams(window.location.search).get("payment") === "success"
    );
  }, []);

  useEffect(() => {
    // Defer Supabase client creation to the browser.
    // This avoids `next build` prerendering crashes when env vars aren't present yet.
    setSupabase(createClient());
  }, []);

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active) return;
        if (!data.user) {
          router.replace("/login");
          return;
        }
        setAuthReady(true);
      })
      .catch(() => {
        if (!active) return;
        router.replace("/login");
      });
    return () => {
      active = false;
    };
  }, [router, supabase]);

  async function saveToSupabase(nextAnswers: string[]) {
    if (!supabase) return;
    setSavingError(null);

    const { data, error: userError } = await supabase.auth.getUser();
    if (userError) {
      setSavingError("Δεν ήταν δυνατή η σύνδεση. Δοκίμασε ξανά.");
      setIsAdvancing(false);
      setPhase("in");
      return;
    }
    if (!data.user) {
      router.replace("/login");
      return;
    }

    const { error: insertError } = await supabase.from("onboarding_answers").insert({
      user_id: data.user.id,
      answers: nextAnswers,
    });

    if (insertError) {
      setSavingError("Κάτι πήγε στραβά κατά την αποθήκευση. Δοκίμασε ξανά.");
      setIsAdvancing(false);
      setPhase("in");
      return;
    }

    // Confirm the row is readable (same session/RLS) before leaving; avoids dashboard → /onboarding loop.
    const { data: verifyRows, error: verifyError } = await supabase
      .from("onboarding_answers")
      .select("answers")
      .eq("user_id", data.user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    const verifyRaw = Array.isArray(verifyRows) ? verifyRows[0]?.answers : null;
    const verifyOk = normalizeOnboardingAnswers(verifyRaw) !== null;

    if (verifyError || !verifyOk) {
      setSavingError(
        "Η αποθήκευση ολοκληρώθηκε, αλλά δεν ήταν δυνατό να επιβεβαιωθεί. Ανανέωσε τη σελίδα ή δοκίμασε ξανά."
      );
      setIsAdvancing(false);
      setPhase("in");
      return;
    }

    setIsAdvancing(false);
    setPhase("in");
    window.location.href = "/dashboard";
  }

  const currentStep = Math.min(questions.length, currentIndex + 1);
  const progressPercent = Math.min(
    100,
    Math.max(0, (currentStep / questions.length) * 100)
  );

  function onPick(choice: string) {
    if (isAdvancing) return;

    const qIndex = currentIndex;
    const nextAnswers = [...answers];
    nextAnswers[qIndex] = choice;
    setAnswers(nextAnswers);

    // If user reached the last question, all answers must be set.
    if (qIndex === questions.length - 1 && nextAnswers.some((a) => !a)) {
      setSavingError("Παρακαλώ διάλεξε μια επιλογή για κάθε ερώτηση.");
      return;
    }

    setIsAdvancing(true);
    setPhase("out");

    // Small delay so the "out" animation is visible.
    advanceTimeoutRef.current = window.setTimeout(() => {
      const last = qIndex === questions.length - 1;
      if (last) {
        void saveToSupabase(nextAnswers);
        return;
      }
      setCurrentIndex((i) => i + 1);
      setPhase("in");
      setIsAdvancing(false);
    }, 220);
  }

  useEffect(() => {
    return () => {
      if (advanceTimeoutRef.current) window.clearTimeout(advanceTimeoutRef.current);
    };
  }, []);

  const question = questions[currentIndex];

  return (
    <main className="min-h-screen bg-white px-6">
      <div className="mx-auto flex max-w-2xl flex-col pb-16 pt-10">
        <header className="mb-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Onboarding</h1>
              <p className="mt-1 text-sm text-neutral-600">
                Ερώτηση {currentIndex + 1} / {questions.length}
              </p>
            </div>
            <div className="w-28">
              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full bg-black transition-[width] duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </header>

        {authReady && postPaymentReturn ? (
          <p className="mb-6 rounded-xl border border-black/10 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
            Η πληρωμή ολοκληρώθηκε. Συνέχισε με τις ερωτήσεις — δεν χρειάζεται να περιμένεις να ενημερωθεί η
            συνδρομή στο σύστημα.
          </p>
        ) : null}

        {!authReady ? (
          <section className="flex items-center justify-center">
            <div className="text-center">
              <div className="text-sm text-neutral-600">Φόρτωση...</div>
            </div>
          </section>
        ) : (
        <section className="relative">
          <div
            key={currentIndex}
            className={[
              "rounded-2xl border border-black/10 bg-white p-6 shadow-sm",
              "transition-all duration-300 ease-out",
              phase === "out" ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0",
            ].join(" ")}
            aria-live="polite"
          >
            <p className="text-lg font-medium text-black">{question.prompt}</p>

            <div className="mt-6 grid gap-3">
              {question.choices.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => onPick(choice)}
                  disabled={isAdvancing}
                  className={[
                    "w-full rounded-xl border border-black/20 bg-white px-5 py-4 text-left",
                    "transition-colors duration-150",
                    "hover:bg-black hover:text-white",
                    "disabled:cursor-not-allowed disabled:opacity-70",
                  ].join(" ")}
                >
                  {choice}
                </button>
              ))}
            </div>

            {savingError ? (
              <p className="mt-5 text-sm font-medium text-black">{savingError}</p>
            ) : null}
          </div>

          <div className="mt-4 text-xs text-neutral-500">
            Επιλέξτε μία επιλογή για να συνεχίσετε αυτόματα.
          </div>
        </section>
        )}
      </div>
    </main>
  );
}
