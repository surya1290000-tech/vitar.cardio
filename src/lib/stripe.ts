import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in .env.local');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// ── PRICE MAP (in cents) ───────────────────────────────────────
export const DEVICE_PRICES = {
  core:  29900,  // $299
  pro:   49900,  // $499
  elite: 79900,  // $799
} as const;

// ── SUBSCRIPTION PRICE IDs (set these in Stripe Dashboard) ─────
// Create these products in Stripe and paste the price IDs below
export const SUBSCRIPTION_PRICES = {
  basic:    process.env.STRIPE_PRICE_BASIC    || 'price_basic_placeholder',
  pro:      process.env.STRIPE_PRICE_PRO      || 'price_pro_placeholder',
  clinical: process.env.STRIPE_PRICE_CLINICAL || 'price_clinical_placeholder',
} as const;

export type DeviceModel = keyof typeof DEVICE_PRICES;
export type SubscriptionPlan = keyof typeof SUBSCRIPTION_PRICES;
