import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { withAuth, AuthedRequest } from '@/lib/authMiddleware';

const FeedbackSchema = z.object({
  assistantChatId: z.coerce.number().int().positive(),
  helpful: z.boolean(),
  comment: z.string().max(500).optional(),
});

function isMissingTableOrColumn(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: string }).code;
  return code === '42P01' || code === '42703';
}

export const POST = withAuth(async (req: AuthedRequest) => {
  try {
    const body = await req.json();
    const data = FeedbackSchema.parse(body);

    const messageRows = await sql`
      SELECT id
      FROM health_assistant_chats
      WHERE id = ${data.assistantChatId}
        AND user_id = ${req.user.sub}
        AND role = 'assistant'
      LIMIT 1
    `;
    if (!messageRows[0]) {
      return NextResponse.json({ error: 'Assistant message not found.' }, { status: 404 });
    }

    await sql`
      INSERT INTO health_assistant_feedback (user_id, assistant_chat_id, helpful, comment)
      VALUES (${req.user.sub}, ${data.assistantChatId}, ${data.helpful}, ${data.comment?.trim() || null})
      ON CONFLICT (user_id, assistant_chat_id)
      DO UPDATE SET
        helpful = EXCLUDED.helpful,
        comment = EXCLUDED.comment,
        created_at = NOW()
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isMissingTableOrColumn(error)) {
      return NextResponse.json(
        { error: 'Assistant feedback table is missing. Run latest database/setup.sql migration first.' },
        { status: 500 },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('[HEALTH ASSISTANT FEEDBACK POST]', error);
    return NextResponse.json({ error: 'Failed to save assistant feedback.' }, { status: 500 });
  }
});
