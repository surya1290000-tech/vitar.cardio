import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getAdminLoginSecret, isAdminRequest } from '@/lib/adminAuth';

export async function GET(req: NextRequest) {
  const adminLoginSecret = getAdminLoginSecret();
  if (!adminLoginSecret) {
    return NextResponse.json({ error: 'Admin key is not configured on server.' }, { status: 500 });
  }

  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const users = await sql`
      SELECT id, email, first_name, last_name, is_verified, role, created_at
      FROM users 
      ORDER BY created_at DESC
    `;
    let orders: any[] = [];
    let payments: any[] = [];
    let alerts: any[] = [];
    let adminAuthLogs: any[] = [];
    let confirmedWithoutPayment = 0;
    let orphanPayments = 0;
    let capturedPayments = 0;
    let pendingCapturePayments = 0;
    let payoutReadyPayments = 0;

    // Keep admin users view working even if orders table/query has issues.
    try {
      orders = await sql`
        SELECT 
          o.id, o.order_number, o.device_model, 
          o.status, o.total, o.created_at,
          u.email, u.first_name, u.last_name,
          lp.status AS payment_status
        FROM orders o
        JOIN users u ON o.user_id = u.id
        LEFT JOIN LATERAL (
          SELECT p.status
          FROM payments p
          WHERE p.order_id = o.id
          ORDER BY p.created_at DESC
          LIMIT 1
        ) lp ON true
        ORDER BY o.created_at DESC
      `;
    } catch (orderError) {
      console.error('[ADMIN ORDERS QUERY ERROR]', orderError);
    }

    // Recent payments for ops visibility
    try {
      payments = await sql`
        SELECT
          p.id, p.order_id, p.user_id, p.stripe_payment_intent_id,
          p.amount, p.currency, p.status, p.payment_method, p.created_at,
          CASE
            WHEN p.status IN ('captured', 'succeeded', 'paid') THEN true
            ELSE false
          END AS payout_ready
        FROM payments p
        ORDER BY p.created_at DESC
        LIMIT 100
      `;
    } catch (paymentError) {
      console.error('[ADMIN PAYMENTS QUERY ERROR]', paymentError);
    }

    // Recent alerts for ops visibility
    try {
      alerts = await sql`
        SELECT
          a.id, a.user_id, a.device_id, a.alert_type, a.severity, a.status,
          a.created_at, a.resolved_at
        FROM alerts a
        ORDER BY a.created_at DESC
        LIMIT 100
      `;
    } catch (alertError) {
      console.error('[ADMIN ALERTS QUERY ERROR]', alertError);
    }

    // Recent admin auth/security events
    try {
      adminAuthLogs = await sql`
        SELECT id, action, ip_address, user_agent, details, created_at
        FROM admin_auth_log
        ORDER BY created_at DESC
        LIMIT 50
      `;
    } catch (authLogError) {
      console.error('[ADMIN AUTH LOG QUERY ERROR]', authLogError);
    }

    // Reconciliation: confirmed orders with no payment rows
    try {
      const missingPayments = await sql`
        SELECT COUNT(*)::int AS count
        FROM orders o
        LEFT JOIN payments p ON p.order_id = o.id
        WHERE o.status = 'confirmed' AND p.id IS NULL
      `;
      confirmedWithoutPayment = (missingPayments[0] as any)?.count ?? 0;
    } catch (reconError) {
      console.error('[ADMIN RECON MISSING PAYMENTS ERROR]', reconError);
    }

    // Reconciliation: payments whose order is missing
    try {
      const missingOrders = await sql`
        SELECT COUNT(*)::int AS count
        FROM payments p
        LEFT JOIN orders o ON o.id = p.order_id
        WHERE p.order_id IS NOT NULL AND o.id IS NULL
      `;
      orphanPayments = (missingOrders[0] as any)?.count ?? 0;
    } catch (reconError) {
      console.error('[ADMIN RECON ORPHAN PAYMENTS ERROR]', reconError);
    }

    try {
      const paymentStateCounts = await sql`
        SELECT
          COUNT(*) FILTER (WHERE status IN ('captured', 'succeeded', 'paid'))::int AS captured,
          COUNT(*) FILTER (WHERE status = 'authorized')::int AS pending_capture
        FROM payments
      `;
      capturedPayments = (paymentStateCounts[0] as any)?.captured ?? 0;
      pendingCapturePayments = (paymentStateCounts[0] as any)?.pending_capture ?? 0;
      payoutReadyPayments = capturedPayments;
    } catch (paymentCountError) {
      console.error('[ADMIN PAYMENT STATE COUNT ERROR]', paymentCountError);
    }

    const totalUsers = users.length;
    const verifiedUsers = users.filter((u: any) => u.is_verified).length;
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
    const totalPayments = payments.length;
    const totalAlerts = alerts.length;
    const criticalAlerts = alerts.filter((a: any) => a.severity === 'critical').length;

    return NextResponse.json({
      users,
      orders,
      payments,
      alerts,
      adminAuthLogs,
      stats: {
        totalUsers,
        verifiedUsers,
        totalOrders,
        totalRevenue,
        totalPayments,
        totalAlerts,
        criticalAlerts,
        confirmedWithoutPayment,
        orphanPayments,
        capturedPayments,
        pendingCapturePayments,
        payoutReadyPayments,
      },
      reconciliation: {
        confirmedWithoutPayment,
        orphanPayments,
      },
    });

  } catch (error) {
    console.error('[ADMIN DATA ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
