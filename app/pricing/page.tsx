import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

const CHECKOUT_MESSAGES: Record<string, string> = {
  missing_key: "Λείπει το STRIPE_SECRET_KEY στο .env.local.",
  auth_error: "Δεν ήταν δυνατή η επιβεβαίωση της σύνδεσης. Συνδέσου ξανά.",
  no_url: "Η δημιουργία του Stripe Checkout απέτυχε (χωρίς URL). Δοκίμασε ξανά.",
  stripe_error: "Το Stripe απέτυχε. Έλεγξε το κλειδί API και ότι το λογαριασμό σου Stripe είναι ενεργός.",
};

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function PricingPage({ searchParams }: Props) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const checkoutRaw = searchParams.checkout;
  const checkoutCode =
    typeof checkoutRaw === "string" ? checkoutRaw : undefined;
  const checkoutMessage = checkoutCode
    ? CHECKOUT_MESSAGES[checkoutCode] ??
      "Η έναρξη checkout απέτυχε. Δοκίμασε ξανά."
    : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-10">
      <div className="w-full max-w-[480px]">
        <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-semibold text-black">Τιμές</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Ξεκίνα με μηνιαία συνδρομή για το Life OS.
          </p>

          {checkoutMessage ? (
            <p className="mt-6 text-sm font-medium leading-relaxed text-black">
              {checkoutMessage}
            </p>
          ) : null}

          <div className="mt-8 flex items-baseline justify-between gap-4 border-t border-black/10 pt-8">
            <div>
              <h2 className="text-xl font-semibold text-black">Life OS</h2>
              <p className="mt-1 text-sm text-neutral-600">€29/μήνα</p>
            </div>
          </div>

          <ul className="mt-6 space-y-3">
            <li className="text-sm text-black">
              Personalized daily task από AI
            </li>
            <li className="text-sm text-black">
              Within Path™ progress tracking
            </li>
            <li className="text-sm text-black">
              Broadcast content από τον Προκόπη
            </li>
            <li className="text-sm text-black">Live sessions / Q&A</li>
          </ul>

          {user ? (
            <form
              action="/api/stripe/create-checkout"
              method="POST"
              className="mt-8"
            >
              <button
                type="submit"
                className={[
                  "h-12 w-full rounded-xl border border-black/20 px-4 text-sm font-medium transition",
                  "bg-black text-white hover:bg-neutral-900",
                ].join(" ")}
              >
                Ξεκίνα τώρα
              </button>
            </form>
          ) : (
            <Link
              href="/signup"
              className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-xl border border-black/20 bg-black px-4 text-sm font-medium text-white transition hover:bg-neutral-900"
            >
              Ξεκίνα τώρα
            </Link>
          )}
        </div>

        {user ? (
          <p className="mt-6 text-center text-sm text-neutral-600">
            <Link
              href="/"
              className="font-medium text-black underline decoration-black/30 underline-offset-4 hover:decoration-black"
            >
              Αρχική
            </Link>
          </p>
        ) : (
          <p className="mt-6 text-center text-sm text-neutral-600">
            <Link
              href="/login"
              className="font-medium text-black underline decoration-black/30 underline-offset-4 hover:decoration-black"
            >
              Σύνδεση
            </Link>
            {" · "}
            <Link
              href="/signup"
              className="font-medium text-black underline decoration-black/30 underline-offset-4 hover:decoration-black"
            >
              Εγγραφή
            </Link>
            {" · "}
            <Link
              href="/"
              className="font-medium text-black underline decoration-black/30 underline-offset-4 hover:decoration-black"
            >
              Αρχική
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
