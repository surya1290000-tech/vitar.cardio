import { NextResponse } from 'next/server';
import { stripe, SUBSCRIPTION_PRICES, SubscriptionPlan } from '@/lib/stripe';
import { sql } from '@/lib/db';
import { withAuth, AuthedRequest } from '@/lib/authMiddleware';
import { z } from 'zod';

const SubSchema = z.object({
  plan: z.enum(['basic', 'pro', 'clinical']),
});

// GET — get current subscription
export const GET = withAuth(async (req: AuthedRequest) => {
  const subs = await sql`
    SELECT id, plan, status, current_period_start, current_period_end, cancel_at_period_end
    FROM subscriptions WHERE user_id = ${req.user.sub} AND status != 'cancelled'
    ORDER BY created_at DESC LIMIT 1
  `;
  return NextResponse.json({ subscription: subs[0] || null });
});

// POST — create subscription
export const POST = withAuth(async (req: AuthedRequest) => {
  try {
    const body = await req.json();
    const { plan } = SubSchema.parse(body);

    const users = await sql`
      SELECT stripe_customer_id, email FROM users WHERE id = ${req.user.sub}
    `;
    const user = users[0] as { stripe_customer_id: string | null; email: string };

    if (!user.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No payment method on file. Please complete a device order first.' },
        { status: 400 }
      );
    }

    const sub = await stripe.subscriptions.create({
      customer: user.stripe_customer_id,
      items: [{ price: SUBSCRIPTION_PRICES[plan as SubscriptionPlan] }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });

    return NextResponse.json({
      success: true,
      subscriptionId: sub.id,
      status: sub.status,
      clientSecret: (sub.latest_invoice as any)?.payment_intent?.client_secret,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }
    console.error('[SUBSCRIPTION ERROR]', error);
    return NextResponse.json({ error: 'Failed to create subscription.' }, { status: 500 });
  }
});

// DELETE — cancel subscription at period end
export const DELETE = withAuth(async (req: AuthedRequest) => {
  const subs = await sql`
    SELECT stripe_subscription_id FROM subscriptions
    WHERE user_id = ${req.user.sub} AND status = 'active'
  `;

  if (subs.length === 0) {
    return NextResponse.json({ error: 'No active subscription found.' }, { status: 404 });
  }

  const { stripe_subscription_id } = subs[0] as { stripe_subscription_id: string };

  await stripe.subscriptions.update(stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  await sql`
    UPDATE subscriptions SET cancel_at_period_end = true, updated_at = NOW()
    WHERE stripe_subscription_id = ${stripe_subscription_id}
  `;

  return NextResponse.json({
    success: true,
    message: 'Subscription will cancel at end of billing period.',
  });
});
