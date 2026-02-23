import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

transporter.verify((error) => {
  if (error) {
    console.error('[EMAIL] SMTP connection failed:', error.message);
  } else {
    console.log('[EMAIL] Gmail SMTP ready ✓');
  }
});

export async function sendOTPEmail(to: string, firstName: string, otp: string): Promise<void> {
  await transporter.sendMail({
    from: `"VITAR Health" <${process.env.SMTP_USER}>`,
    to,
    subject: `${otp} is your VITAR verification code`,
    html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0D0D0F;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D0F;padding:40px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="padding-bottom:32px;">
  <span style="font-size:24px;letter-spacing:0.12em;color:#F9F8F6;font-weight:300;">VITAR<span style="color:#C0392B;">.</span></span>
</td></tr>
<tr><td style="background:#1A1A1C;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:40px;">
  <p style="margin:0 0 8px;font-size:22px;color:#F9F8F6;">Hi ${firstName},</p>
  <p style="margin:0 0 32px;font-size:14px;color:#8A8A8E;line-height:1.7;">
    Use the code below to verify your VITAR account. It expires in <strong style="color:#F9F8F6;">10 minutes.</strong>
  </p>
  <table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="background:#0D0D0F;border:1px solid rgba(192,57,43,0.3);border-radius:8px;padding:32px 24px;">
    <span style="font-size:48px;letter-spacing:16px;color:#F9F8F6;font-weight:300;">${otp}</span>
    <br/><span style="font-size:11px;color:#8A8A8E;letter-spacing:0.1em;text-transform:uppercase;margin-top:12px;display:block;">Expires in 10 minutes</span>
  </td></tr>
  </table>
  <p style="margin:32px 0 0;font-size:12px;color:#8A8A8E;line-height:1.6;">
    If you didn't create a VITAR account, ignore this email. Never share this code with anyone.
  </p>
</td></tr>
<tr><td style="padding-top:24px;">
  <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.25);">VITAR Health Technologies · Do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`,
    text: `Hi ${firstName},\n\nYour VITAR verification code is: ${otp}\n\nExpires in 10 minutes. Never share this code.`,
  });
}

export async function sendPasswordResetEmail(to: string, firstName: string, resetUrl: string): Promise<void> {
  await transporter.sendMail({
    from: `"VITAR Health" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Reset your VITAR password',
    html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0D0D0F;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D0F;padding:40px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="padding-bottom:32px;">
  <span style="font-size:24px;letter-spacing:0.12em;color:#F9F8F6;">VITAR<span style="color:#C0392B;">.</span></span>
</td></tr>
<tr><td style="background:#1A1A1C;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:40px;">
  <p style="margin:0 0 8px;font-size:22px;color:#F9F8F6;">Hi ${firstName},</p>
  <p style="margin:0 0 32px;font-size:14px;color:#8A8A8E;line-height:1.7;">
    We received a request to reset your password. This link expires in <strong style="color:#F9F8F6;">1 hour.</strong>
  </p>
  <table cellpadding="0" cellspacing="0">
  <tr><td style="background:#C0392B;border-radius:3px;">
    <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;color:#F9F8F6;text-decoration:none;font-size:13px;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;">Reset Password</a>
  </td></tr>
  </table>
  <p style="margin:24px 0 0;font-size:12px;color:#8A8A8E;">If you didn't request this, ignore this email.</p>
</td></tr>
<tr><td style="padding-top:24px;">
  <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.25);">VITAR Health Technologies · Do not reply.</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`,
    text: `Hi ${firstName},\n\nReset your password: ${resetUrl}\n\nExpires in 1 hour.`,
  });
}

export async function sendWelcomeEmail(to: string, firstName: string): Promise<void> {
  await transporter.sendMail({
    from: `"VITAR Health" <${process.env.SMTP_USER}>`,
    to,
    subject: `Welcome to VITAR, ${firstName}`,
    html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0D0D0F;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D0F;padding:40px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="padding-bottom:32px;">
  <span style="font-size:24px;letter-spacing:0.12em;color:#F9F8F6;">VITAR<span style="color:#C0392B;">.</span></span>
</td></tr>
<tr><td style="background:#1A1A1C;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:40px;">
  <p style="margin:0 0 16px;font-size:26px;color:#F9F8F6;font-weight:300;line-height:1.3;">
    Your heart is now<br/>protected, ${firstName}.
  </p>
  <p style="margin:0 0 32px;font-size:14px;color:#8A8A8E;line-height:1.7;">
    Your VITAR account is verified. Once your device ships, you'll have 24/7 cardiac monitoring with instant emergency alerts.
  </p>
  <table cellpadding="0" cellspacing="0">
  <tr><td style="background:#C0392B;border-radius:3px;">
    <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display:inline-block;padding:14px 32px;color:#F9F8F6;text-decoration:none;font-size:13px;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;">Go to Dashboard</a>
  </td></tr>
  </table>
</td></tr>
<tr><td style="padding-top:24px;">
  <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.25);">VITAR Health Technologies · Do not reply.</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`,
    text: `Welcome to VITAR, ${firstName}!\n\nYour account is verified.\nGo to dashboard: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
  });
}

export async function sendOrderConfirmationEmail(to: string, firstName: string, orderNumber: string, deviceModel: string, total: number): Promise<void> {
  await transporter.sendMail({
    from: `"VITAR Health" <${process.env.SMTP_USER}>`,
    to,
    subject: `Order confirmed — ${orderNumber}`,
    html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0D0D0F;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D0F;padding:40px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="padding-bottom:32px;">
  <span style="font-size:24px;letter-spacing:0.12em;color:#F9F8F6;">VITAR<span style="color:#C0392B;">.</span></span>
</td></tr>
<tr><td style="background:#1A1A1C;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:40px;">
  <p style="margin:0 0 8px;font-size:22px;color:#F9F8F6;">Your device is reserved.</p>
  <p style="margin:0 0 32px;font-size:14px;color:#8A8A8E;line-height:1.7;">
    Hi ${firstName}, your pre-order is confirmed. <strong style="color:#F9F8F6;">No charge until your device ships.</strong>
  </p>
  <table width="100%" cellpadding="12" style="background:#0D0D0F;border:1px solid rgba(255,255,255,0.08);border-radius:6px;">
    <tr><td style="font-size:12px;color:#8A8A8E;">Order Number</td><td align="right" style="font-size:12px;color:#F9F8F6;">${orderNumber}</td></tr>
    <tr><td style="font-size:12px;color:#8A8A8E;">Device</td><td align="right" style="font-size:12px;color:#F9F8F6;">VITAR ${deviceModel}</td></tr>
    <tr style="border-top:1px solid rgba(255,255,255,0.08);"><td style="font-size:12px;color:#8A8A8E;">Total</td><td align="right" style="font-size:13px;color:#C0392B;font-weight:500;">$${(total / 100).toFixed(2)}</td></tr>
  </table>
</td></tr>
<tr><td style="padding-top:24px;">
  <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.25);">VITAR Health Technologies · Do not reply.</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`,
    text: `Hi ${firstName},\nOrder: ${orderNumber}\nDevice: VITAR ${deviceModel}\nTotal: $${(total / 100).toFixed(2)} (at shipping)`,
  });
}
