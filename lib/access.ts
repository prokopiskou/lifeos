// ============================================================
// WITHIN OS — Phase 8: Access / trial logic
// Free 14 ημέρες full access. Μετά: paywall (test mode).
// Pure helper — μπορεί να κληθεί από server components / routes.
// ============================================================

export const TRIAL_DAYS = 14;

export type AccessInput = {
  /** profiles.created_at (ISO) ή auth user created_at */
  createdAt?: string | null;
  /** subscriptions.status (π.χ. 'active','trialing') ή null */
  subscriptionStatus?: string | null;
};

export type AccessResult = {
  inTrial: boolean;
  trialDaysLeft: number;
  hasSubscription: boolean;
  hasAccess: boolean;
};

export function computeAccess({ createdAt, subscriptionStatus }: AccessInput): AccessResult {
  const hasSubscription = subscriptionStatus === "active" || subscriptionStatus === "trialing";

  let trialDaysLeft = 0;
  if (createdAt) {
    const start = new Date(createdAt).getTime();
    const elapsedDays = Math.floor((Date.now() - start) / 86400000);
    trialDaysLeft = Math.max(0, TRIAL_DAYS - elapsedDays);
  }
  const inTrial = trialDaysLeft > 0;

  return {
    inTrial,
    trialDaysLeft,
    hasSubscription,
    // Πρόσβαση: trial ΕΝΕΡΓΟ ή ενεργή συνδρομή. (Paywall μπαίνει όταν λήξει το trial.)
    hasAccess: inTrial || hasSubscription,
  };
}
