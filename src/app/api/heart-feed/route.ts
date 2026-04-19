import { NextResponse } from 'next/server';
import { getHeartFeed } from '@/lib/heartFeed';

export async function GET() {
  try {
    const items = await getHeartFeed();

    return NextResponse.json(
      {
        items,
        generatedAt: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 's-maxage=300, stale-while-revalidate=900',
        },
      }
    );
  } catch (error) {
    console.error('[HEART FEED]', error);
    return NextResponse.json({ error: 'Failed to load heart feed.' }, { status: 500 });
  }
}
