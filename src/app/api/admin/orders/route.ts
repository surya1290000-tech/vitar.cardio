import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { getAdminLoginSecret, isAdminRequest } from '@/lib/adminAuth';

const ActionSchema = z.object({
  orderId: z.string().uuid(),
  action: z.enum(['capture', 'ship']),
});

export async function PATCH(req: NextRequest) {
  const adminLoginSecret = getAdminLoginSecret();
  if (!adminLoginSecret) {
    return NextResponse.json({ error: 'Admin key is not configured on server.' }, { status: 500 });
  }

  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = ActionSchema.parse(body);

    const orderRows = await sql`
      SELECT id, status
      FROM orders
      WHERE id = ${data.orderId}
      LIMIT 1
    `;
    if (orderRows.length === 0) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const paymentRows = await sql`
      SELECT id, stripe_payment_intent_id, status
      FROM payments
      WHERE order_id = ${data.orderId}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (paymentRows.length === 0) {
      return NextResponse.json({ error: 'No payment found for this order.' }, { status: 400 });
    }

    const payment = paymentRows[0] as { id: string; stripe_payment_intent_id: string | null; status: string };

    if (data.action === 'capture') {
      if (!payment.stripe_payment_intent_id) {
        return NextResponse.json({ error: 'Missing Stripe payment intent for this order.' }, { status: 400 });
      }
      if (payment.status !== 'authorized') {
        return NextResponse.json({ error: 'Only authorized payments can be captured.' }, { status: 400 });
      }

      await stripe.paymentIntents.capture(payment.stripe_payment_intent_id);

      await sql`
        UPDATE payments
        SET status = 'captured'
        WHERE id = ${payment.id}
      `;
      await sql`
        UPDATE orders
        SET status = 'payment_captured', updated_at = NOW()
        WHERE id = ${data.orderId}
      `;

      return NextResponse.json({ success: true, message: 'Payment captured successfully.' });
    }

    if (!['captured', 'succeeded', 'paid'].includes(payment.status)) {
      return NextResponse.json({ error: 'Order must have a captured payment before shipping.' }, { status: 400 });
    }

    await sql`
      UPDATE orders
      SET status = 'fulfilled', updated_at = NOW()
      WHERE id = ${data.orderId}
    `;

    return NextResponse.json({ success: true, message: 'Order marked as shipped.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('[ADMIN ORDER ACTION ERROR]', error);
    return NextResponse.json({ error: 'Failed to process order action.' }, { status: 500 });
  }
}
