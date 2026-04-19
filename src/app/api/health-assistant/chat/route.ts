import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { withAuth, AuthedRequest } from '@/lib/authMiddleware';
import { runAssistantUrgentTriage } from '@/lib/automationWorkflows';
import { generateAssistantBrainReply } from '@/lib/assistantBrain';
import { randomUUID } from 'crypto';
import { loadTrainingNotesForMode } from '@/lib/assistantTraining';

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(40),
  threadId: z.string().uuid().optional(),
});

const PostSchema = z.object({
  message: z.string().min(2).max(3000),
  threadId: z.string().uuid().optional(),
});

type AssistantMode = 'urgent_triage' | 'health_guidance' | 'device_support' | 'billing_support' | 'care_planning';
type AssistantSeverity = 'normal' | 'high' | 'urgent';
type AssistantActionType = 'open_dashboard' | 'open_care_center' | 'create_support_ticket' | 'summarize_readings';

type AssistantSection = {
  label: string;
  content: string;
};

type AssistantContext = {
  userFirstName: string | null;
  latestReading: {
    heartRate: number | null;
    spo2: number | null;
    riskPercent: number | null;
    recordedAt: string | null;
  } | null;
  recentReadings: Array<{
    heartRate: number | null;
    spo2: number | null;
    riskPercent: number | null;
    recordedAt: string | null;
  }>;
  medicalProfile: {
    bloodType: string | null;
    conditions: string[];
    medications: string[];
    allergies: string[];
    restingHeartRate: number | null;
    physicianName: string | null;
  } | null;
  device: {
    model: string | null;
    status: string | null;
    batteryLevel: number | null;
    lastSync: string | null;
  } | null;
  openSupportTickets: number;
  billing: {
    latestOrderNumber: string | null;
    latestOrderStatus: string | null;
    latestOrderTotal: number | null;
    latestOrderCreatedAt: string | null;
    subscriptionPlan: string | null;
    subscriptionStatus: string | null;
    paymentIssueStatus: string | null;
    paymentIssueAmount: number | null;
    paymentIssueCreatedAt: string | null;
  };
  recentConversation: Array<{
    role: 'user' | 'assistant';
    message: string;
    mode: AssistantMode | null;
    title: string | null;
    createdAt: string | null;
  }>;
};

type AssistantReplyPayload = {
  severity: AssistantSeverity;
  mode: AssistantMode;
  message: string;
  title: string;
  summary: string;
  sections: AssistantSection[];
  nextSteps: string[];
  actions: Array<{
    type: AssistantActionType;
    label: string;
    payload?: Record<string, unknown>;
  }>;
};

function buildUrgentEscalationSummary(message: string, context: AssistantContext) {
  const snapshotLine = buildSnapshotLine(context);
  const profileLine = buildProfileLine(context);
  const deviceLine = buildDeviceLine(context);
  const conversationSummary = summarizeConversationForSupport(context);

  return [
    'Assistant urgent escalation created from care guidance.',
    `Reported concern: ${message.trim()}`,
    `Conversation summary: ${conversationSummary}`,
    snapshotLine,
    profileLine,
    deviceLine,
    'Assistant recommendation: treat this as a time-sensitive medical concern and review immediately.',
  ].join(' ');
}

function summarizeConversationForSupport(context: AssistantContext) {
  const recentUserMessages = context.recentConversation
    .filter((entry) => entry.role === 'user')
    .slice(-3)
    .map((entry) => entry.message.trim())
    .filter(Boolean);

  if (!recentUserMessages.length) {
    return 'The user escalated directly from the assistant without a longer prior conversation.';
  }

  return recentUserMessages
    .map((message, index) => `${index + 1}. ${message.length > 180 ? `${message.slice(0, 177)}...` : message}`)
    .join(' ');
}

function buildSupportHandoffSummary(context: AssistantContext, focus: string, likelyCause?: string) {
  const snapshotLine = buildSnapshotLine(context);
  const deviceLine = buildDeviceLine(context);
  const conversationSummary = summarizeConversationForSupport(context);
  const parts = [
    `Assistant handoff focus: ${focus}.`,
    `Conversation summary: ${conversationSummary}`,
    snapshotLine,
  ];

  if (context.device) {
    parts.push(deviceLine);
  }

  if (likelyCause) {
    parts.push(`Assistant impression: ${likelyCause}`);
  }

  return parts.join(' ');
}

function formatRiskPercent(raw: number | null): number | null {
  if (raw == null) return null;
  if (raw <= 1) return Number((raw * 100).toFixed(1));
  return Number(raw.toFixed(1));
}

function formatTimeAgo(raw: string | null): string | null {
  if (!raw) return null;
  const diffMs = Date.now() - new Date(raw).getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

function listToText(items: string[], fallback: string) {
  if (!items.length) return fallback;
  return items.slice(0, 3).join(', ');
}

function detectAssistantMode(message: string, context?: AssistantContext): AssistantMode {
  const content = message.toLowerCase();

  if (/(chest pain|fainted|faint|unconscious|can't breathe|cant breathe|shortness of breath|oxygen low|spo2 low)/.test(content)) {
    return 'urgent_triage';
  }
  if (/(device|battery|pair|pairing|bluetooth|sync|firmware|offline|wearable|sensor)/.test(content)) {
    return 'device_support';
  }
  if (/(billing|refund|payment|charge|subscription|order|invoice|card)/.test(content)) {
    return 'billing_support';
  }
  if (/(routine|plan|exercise|sleep|stress|diet|today|checklist)/.test(content)) {
    return 'care_planning';
  }

  const followUpTone = /(still|same|again|that|this|it|continue|now what|what next|next|and now|help me|not working yet)/.test(content) || content.split(/\s+/).length <= 6;
  if (context?.recentConversation?.length && followUpTone) {
    const lastAssistantMode = [...context.recentConversation]
      .reverse()
      .find((entry) => entry.role === 'assistant' && entry.mode)?.mode;
    if (lastAssistantMode) {
      return lastAssistantMode;
    }
  }

  return 'health_guidance';
}

function buildConversationMemoryLine(context: AssistantContext) {
  const recentUserMessages = context.recentConversation
    .filter((entry) => entry.role === 'user')
    .slice(-3)
    .map((entry) => entry.message.trim())
    .filter(Boolean);

  const lastAssistantMode = [...context.recentConversation]
    .reverse()
    .find((entry) => entry.role === 'assistant' && entry.mode)?.mode;

  if (!recentUserMessages.length && !lastAssistantMode) return null;

  const recentTopic = recentUserMessages.length
    ? `Recent user context: ${recentUserMessages
        .map((message) => (message.length > 90 ? `${message.slice(0, 87)}...` : message))
        .join(' | ')}.`
    : '';

  const modeLine = lastAssistantMode
    ? `We were already in ${lastAssistantMode.replace(/_/g, ' ')} mode.`
    : '';

  return `${modeLine} ${recentTopic}`.trim();
}

function buildSnapshotLine(context: AssistantContext) {
  const reading = context.latestReading;
  if (!reading) return 'I do not see a recent wearable snapshot yet.';

  const parts: string[] = [];
  if (reading.heartRate != null) parts.push(`heart rate ${reading.heartRate} bpm`);
  if (reading.spo2 != null) parts.push(`SpO2 ${reading.spo2}%`);
  if (reading.riskPercent != null) parts.push(`risk ${reading.riskPercent}%`);
  const timeLine = formatTimeAgo(reading.recordedAt);
  return `Latest snapshot${timeLine ? ` (${timeLine})` : ''}: ${parts.join(', ')}.`;
}

function average(values: Array<number | null>) {
  const filtered = values.filter((value): value is number => typeof value === 'number');
  if (!filtered.length) return null;
  return Number((filtered.reduce((sum, value) => sum + value, 0) / filtered.length).toFixed(1));
}

function summarizeReadingTrend(context: AssistantContext) {
  const readings = context.recentReadings;
  if (!readings.length) {
    return {
      title: 'No recent trend data yet',
      summary: 'I only have limited wearable history right now.',
      sections: [
        {
          label: 'Available data',
          content: buildSnapshotLine(context),
        },
        {
          label: 'Best next step',
          content: 'Keep the device synced for a few more readings so I can compare patterns instead of only a single snapshot.',
        },
      ] as AssistantSection[],
      nextSteps: [
        'Keep your wearable paired and synced.',
        'Check again after more readings are recorded.',
        'Use the dashboard for the latest single-reading view.',
      ],
    };
  }

  const latest = readings[0];
  const earliest = readings[readings.length - 1];
  const avgHeartRate = average(readings.map((reading) => reading.heartRate));
  const avgSpo2 = average(readings.map((reading) => reading.spo2));
  const avgRisk = average(readings.map((reading) => reading.riskPercent));
  const highRiskCount = readings.filter((reading) => (reading.riskPercent ?? 0) >= 70).length;
  const lowSpo2Count = readings.filter((reading) => typeof reading.spo2 === 'number' && reading.spo2 < 94).length;
  const hrDirection =
    latest.heartRate != null && earliest.heartRate != null
      ? latest.heartRate > earliest.heartRate + 6
        ? 'trending slightly higher'
        : latest.heartRate < earliest.heartRate - 6
          ? 'trending lower'
          : 'holding fairly steady'
      : 'not clear yet';

  const spo2Direction =
    latest.spo2 != null && earliest.spo2 != null
      ? latest.spo2 < earliest.spo2 - 1
        ? 'slipping a little lower'
        : latest.spo2 > earliest.spo2 + 1
          ? 'improving slightly'
          : 'staying stable'
      : 'not clear yet';

  const caution =
    highRiskCount > 0 || lowSpo2Count > 0 || (avgRisk != null && avgRisk >= 65)
      ? 'There are enough elevated signals here to justify a more careful day and closer symptom monitoring.'
      : 'The trend looks relatively steady overall, without a strong sign of sudden deterioration in this window.';

  return {
    title: 'Recent reading summary',
    summary: `I reviewed ${readings.length} recent reading${readings.length === 1 ? '' : 's'} to summarize the short-term pattern.`,
    sections: [
      {
        label: 'Short-term pattern',
        content: `Heart rate is ${hrDirection}${avgHeartRate != null ? ` with an average around ${avgHeartRate} bpm` : ''}. SpO2 is ${spo2Direction}${avgSpo2 != null ? ` with an average around ${avgSpo2}%` : ''}.`,
      },
      {
        label: 'Risk view',
        content: avgRisk != null
          ? `Average AI risk is about ${avgRisk}%. ${highRiskCount > 0 ? `${highRiskCount} reading${highRiskCount === 1 ? '' : 's'} crossed a higher-risk range.` : 'No readings crossed the higher-risk range in this short window.'}`
          : 'I do not have enough AI risk data yet to describe the recent trend clearly.',
      },
      {
        label: 'What this means',
        content: `${caution}${lowSpo2Count > 0 ? ` I also saw ${lowSpo2Count} lower-SpO2 reading${lowSpo2Count === 1 ? '' : 's'} below 94%.` : ''}`,
      },
    ] as AssistantSection[],
    nextSteps:
      highRiskCount > 0 || lowSpo2Count > 0 || (avgRisk != null && avgRisk >= 65)
        ? [
            'Keep activity lighter until the pattern settles.',
            'Recheck symptoms and readings later today.',
            'Use the care center if symptoms rise or readings stay elevated.',
          ]
        : [
            'Continue normal monitoring and hydration.',
            'Check the dashboard if you want the exact latest numbers.',
            'Tell me if you want a symptom-based interpretation next.',
          ],
  };
}

function buildProfileLine(context: AssistantContext) {
  if (!context.medicalProfile) return 'I do not have a completed medical profile yet.';

  const profile = context.medicalProfile;
  const conditions = listToText(profile.conditions, 'no conditions recorded');
  const medications = listToText(profile.medications, 'no medications recorded');
  const allergies = listToText(profile.allergies, 'no allergies recorded');

  return `Profile context: conditions ${conditions}; medications ${medications}; allergies ${allergies}${profile.restingHeartRate ? `; resting heart rate ${profile.restingHeartRate} bpm` : ''}.`;
}

function buildDeviceLine(context: AssistantContext) {
  if (!context.device) return 'I do not see a paired device right now.';
  const lastSync = formatTimeAgo(context.device.lastSync);
  return `Primary device: ${context.device.model ?? 'VITAR device'} is ${context.device.status ?? 'unknown'}${context.device.batteryLevel != null ? ` with ${context.device.batteryLevel}% battery` : ''}${lastSync ? `, last sync ${lastSync}` : ''}.`;
}

function buildDeviceSupportPlan(message: string, context: AssistantContext) {
  const content = message.toLowerCase();
  const device = context.device;
  const isSyncIssue = /(sync|not syncing|data not updating|update|upload)/.test(content);
  const isPairingIssue = /(pair|pairing|bluetooth|connect|connection)/.test(content);
  const isBatteryIssue = /(battery|charging|charge|power|drain)/.test(content);
  const isOfflineIssue = /(offline|not online|disconnected|device unavailable)/.test(content);

  const detectedFocus =
    isBatteryIssue ? 'battery and power' :
    isPairingIssue ? 'pairing and connection' :
    isOfflineIssue ? 'device connectivity' :
    isSyncIssue ? 'sync and upload' :
    'general device troubleshooting';

  const likelyCause = !device
    ? 'I do not see a paired device in your account context, so the issue may be pairing-related or the device has not synced yet.'
    : device.batteryLevel != null && device.batteryLevel <= 20
      ? `Battery is low at ${device.batteryLevel}%, which is a common reason for delayed sync and sensor interruptions.`
      : device.status && !['active', 'online', 'connected'].includes(device.status.toLowerCase())
        ? `The device is currently marked ${device.status}, so I would treat connection state as the first thing to fix.`
        : isPairingIssue
          ? 'This reads like a pairing or Bluetooth handshake issue rather than a sensor failure.'
          : isSyncIssue
            ? 'This looks more like a sync pipeline issue than a total device failure.'
            : 'The device status does not show an obvious hard failure, so a clean reconnect is the best first move.';

  const troubleshootingSteps = [
    device?.batteryLevel != null && device.batteryLevel <= 20
      ? 'Charge the wearable above 30% before retrying the connection.'
      : 'Keep the wearable nearby and make sure it is awake before retrying.',
    isPairingIssue
      ? 'Turn Bluetooth off and back on, reopen the app, and retry pairing from the dashboard device screen.'
      : 'Open the dashboard and wait for a fresh device refresh before changing any settings.',
    isSyncIssue || isOfflineIssue
      ? 'If the device stays offline or data does not upload after one retry, create a support ticket with the current device status.'
      : 'If readings still do not appear after one clean retry, create a support ticket so support can inspect the device state.',
  ];

  const escalationNote = context.openSupportTickets > 0
    ? 'Because you already have an open support thread, it is better to update that conversation unless the device problem is new or clearly different.'
    : 'If the next retry does not work, the cleanest next step is to create a device support ticket with the current status attached.';

  return {
    detectedFocus,
    likelyCause,
    troubleshootingSteps,
    escalationNote,
  };
}

function formatCurrencyCents(cents: number | null) {
  if (typeof cents !== 'number') return null;
  return `USD ${(cents / 100).toFixed(2)}`;
}

function buildBillingLine(context: AssistantContext) {
  const orderTime = formatTimeAgo(context.billing.latestOrderCreatedAt);
  const paymentIssueTime = formatTimeAgo(context.billing.paymentIssueCreatedAt);

  const orderLine = context.billing.latestOrderNumber
    ? `Latest order ${context.billing.latestOrderNumber} is ${context.billing.latestOrderStatus ?? 'unknown'}${context.billing.latestOrderTotal != null ? ` (${formatCurrencyCents(context.billing.latestOrderTotal)})` : ''}${orderTime ? `, created ${orderTime}` : ''}.`
    : 'I do not see a recent order on your account.';

  const subscriptionLine = context.billing.subscriptionPlan
    ? `Subscription: ${context.billing.subscriptionPlan} (${context.billing.subscriptionStatus ?? 'unknown status'}).`
    : 'No active subscription is visible right now.';

  const paymentIssueLine = context.billing.paymentIssueStatus
    ? `Recent payment issue: ${context.billing.paymentIssueStatus}${context.billing.paymentIssueAmount != null ? ` for ${formatCurrencyCents(context.billing.paymentIssueAmount)}` : ''}${paymentIssueTime ? `, recorded ${paymentIssueTime}` : ''}.`
    : 'No recent failed payment is visible.';

  return `${orderLine} ${subscriptionLine} ${paymentIssueLine}`;
}

function buildBillingSupportPlan(message: string, context: AssistantContext) {
  const content = message.toLowerCase();
  const isRefund = /(refund|return|cancel order|money back)/.test(content);
  const isSubscription = /(subscription|renew|cancel plan|plan|billing cycle)/.test(content);
  const isPaymentFailure = /(failed|declined|card|charge failed|payment failed|unable to pay)/.test(content);
  const isOrderStatus = /(order|shipment|shipping|delivery|track)/.test(content);

  const focus = isRefund
    ? 'refund handling'
    : isPaymentFailure
      ? 'payment failure resolution'
      : isSubscription
        ? 'subscription management'
        : isOrderStatus
          ? 'order and shipping status'
          : 'general billing support';

  const likelyCause = context.billing.paymentIssueStatus
    ? `There is a recent payment status of ${context.billing.paymentIssueStatus}, so this likely needs account-level billing review.`
    : isSubscription
      ? 'This looks like a subscription lifecycle question rather than a payment processor failure.'
      : isRefund
        ? 'This looks like a post-purchase refund workflow request.'
        : 'This looks like a billing account review request.';

  const steps = [
    isPaymentFailure
      ? 'Confirm the payment method is valid and retry once from dashboard billing.'
      : 'Confirm the exact order or subscription reference so support can act without back-and-forth.',
    isRefund
      ? 'Share whether the request is pre-shipment cancellation or post-delivery refund.'
      : isSubscription
        ? 'Specify whether you want to upgrade, downgrade, pause, or cancel at period end.'
        : 'Share the exact billing concern: payment, invoice, refund, or order status.',
    context.openSupportTickets > 0
      ? 'Because you already have an open ticket, update that thread unless this billing issue is new.'
      : 'If account action is needed, create a billing support ticket so finance and support can verify directly.',
  ];

  return {
    focus,
    likelyCause,
    steps,
  };
}

function buildAssistantReply(message: string, context: AssistantContext): AssistantReplyPayload {
  const mode = detectAssistantMode(message, context);
  const content = message.toLowerCase();
  const greeting = context.userFirstName ? `${context.userFirstName}, ` : '';
  const snapshotLine = buildSnapshotLine(context);
  const profileLine = buildProfileLine(context);
  const deviceLine = buildDeviceLine(context);
  const memoryLine = buildConversationMemoryLine(context);
  const openTicketLine =
    context.openSupportTickets > 0
      ? `There ${context.openSupportTickets === 1 ? 'is' : 'are'} already ${context.openSupportTickets} open support ticket${context.openSupportTickets === 1 ? '' : 's'} on your account.`
      : 'There are no open support tickets on your account right now.';

  if (mode === 'urgent_triage') {
    const urgentSupportHandoff = buildUrgentEscalationSummary(message, context);
    return {
      severity: 'urgent',
      mode,
      title: 'Urgent care guidance',
      summary: 'The assistant detected emergency-style symptom language and elevated the response.',
      sections: [
        {
          label: "What I'm noticing",
          content: `${snapshotLine} Your message includes symptoms that can signal an emergency, so I am treating this as urgent.`,
        },
        ...(memoryLine
          ? [
              {
                label: 'Conversation memory',
                content: memoryLine,
              },
            ]
          : []),
        {
          label: 'What to do right now',
          content: 'Call local emergency services immediately if symptoms are severe, getting worse, or include fainting, severe chest pain, or trouble breathing.',
        },
        {
          label: 'Escalation readiness',
          content: `${openTicketLine} I can also prepare an urgent care support handoff so your recent conversation, readings, and profile context are not lost.`,
        },
        {
          label: 'What to keep ready',
          content: `${profileLine} If someone is with you, ask them to stay nearby and help share your recent readings and medications with emergency responders.`,
        },
      ],
      nextSteps: [
        'Call local emergency services now if symptoms are severe or worsening.',
        'Do not stay alone while symptoms are active.',
        'Use the care center or emergency contacts immediately after emergency services are contacted.',
      ],
      actions: [
        {
          type: 'create_support_ticket',
          label: 'Create Urgent Care Ticket',
          payload: {
            subject: 'Urgent symptom escalation from assistant',
            category: 'medical',
            priority: 'urgent',
            description: urgentSupportHandoff,
            autoCreate: true,
          },
        },
        { type: 'open_care_center', label: 'Open Care Center' },
        { type: 'open_dashboard', label: 'View Dashboard' },
      ],
      message:
        `${greeting}this sounds urgent. Please get emergency help now if the symptoms are severe, worsening, or include fainting, severe chest pain, or breathing difficulty. ` +
        `I can help summarize your recent readings and profile once immediate help is on the way.`,
    };
  }

  if (mode === 'device_support') {
    const devicePlan = buildDeviceSupportPlan(message, context);
    const supportHandoff = buildSupportHandoffSummary(context, devicePlan.detectedFocus, devicePlan.likelyCause);
    return {
      severity: 'normal',
      mode,
      title: 'Device support guidance',
      summary: `The assistant switched into ${devicePlan.detectedFocus} troubleshooting mode using live device status and account context.`,
      sections: [
        {
          label: 'Device snapshot',
          content: deviceLine,
        },
        ...(memoryLine
          ? [
              {
                label: 'Conversation memory',
                content: memoryLine,
              },
            ]
          : []),
        {
          label: 'Most likely cause',
          content: devicePlan.likelyCause,
        },
        {
          label: 'Try this in order',
          content: devicePlan.troubleshootingSteps.join(' '),
        },
        {
          label: 'Support status',
          content: `${openTicketLine} ${devicePlan.escalationNote}`,
        },
      ],
      nextSteps: devicePlan.troubleshootingSteps,
      actions: [
        {
          type: 'create_support_ticket',
          label: 'Create Device Ticket',
          payload: {
            subject: `Device ${devicePlan.detectedFocus} issue`,
            category: 'device',
            priority: 'high',
            description: supportHandoff,
            autoCreate: true,
          },
        },
        { type: 'open_dashboard', label: 'View Dashboard' },
      ],
      message:
        `${greeting}I am in device support mode. I reviewed the current device status and shaped the checklist around the most likely failure point, so you can try the fastest fix before opening support.`,
    };
  }

  if (mode === 'billing_support') {
    const billingPlan = buildBillingSupportPlan(message, context);
    const supportHandoff = buildSupportHandoffSummary(context, billingPlan.focus, billingPlan.likelyCause);
    const hasPaymentIssue = !!context.billing.paymentIssueStatus;
    return {
      severity: hasPaymentIssue ? 'high' : 'normal',
      mode,
      title: 'Billing and order guidance',
      summary: `The assistant switched into ${billingPlan.focus} mode using recent order and payment context.`,
      sections: [
        {
          label: 'What I can help with',
          content: 'I can guide payment issues, refunds, subscription renewals, and order follow-up.',
        },
        {
          label: 'Billing snapshot',
          content: buildBillingLine(context),
        },
        ...(memoryLine
          ? [
              {
                label: 'Conversation memory',
                content: memoryLine,
              },
            ]
          : []),
        {
          label: 'Most likely cause',
          content: billingPlan.likelyCause,
        },
        {
          label: 'What to gather',
          content: 'Keep the order number, charge date, and last four card digits ready before opening a billing request.',
        },
        {
          label: 'Support status',
          content: openTicketLine,
        },
      ],
      nextSteps: billingPlan.steps,
      actions: [
        {
          type: 'create_support_ticket',
          label: 'Create Billing Ticket',
          payload: {
            subject: `Billing: ${billingPlan.focus}`,
            category: 'billing',
            priority: hasPaymentIssue ? 'high' : 'normal',
            description: supportHandoff,
            autoCreate: true,
          },
        },
        { type: 'open_dashboard', label: 'View Dashboard' },
      ],
      message:
        `${greeting}I can help with payment, order, refund, or subscription questions. I checked your latest billing context and can open a clean support handoff if needed.`,
    };
  }

  if (mode === 'care_planning') {
    return {
      severity: 'normal',
      mode,
      title: 'Daily care planning',
      summary: 'The assistant switched into proactive planning mode using recent readings and profile context.',
      sections: [
        {
          label: 'Today\'s snapshot',
          content: snapshotLine,
        },
        ...(memoryLine
          ? [
              {
                label: 'Conversation memory',
                content: memoryLine,
              },
            ]
          : []),
        {
          label: 'Profile-aware focus',
          content: profileLine,
        },
        {
          label: 'Recommended pacing',
          content: 'Keep the day low-friction: hydration, light movement, and symptom check-ins are more useful today than intense exercise.',
        },
      ],
      nextSteps: [
        'Keep hydration and meals consistent today.',
        'Aim for steady movement instead of intense exertion if symptoms are present.',
        'Track any dizziness, chest discomfort, or unusual fatigue.',
      ],
      actions: [
        { type: 'summarize_readings', label: 'Summarize Readings' },
        { type: 'open_dashboard', label: 'View Dashboard' },
      ],
      message:
        `${greeting}I can help you plan the day in a simple, low-stress way. I’m tailoring this around your recent readings and profile so the routine stays practical, not overwhelming.`,
    };
  }

  const elevatedRisk = context.latestReading?.riskPercent != null && context.latestReading.riskPercent >= 70;
  const wantsReadingSummary = /(summari[sz]e|summary|trend|reading|readings|snapshot|risk score)/.test(content);

  if (wantsReadingSummary) {
    const trendSummary = summarizeReadingTrend(context);
    return {
      severity: elevatedRisk ? 'high' : 'normal',
      mode: 'health_guidance',
      title: trendSummary.title,
      summary: trendSummary.summary,
      sections: trendSummary.sections,
      ...(memoryLine && trendSummary.sections.length < 4
        ? {
            sections: [
              ...trendSummary.sections,
              {
                label: 'Conversation memory',
                content: memoryLine,
              },
            ],
          }
        : {}),
      nextSteps: trendSummary.nextSteps,
      actions: [
        { type: 'open_dashboard', label: 'View Dashboard' },
        { type: 'open_care_center', label: 'Open Care Center' },
      ],
      message:
        `${greeting}I reviewed your recent readings and pulled out the short-term pattern for you. ` +
        `${elevatedRisk ? 'A few signals are elevated, so I am leaning a little more cautious in the summary below.' : 'The summary below focuses on what changed, what stayed stable, and what to watch next.'}`,
    };
  }

  return {
    severity: elevatedRisk ? 'high' : 'normal',
    mode,
    title: 'Personalized health guidance',
    summary: elevatedRisk
      ? 'The assistant found elevated recent risk and responded with higher caution.'
      : 'The assistant provided general health guidance with profile-aware context.',
    sections: [
      {
        label: "What I'm seeing",
        content: snapshotLine,
      },
      ...(memoryLine
        ? [
            {
              label: 'Conversation memory',
              content: memoryLine,
            },
          ]
        : []),
      {
        label: 'Profile context',
        content: profileLine,
      },
      {
        label: elevatedRisk ? 'Why I am being more cautious' : 'Best next move',
        content: elevatedRisk
          ? 'Your recent risk signal is higher than ideal, so it makes sense to keep activity lighter and pay attention to symptom changes.'
          : 'Tell me the exact symptom, how long it has been happening, and whether it changes with activity, rest, or stress.',
      },
    ],
    nextSteps: elevatedRisk
      ? [
          'Limit exertion until symptoms settle.',
          'Monitor for chest pain, faintness, or breathing changes.',
          'Contact a clinician today if readings stay elevated.',
        ]
      : [
          'Tell me your exact symptom or concern.',
          'Share how long it has been happening.',
          'Mention whether it changes with activity, rest, or stress.',
        ],
    actions: [
      { type: 'summarize_readings', label: 'Summarize Readings' },
      { type: 'open_dashboard', label: 'View Dashboard' },
      { type: 'open_care_center', label: 'Open Care Center' },
    ],
    message:
      `${greeting}${elevatedRisk ? 'your recent signals look a bit more elevated than usual, so I want to be more careful.' : 'I can help you interpret what you are feeling and guide the next step clearly.'} ` +
      `Tell me what you are feeling right now, and whether it changes with activity, rest, or stress.`,
  };
}

async function loadAssistantContext(userId: string): Promise<AssistantContext> {
  const [userRows, latestRows, recentRows, profileRows, deviceRows, supportRows, conversationRows, orderRows, subscriptionRows, paymentRows] = await Promise.all([
    sql`
      SELECT first_name
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `,
    sql`
      SELECT heart_rate, spo2, ai_risk_score, recorded_at
      FROM health_readings
      WHERE user_id = ${userId}
      ORDER BY recorded_at DESC
      LIMIT 1
    `,
    sql`
      SELECT heart_rate, spo2, ai_risk_score, recorded_at
      FROM health_readings
      WHERE user_id = ${userId}
        AND recorded_at >= NOW() - INTERVAL '24 hours'
      ORDER BY recorded_at DESC
      LIMIT 12
    `,
    sql`
      SELECT blood_type, allergies, medications, conditions, resting_heart_rate, physician_name
      FROM medical_profiles
      WHERE user_id = ${userId}
      LIMIT 1
    `,
    sql`
      SELECT model, status, battery_level, last_sync
      FROM devices
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    `,
    sql`
      SELECT COUNT(*)::int AS open_count
      FROM support_tickets
      WHERE user_id = ${userId}
        AND status IN ('open', 'in_progress')
    `,
    sql`
      SELECT role, message, context, created_at
      FROM health_assistant_chats
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 8
    `,
    sql`
      SELECT order_number, status, total, created_at
      FROM orders
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 1
    `.catch((error) => (isMissingRelationError(error) ? [] : Promise.reject(error))),
    sql`
      SELECT plan, status, updated_at, created_at
      FROM subscriptions
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    `.catch((error) => (isMissingRelationError(error) ? [] : Promise.reject(error))),
    sql`
      SELECT status, amount, created_at
      FROM payments
      WHERE user_id = ${userId}
        AND status IN ('requires_payment_method', 'requires_action', 'failed', 'canceled')
      ORDER BY created_at DESC
      LIMIT 1
    `.catch((error) => (isMissingRelationError(error) ? [] : Promise.reject(error))),
  ]);

  const latest = latestRows[0] as any;
  const profile = profileRows[0] as any;
  const device = deviceRows[0] as any;
  const user = userRows[0] as any;
  const latestOrder = orderRows[0] as any;
  const latestSubscription = subscriptionRows[0] as any;
  const latestPaymentIssue = paymentRows[0] as any;

  return {
    userFirstName: user?.first_name ?? null,
    latestReading: latest
      ? {
          heartRate: latest.heart_rate ?? null,
          spo2: latest.spo2 ?? null,
          riskPercent: formatRiskPercent(latest.ai_risk_score ?? null),
          recordedAt: latest.recorded_at ?? null,
        }
      : null,
    recentReadings: recentRows.map((row: any) => ({
      heartRate: row.heart_rate ?? null,
      spo2: row.spo2 ?? null,
      riskPercent: formatRiskPercent(row.ai_risk_score ?? null),
      recordedAt: row.recorded_at ?? null,
    })),
    medicalProfile: profile
      ? {
          bloodType: profile.blood_type ?? null,
          conditions: Array.isArray(profile.conditions) ? profile.conditions : [],
          medications: Array.isArray(profile.medications) ? profile.medications : [],
          allergies: Array.isArray(profile.allergies) ? profile.allergies : [],
          restingHeartRate: profile.resting_heart_rate ?? null,
          physicianName: profile.physician_name ?? null,
        }
      : null,
    device: device
      ? {
          model: device.model ?? null,
          status: device.status ?? null,
          batteryLevel: device.battery_level ?? null,
          lastSync: device.last_sync ?? null,
        }
      : null,
    openSupportTickets: (supportRows[0] as any)?.open_count ?? 0,
    billing: {
      latestOrderNumber: latestOrder?.order_number ?? null,
      latestOrderStatus: latestOrder?.status ?? null,
      latestOrderTotal: latestOrder?.total ?? null,
      latestOrderCreatedAt: latestOrder?.created_at ?? null,
      subscriptionPlan: latestSubscription?.plan ?? null,
      subscriptionStatus: latestSubscription?.status ?? null,
      paymentIssueStatus: latestPaymentIssue?.status ?? null,
      paymentIssueAmount: latestPaymentIssue?.amount ?? null,
      paymentIssueCreatedAt: latestPaymentIssue?.created_at ?? null,
    },
    recentConversation: conversationRows
      .slice()
      .reverse()
      .map((row: any) => ({
        role: row.role,
        message: row.message,
        mode: row.context?.mode ?? null,
        title: row.context?.title ?? null,
        createdAt: row.created_at ?? null,
      })),
  };
}

function isMissingRelationError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '42P01';
}

function isMissingColumnError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '42703';
}

function isMissingTableOrColumn(error: unknown): boolean {
  return isMissingRelationError(error) || isMissingColumnError(error);
}

function detectSafetyFlags(message: string): string[] {
  const content = message.toLowerCase();
  const flags: string[] = [];
  if (/(chest pain|severe pain|can't breathe|cant breathe|faint|unconscious|stroke|heart attack|emergency)/.test(content)) {
    flags.push('emergency_language');
  }
  if (/(diagnose|diagnosis|what disease|prescribe|prescription|medicine dose|dosage)/.test(content)) {
    flags.push('diagnosis_or_prescription_request');
  }
  if (/(suicide|self harm|kill myself)/.test(content)) {
    flags.push('mental_health_crisis_language');
  }
  return flags;
}

function appendMedicalGuardrail(
  message: string,
  mode: AssistantMode,
  safetyFlags: string[],
): { message: string; confidenceReasonAddon: string } {
  let guardedMessage = message.trim();
  const addendum: string[] = [];

  if (safetyFlags.includes('diagnosis_or_prescription_request')) {
    guardedMessage += ' I can help with risk-aware guidance, but I cannot diagnose conditions or prescribe medication. For diagnosis or prescriptions, please contact a licensed clinician.';
    addendum.push('Diagnosis/prescription request detected and guarded.');
  }

  if (mode === 'urgent_triage' || safetyFlags.includes('emergency_language')) {
    if (!/emergency services|emergency help|call/i.test(guardedMessage)) {
      guardedMessage += ' If symptoms are severe or worsening, contact local emergency services immediately.';
    }
    addendum.push('Urgent escalation language enforced.');
  }

  if (!addendum.length) {
    addendum.push('Standard safety policy applied.');
  }

  return {
    message: guardedMessage,
    confidenceReasonAddon: addendum.join(' '),
  };
}

function buildAssistantContextDigest(context: AssistantContext): string {
  const parts: string[] = [];
  parts.push(buildSnapshotLine(context));
  parts.push(buildProfileLine(context));
  parts.push(buildDeviceLine(context));
  parts.push(buildBillingLine(context));
  parts.push(`Open support tickets: ${context.openSupportTickets}.`);
  const memoryLine = buildConversationMemoryLine(context);
  if (memoryLine) parts.push(memoryLine);
  return parts.join(' ');
}

function validateAssistantActions(
  actions: AssistantReplyPayload['actions'],
): AssistantReplyPayload['actions'] {
  const allowedTypes: AssistantActionType[] = ['open_dashboard', 'open_care_center', 'create_support_ticket', 'summarize_readings'];
  return actions.filter((action) => allowedTypes.includes(action.type));
}

async function ensureAssistantThread(userId: string, requestedThreadId?: string) {
  if (requestedThreadId) {
    const existing = await sql`
      SELECT id, title
      FROM health_assistant_threads
      WHERE id = ${requestedThreadId}
        AND user_id = ${userId}
      LIMIT 1
    `;
    if (existing[0]) return existing[0] as any;
  }

  const latest = await sql`
    SELECT id, title
    FROM health_assistant_threads
    WHERE user_id = ${userId}
      AND is_archived = false
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  if (latest[0]) return latest[0] as any;

  const created = await sql`
    INSERT INTO health_assistant_threads (user_id, title)
    VALUES (${userId}, 'Primary Care Thread')
    RETURNING id, title
  `;
  return created[0] as any;
}

async function getAssistantTrainingNotes(mode: AssistantMode): Promise<string[]> {
  try {
    return await loadTrainingNotesForMode(mode);
  } catch (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
}

export const GET = withAuth(async (req: AuthedRequest) => {
  try {
    const parsed = QuerySchema.parse({
      limit: req.nextUrl.searchParams.get('limit') ?? undefined,
      threadId: req.nextUrl.searchParams.get('threadId') ?? undefined,
    });

    const thread = await ensureAssistantThread(req.user.sub, parsed.threadId);

    const rows = await sql`
      SELECT id, role, message, context, created_at, trace_id, intent, safety_flags, confidence, confidence_reason
      FROM health_assistant_chats
      WHERE user_id = ${req.user.sub}
        AND thread_id = ${thread.id}
      ORDER BY created_at DESC
      LIMIT ${parsed.limit}
    `;

    return NextResponse.json({
      thread: {
        id: thread.id,
        title: thread.title,
      },
      messages: rows
        .map((r: any) => ({
          id: r.id,
          role: r.role,
          message: r.message,
          createdAt: r.created_at,
          traceId: r.trace_id ?? undefined,
          intent: r.intent ?? undefined,
          safetyFlags: Array.isArray(r.safety_flags) ? r.safety_flags : [],
          confidence: r.confidence != null ? Number(r.confidence) : undefined,
          confidenceReason: r.confidence_reason ?? undefined,
          severity: r.context?.severity ?? undefined,
          mode: r.context?.mode ?? undefined,
          title: r.context?.title ?? undefined,
          summary: r.context?.summary ?? undefined,
          sections: Array.isArray(r.context?.sections) ? r.context.sections : undefined,
          nextSteps: Array.isArray(r.context?.nextSteps) ? r.context.nextSteps : undefined,
          actions: Array.isArray(r.context?.actions) ? r.context.actions : undefined,
        }))
        .reverse(),
    });
  } catch (error) {
    if (isMissingTableOrColumn(error)) {
      return NextResponse.json({
        messages: [],
        warning: 'Assistant tables are missing or outdated. Run latest DB migration/setup.sql.',
      });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query params', details: error.errors }, { status: 400 });
    }
    console.error('[HEALTH ASSISTANT GET]', error);
    return NextResponse.json({ error: 'Failed to load assistant messages.' }, { status: 500 });
  }
});

export const POST = withAuth(async (req: AuthedRequest) => {
  try {
    const body = await req.json();
    const data = PostSchema.parse(body);
    const thread = await ensureAssistantThread(req.user.sub, data.threadId);
    const traceId = randomUUID().replace(/-/g, '');
    const detectedSafetyFlags = detectSafetyFlags(data.message);

    await sql`
      INSERT INTO health_assistant_chats (user_id, thread_id, role, message, trace_id, intent, safety_flags, response_source)
      VALUES (${req.user.sub}, ${thread.id}, 'user', ${data.message}, ${traceId}, 'user_input', ${detectedSafetyFlags}, 'client')
    `;

    const context = await loadAssistantContext(req.user.sub);
    const fallbackAnswer = buildAssistantReply(data.message, context);
    const trainingNotes = await getAssistantTrainingNotes(fallbackAnswer.mode);

    const llm = await generateAssistantBrainReply({
      userMessage: data.message,
      userFirstName: context.userFirstName,
      mode: fallbackAnswer.mode,
      severity: fallbackAnswer.severity,
      summary: fallbackAnswer.summary,
      fallbackMessage: fallbackAnswer.message,
      fallbackSections: fallbackAnswer.sections,
      fallbackNextSteps: fallbackAnswer.nextSteps,
      fallbackActions: fallbackAnswer.actions,
      contextDigest: buildAssistantContextDigest(context),
      trainingNotes,
    });

    const guardrail = appendMedicalGuardrail(llm.message, fallbackAnswer.mode, detectedSafetyFlags);
    const safeActions = validateAssistantActions(fallbackAnswer.actions);
    const confidenceReason = `${llm.confidenceReason} ${guardrail.confidenceReasonAddon}`.trim();

    const inserted = await sql`
      INSERT INTO health_assistant_chats (
        user_id,
        thread_id,
        role,
        message,
        trace_id,
        intent,
        safety_flags,
        response_source,
        confidence,
        confidence_reason,
        latency_ms,
        context
      )
      VALUES (
        ${req.user.sub},
        ${thread.id},
        'assistant',
        ${guardrail.message},
        ${traceId},
        ${fallbackAnswer.mode},
        ${detectedSafetyFlags},
        ${llm.source},
        ${llm.confidence},
        ${confidenceReason},
        ${llm.latencyMs},
        ${JSON.stringify({
          severity: fallbackAnswer.severity,
          mode: fallbackAnswer.mode,
          title: fallbackAnswer.title,
          summary: llm.summary,
          sections: llm.sections,
          nextSteps: llm.nextSteps,
          actions: safeActions,
          traceId,
          safetyFlags: detectedSafetyFlags,
          confidence: llm.confidence,
          confidenceReason,
        })}::jsonb
      )
      RETURNING id, role, message, context, created_at, trace_id, intent, safety_flags, confidence, confidence_reason
    `;

    const row = inserted[0] as any;

    await sql`
      INSERT INTO health_assistant_events (
        user_id,
        assistant_chat_id,
        trace_id,
        intent,
        severity,
        safety_flags,
        response_source,
        model,
        confidence,
        confidence_reason,
        latency_ms,
        status,
        error,
        payload
      )
      VALUES (
        ${req.user.sub},
        ${row.id},
        ${traceId},
        ${fallbackAnswer.mode},
        ${fallbackAnswer.severity},
        ${detectedSafetyFlags},
        ${llm.source},
        ${llm.model},
        ${llm.confidence},
        ${confidenceReason},
        ${llm.latencyMs},
        ${llm.error ? 'degraded' : 'completed'},
        ${llm.error ?? null},
        ${JSON.stringify({
          title: fallbackAnswer.title,
          summary: llm.summary,
          nextSteps: llm.nextSteps,
          safetyFlags: detectedSafetyFlags,
          trainingAppliedCount: trainingNotes.length,
        })}::jsonb
      )
    `;

    const automation = await runAssistantUrgentTriage({
      userId: req.user.sub,
      userMessage: data.message,
      assistantReply: row.message,
      assistantSeverity: fallbackAnswer.severity,
      assistantMode: fallbackAnswer.mode,
      escalationSummary: llm.summary,
      nextSteps: llm.nextSteps,
    });

    return NextResponse.json({
      success: true,
      thread: {
        id: thread.id,
        title: thread.title,
      },
      reply: {
        id: row.id,
        role: row.role,
        message: row.message,
        createdAt: row.created_at,
        severity: fallbackAnswer.severity,
        mode: fallbackAnswer.mode,
        title: fallbackAnswer.title,
        summary: llm.summary,
        sections: llm.sections,
        nextSteps: llm.nextSteps,
        actions: safeActions,
        traceId,
        intent: row.intent ?? fallbackAnswer.mode,
        safetyFlags: Array.isArray(row.safety_flags) ? row.safety_flags : detectedSafetyFlags,
        confidence: row.confidence != null ? Number(row.confidence) : llm.confidence,
        confidenceReason: row.confidence_reason ?? confidenceReason,
      },
      response: {
        reply: row.message,
        sections: llm.sections,
        nextSteps: llm.nextSteps,
        actions: safeActions,
        safetyFlags: Array.isArray(row.safety_flags) ? row.safety_flags : detectedSafetyFlags,
        traceId,
      },
      automation,
    });
  } catch (error) {
    if (isMissingTableOrColumn(error)) {
      return NextResponse.json(
        { error: 'Assistant tables are missing or outdated. Run latest database/setup.sql migration first.' },
        { status: 500 },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('[HEALTH ASSISTANT POST]', error);
    return NextResponse.json({ error: 'Failed to process assistant message.' }, { status: 500 });
  }
});
