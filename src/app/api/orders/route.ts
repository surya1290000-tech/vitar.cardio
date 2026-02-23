import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { stripe, DEVICE_PRICES, DeviceModel } from '@/lib/stripe';
import { withAuth, AuthedRequest } from '@/lib/authMiddleware';
import { sendOrderConfirmationEmail } from '@/lib/email';

const OrderSchema = z.object({
  deviceModel:               z.enum(['core', 'pro', 'elite']),
  firstName:                 z.string().min(1),
  lastName:                  z.string().min(1),
  email:                     z.string().email(),
  medicalDisclaimerAccepted: z.boolean(),
});

// GET — list current user's orders
export const GET = withAuth(async (req: AuthedRequest) => {
  const orders = await sql`
    SELECT id, order_number, device_model, status, total, currency, created_at, stripe_session_id
    FROM orders WHERE user_id = ${req.user.sub}
    ORDER BY created_at DESC
  `;
  return NextResponse.json({ orders });
});

// POST — create a new pre-order + Stripe checkout session
export const POST = withAuth(async (req: AuthedRequest) => {
  try {
    const body = await req.json();
    const data = OrderSchema.parse(body);

    if (!data.medicalDisclaimerAccepted) {
      return NextResponse.json(
        { error: 'You must accept the medical disclaimer to continue.' },
        { status: 400 }
      );
    }

    const amount = DEVICE_PRICES[data.deviceModel as DeviceModel];
    const orderNumber = 'VTR-' + Date.now();

    // Insert order as pending
    const orders = await sql`
      INSERT INTO orders (
        user_id, order_number, device_model, status,
        subtotal, total, currency, medical_disclaimer_accepted
      ) VALUES (
        ${req.user.sub}, ${orderNumber}, ${data.deviceModel}, 'pending',
        ${amount}, ${amount}, 'usd', true
      ) RETURNING id
    `;
    const orderId = (orders[0] as { id: string }).id;

    // Get or create Stripe customer
    const users = await sql`
      SELECT stripe_customer_id, email, first_name FROM users WHERE id = ${req.user.sub}
    `;
    const user = users[0] as { stripe_customer_id: string | null; email: string; first_name: string };

    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${data.firstName} ${data.lastName}`,
        metadata: { vitar_user_id: req.user.sub },
      });
      customerId = customer.id;
      await sql`UPDATE users SET stripe_customer_id = ${customerId} WHERE id = ${req.user.sub}`;
    }

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `VITAR ${data.deviceModel.charAt(0).toUpperCase() + data.deviceModel.slice(1)} Device`,
            description: 'Medical-grade cardiac monitoring wearable. Pre-order — charged at shipping.',
          },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      payment_intent_data: { capture_method: 'manual' }, // hold, charge at ship
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/order/cancelled`,
      metadata: { order_id: orderId, user_id: req.user.sub },
    });

    // Save Stripe session ID on order
    await sql`UPDATE orders SET stripe_session_id = ${session.id} WHERE id = ${orderId}`;

    // Send confirmation email
    await sendOrderConfirmationEmail(
      data.email, data.firstName, orderNumber,
      `VITAR ${data.deviceModel}`, amount
    );

    return NextResponse.json({
      success: true,
      orderId,
      orderNumber,
      checkoutUrl: session.url,
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('[ORDER CREATE ERROR]', error);
    return NextResponse.json({ error: 'Failed to create order.' }, { status: 500 });
  }
});
