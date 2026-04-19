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
    let supportTickets: any[] = [];
    let adminAuthLogs: any[] = [];
    let confirmedWithoutPayment = 0;
    let orphanPayments = 0;
    let capturedPayments = 0;
    let pendingCapturePayments = 0;
    let payoutReadyPayments = 0;
    let totalSupportTickets = 0;
    let openSupportTickets = 0;
    let inProgressSupportTickets = 0;
    let urgentSupportTickets = 0;
    let activeAutomationWorkflows = 0;
    let automationRuns24h = 0;
    let urgentAutomationRuns24h = 0;
    let assistantTotalChats = 0;
    let assistantFallbackRate = 0;
    let assistantEscalationRate = 0;
    let assistantAvgLatencyMs = 0;
    let assistantTopIntents: Array<{ intent: string; count: number }> = [];
    let assistantEvents: any[] = [];

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

    // Recent support tickets for operations visibility
    try {
      supportTickets = await sql`
        SELECT
          t.id, t.user_id, u.email, u.first_name, u.last_name,
          t.subject, t.category, t.priority, t.status, t.created_at, t.updated_at
        FROM support_tickets t
        JOIN users u ON u.id = t.user_id
        ORDER BY t.updated_at DESC
        LIMIT 100
      `;
    } catch (supportError) {
      console.error('[ADMIN SUPPORT TICKETS QUERY ERROR]', supportError);
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

    try {
      const supportCounts = await sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'open')::int AS open_count,
          COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress_count,
          COUNT(*) FILTER (WHERE priority = 'urgent')::int AS urgent_count
        FROM support_tickets
      `;
      totalSupportTickets = (supportCounts[0] as any)?.total ?? 0;
      openSupportTickets = (supportCounts[0] as any)?.open_count ?? 0;
      inProgressSupportTickets = (supportCounts[0] as any)?.in_progress_count ?? 0;
      urgentSupportTickets = (supportCounts[0] as any)?.urgent_count ?? 0;
    } catch (supportCountError) {
      console.error('[ADMIN SUPPORT COUNT ERROR]', supportCountError);
    }

    try {
      const workflowCounts = await sql`
        SELECT
          COUNT(*) FILTER (WHERE is_enabled = true)::int AS active_workflows
        FROM ai_workflows
      `;
      activeAutomationWorkflows = (workflowCounts[0] as any)?.active_workflows ?? 0;
    } catch (workflowCountError) {
      console.error('[ADMIN AUTOMATION WORKFLOW COUNT ERROR]', workflowCountError);
    }

    try {
      const recentAutomation = await sql`
        SELECT
          COUNT(*)::int AS runs_24h,
          COUNT(*) FILTER (WHERE severity IN ('urgent', 'critical'))::int AS urgent_runs_24h
        FROM automation_logs
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `;
      automationRuns24h = (recentAutomation[0] as any)?.runs_24h ?? 0;
      urgentAutomationRuns24h = (recentAutomation[0] as any)?.urgent_runs_24h ?? 0;
    } catch (automationCountError) {
      console.error('[ADMIN AUTOMATION LOG COUNT ERROR]', automationCountError);
    }

    try {
      const assistantCounts = await sql`
        SELECT
          COUNT(*)::int AS total_chats,
          COUNT(*) FILTER (WHERE response_source = 'fallback')::int AS fallback_chats,
          COUNT(*) FILTER (WHERE severity IN ('urgent', 'high'))::int AS escalated_chats,
          COALESCE(AVG(latency_ms), 0)::float AS avg_latency_ms
        FROM health_assistant_events
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `;
      assistantTotalChats = (assistantCounts[0] as any)?.total_chats ?? 0;
      const fallbackChats = (assistantCounts[0] as any)?.fallback_chats ?? 0;
      const escalatedChats = (assistantCounts[0] as any)?.escalated_chats ?? 0;
      assistantAvgLatencyMs = Math.round((assistantCounts[0] as any)?.avg_latency_ms ?? 0);
      assistantFallbackRate = assistantTotalChats > 0 ? Number(((fallbackChats / assistantTotalChats) * 100).toFixed(1)) : 0;
      assistantEscalationRate = assistantTotalChats > 0 ? Number(((escalatedChats / assistantTotalChats) * 100).toFixed(1)) : 0;
    } catch (assistantCountError) {
      console.error('[ADMIN ASSISTANT COUNT ERROR]', assistantCountError);
    }

    try {
      const topIntents = await sql`
        SELECT intent, COUNT(*)::int AS count
        FROM health_assistant_events
        WHERE created_at >= NOW() - INTERVAL '30 days'
          AND intent IS NOT NULL
          AND intent <> ''
        GROUP BY intent
        ORDER BY count DESC
        LIMIT 5
      `;
      assistantTopIntents = topIntents.map((row: any) => ({
        intent: row.intent,
        count: row.count,
      }));
    } catch (assistantIntentError) {
      console.error('[ADMIN ASSISTANT INTENT ERROR]', assistantIntentError);
    }

    try {
      assistantEvents = await sql`
        SELECT
          id, trace_id, intent, severity, safety_flags, response_source, model, confidence,
          confidence_reason, latency_ms, status, error, created_at
        FROM health_assistant_events
        ORDER BY created_at DESC
        LIMIT 40
      `;
    } catch (assistantEventsError) {
      console.error('[ADMIN ASSISTANT EVENTS ERROR]', assistantEventsError);
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
      supportTickets,
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
        totalSupportTickets,
        openSupportTickets,
        inProgressSupportTickets,
        urgentSupportTickets,
        activeAutomationWorkflows,
        automationRuns24h,
        urgentAutomationRuns24h,
        assistantTotalChats,
        assistantFallbackRate,
        assistantEscalationRate,
        assistantAvgLatencyMs,
        assistantTopIntents,
      },
      assistantEvents,
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
