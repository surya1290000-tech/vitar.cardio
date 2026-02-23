import { sql } from '@/lib/db';

type AdminAuditAction = 'login_success' | 'login_failed' | 'login_blocked' | 'logout';

export async function writeAdminAuditLog(params: {
  action: AdminAuditAction;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: string | null;
}) {
  try {
    await sql`
      INSERT INTO admin_auth_log (action, ip_address, user_agent, details)
      VALUES (
        ${params.action},
        ${params.ipAddress ?? null},
        ${params.userAgent ?? null},
        ${params.details ?? null}
      )
    `;
  } catch (error) {
    // Keep auth flow non-blocking even if audit table isn't migrated yet.
    console.error('[ADMIN AUDIT LOG ERROR]', error);
  }
}
