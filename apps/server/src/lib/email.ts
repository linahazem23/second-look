import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM ?? 'Second Look <notifications@trysecondlook.app>';
const APP_URL = process.env.APP_URL ?? 'https://second-look-web-five.vercel.app';

const DEBOUNCE_MS = 10 * 60 * 1000;
// In-memory only — an occasional extra email after a cold start (Render's free
// tier sleeps and wipes this) is a fine failure mode for a debounce window.
const lastNotifiedAt = new Map<string, number>();

function passesDebounce(key: string): boolean {
  const now = Date.now();
  const last = lastNotifiedAt.get(key);
  if (last && now - last < DEBOUNCE_MS) return false;
  lastNotifiedAt.set(key, now);
  return true;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/**
 * Fire-and-forget new-message notification. Never throws — a failed or skipped
 * email must never interrupt sending the actual chat message.
 */
export async function notifyNewMessage(params: {
  threadType: 'order' | 'inquiry';
  threadId: string;
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  itemTitle: string;
  preview: string;
}) {
  if (!resend) return;

  const debounceKey = `${params.threadType}:${params.threadId}:${params.recipientEmail}`;
  if (!passesDebounce(debounceKey)) return;

  const link = `${APP_URL}/?${params.threadType}=${params.threadId}`;
  const safePreview = escapeHtml(params.preview).slice(0, 300);

  try {
    await resend.emails.send({
      from: FROM,
      to: params.recipientEmail,
      subject: `${params.senderName} sent you a message on Second Look`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px 0;">
          <p style="font-family: Georgia, serif; font-size: 20px; color: #5A2E3D; margin: 0 0 16px;">Second Look</p>
          <p style="color: #37202A; font-size: 15px;">Hi ${escapeHtml(params.recipientName)}, ${escapeHtml(params.senderName)} sent you a message about <strong>${escapeHtml(params.itemTitle)}</strong>:</p>
          <p style="background: #F6D9E3; padding: 12px 16px; border-radius: 10px; color: #37202A; font-size: 14px;">${safePreview}</p>
          <a href="${link}" style="display: inline-block; margin-top: 12px; background: #C6597A; color: #fff; padding: 11px 22px; border-radius: 100px; text-decoration: none; font-size: 14px; font-weight: 600;">Reply on Second Look</a>
          <p style="color: #9C7684; font-size: 11.5px; margin-top: 28px;">You're receiving this because you have an active conversation on Second Look.</p>
        </div>
      `
    });
  } catch (err) {
    console.error('Failed to send new-message notification email', err);
  }
}
