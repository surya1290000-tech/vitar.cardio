import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    heart_rate: Math.floor(68 + Math.random() * 15),
    spo2: parseFloat((98 + Math.random() * 1.5).toFixed(1)),
    hrv_ms: Math.floor(55 + Math.random() * 20),
    ai_risk_score: Math.random() * 0.15,
    recorded_at: new Date().toISOString(),
    status: 'normal',
  });
}
