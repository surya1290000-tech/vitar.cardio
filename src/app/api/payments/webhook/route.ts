import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { sql } from '@/lib/db';
import Stripe from 'stripe';

// Stripe requires the raw body for signature verification
export const config = { api: { bodyParser: false } };

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('[WEBHOOK] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    // Webhook event-level idempotency guard (prevents replayed event reprocessing).
    try {
      const insertedEvent = await sql`
        INSERT INTO stripe_webhook_events (event_id, event_type, payload)
        VALUES (${event.id}, ${event.type}, ${body})
        ON CONFLICT (event_id) DO NOTHING
        RETURNING id
      `;
      if (insertedEvent.length === 0) {
        console.log(`[WEBHOOK] Duplicate event ignored: ${event.id}`);
        return NextResponse.json({ received: true, duplicate: true });
      }
    } catch (idempotencyError) {
      // Keep flow backward compatible if table is not migrated yet.
      console.error('[WEBHOOK IDEMPOTENCY GUARD ERROR]', idempotencyError);
    }

    switch (event.type) {

      // ── PAYMENT SUCCEEDED ──────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id;
        const userId = session.metadata?.user_id;
        const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;

        if (!orderId || !userId) {
          console.error('[WEBHOOK] Missing order/user metadata on checkout.session.completed');
          break;
        }

        if (!paymentIntentId) {
          console.error('[WEBHOOK] Missing payment_intent on checkout.session.completed');
          break;
        }

        // Guard order transition to avoid accidental regressions from replayed/out-of-order events.
        const currentOrder = await sql`
          SELECT id, status FROM orders WHERE id = ${orderId} LIMIT 1
        `;

        if (currentOrder.length === 0) {
          console.error(`[WEBHOOK] Order not found: ${orderId}`);
          break;
        }

        const currentStatus = (currentOrder[0] as { status: string }).status;
        const canConfirm = ['pending', 'payment_failed'].includes(currentStatus);

        if (canConfirm) {
          await sql`
            UPDATE orders SET status = 'confirmed', updated_at = NOW()
            WHERE id = ${orderId}
          `;
        }

        // Idempotency: only insert payment if this payment_intent has not been recorded yet.
        const existingPayment = await sql`
          SELECT id FROM payments
          WHERE stripe_payment_intent_id = ${paymentIntentId}
          LIMIT 1
        `;

        if (existingPayment.length === 0) {
          await sql`
            INSERT INTO payments (
              order_id, user_id, stripe_payment_intent_id,
              amount, currency, status, payment_method
            ) VALUES (
              ${orderId}, ${userId},
              ${paymentIntentId},
              ${session.amount_total ?? 0}, ${session.currency ?? 'usd'},
              'authorized', 'card'
            )
          `;
        }

        console.log(`[WEBHOOK] Order ${orderId} confirmed.`);
        break;
      }

      // ── PAYMENT FAILED ─────────────────────────────────────
      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id;
        if (!orderId) {
          console.error('[WEBHOOK] Missing order metadata on checkout.session.expired');
          break;
        }

        const currentOrder = await sql`
          SELECT id, status FROM orders WHERE id = ${orderId} LIMIT 1
        `;
        if (currentOrder.length === 0) break;

        const currentStatus = (currentOrder[0] as { status: string }).status;
        if (currentStatus !== 'pending') {
          // Do not downgrade confirmed/fulfilled orders.
          break;
        }

        await sql`
          UPDATE orders SET status = 'payment_failed', updated_at = NOW()
          WHERE id = ${orderId}
        `;
        break;
      }

      // ── SUBSCRIPTION CREATED ───────────────────────────────
      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription;
        const customers = await sql`
          SELECT id FROM users WHERE stripe_customer_id = ${sub.customer as string}
        `;
        if (customers.length > 0) {
          const userId = (customers[0] as { id: string }).id;
          await sql`
            INSERT INTO subscriptions (
              user_id, stripe_subscription_id, plan, status,
              current_period_start, current_period_end
            ) VALUES (
              ${userId}, ${sub.id}, 'pro', ${sub.status},
              to_timestamp(${sub.current_period_start}),
              to_timestamp(${sub.current_period_end})
            )
            ON CONFLICT (stripe_subscription_id) DO UPDATE
              SET status = ${sub.status}, updated_at = NOW()
          `;
        }
        break;
      }

      // ── SUBSCRIPTION UPDATED/CANCELLED ────────────────────
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await sql`
          UPDATE subscriptions
          SET status = ${sub.status},
              cancel_at_period_end = ${sub.cancel_at_period_end},
              current_period_end = to_timestamp(${sub.current_period_end}),
              updated_at = NOW()
          WHERE stripe_subscription_id = ${sub.id}
        `;
        break;
      }

      default:
        console.log(`[WEBHOOK] Unhandled event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[WEBHOOK HANDLER ERROR]', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
