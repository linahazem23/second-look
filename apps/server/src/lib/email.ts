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

/**
 * Fire-and-forget "someone replied to a thread you're watching" notification —
 * the email side of the round "notify me" toggle on a community thread.
 */
export async function notifyThreadReply(params: {
  threadId: string;
  recipientEmail: string;
  recipientName: string;
  replierName: string;
  threadTitle: string;
  preview: string;
}) {
  if (!resend) return;

  const debounceKey = `community:${params.threadId}:${params.recipientEmail}`;
  if (!passesDebounce(debounceKey)) return;

  const link = `${APP_URL}/?community=${params.threadId}`;
  const safePreview = escapeHtml(params.preview).slice(0, 300);

  try {
    await resend.emails.send({
      from: FROM,
      to: params.recipientEmail,
      subject: `${params.replierName} replied to "${params.threadTitle}" on Second Look`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px 0;">
          <p style="font-family: Georgia, serif; font-size: 20px; color: #5A2E3D; margin: 0 0 16px;">Second Look</p>
          <p style="color: #37202A; font-size: 15px;">Hi ${escapeHtml(params.recipientName)}, ${escapeHtml(params.replierName)} replied to a thread you're watching — <strong>${escapeHtml(params.threadTitle)}</strong>:</p>
          <p style="background: #F6D9E3; padding: 12px 16px; border-radius: 10px; color: #37202A; font-size: 14px;">${safePreview}</p>
          <a href="${link}" style="display: inline-block; margin-top: 12px; background: #C6597A; color: #fff; padding: 11px 22px; border-radius: 100px; text-decoration: none; font-size: 14px; font-weight: 600;">View the thread</a>
          <p style="color: #9C7684; font-size: 11.5px; margin-top: 28px;">You're receiving this because you tapped "notify me" on this thread on Second Look.</p>
        </div>
      `
    });
  } catch (err) {
    console.error('Failed to send thread-reply notification email', err);
  }
}

/**
 * Sent once at signup to a minor's guardian — a real transactional email, not
 * a repeating notification, so it doesn't go through the debounce map.
 */
export async function notifyGuardianConsentRequest(params: {
  guardianEmail: string;
  guardianName: string;
  minorName: string;
  token: string;
}) {
  if (!resend) return;

  const link = `${APP_URL}/?guardianConsent=${params.token}`;

  try {
    await resend.emails.send({
      from: FROM,
      to: params.guardianEmail,
      subject: `${params.minorName} listed you as her guardian on Second Look`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px 0;">
          <p style="font-family: Georgia, serif; font-size: 20px; color: #5A2E3D; margin: 0 0 16px;">Second Look</p>
          <p style="color: #37202A; font-size: 15px;">Hi ${escapeHtml(params.guardianName)}, <strong>${escapeHtml(params.minorName)}</strong> signed up on Second Look — a women-only resale marketplace — and listed you as her guardian since she's under 18.</p>
          <p style="color: #37202A; font-size: 15px;">To let her buy and sell, we need you to confirm you're her guardian and are 18 or older. This takes two minutes: upload a photo of your own ID and confirm you're okay being the contact point if our safety team ever needs to reach someone about her account.</p>
          <a href="${link}" style="display: inline-block; margin-top: 12px; background: #C6597A; color: #fff; padding: 11px 22px; border-radius: 100px; text-decoration: none; font-size: 14px; font-weight: 600;">Review and confirm</a>
          <p style="color: #9C7684; font-size: 11.5px; margin-top: 28px;">Her account stays limited to browsing until this is confirmed. If you don't recognize this request, you can safely ignore this email.</p>
        </div>
      `
    });
  } catch (err) {
    console.error('Failed to send guardian consent request email', err);
  }
}

/**
 * Sent the moment a buyer completes a Buy — the seller's only signal that an
 * item sold before they happen to open the app. Not debounced: each purchase
 * is its own one-time event, not a repeating conversation.
 */
export async function notifyOrderPlaced(params: { sellerEmail: string; sellerName: string; itemTitle: string; amount: number; orderId: string }) {
  if (!resend) return;

  const link = `${APP_URL}/?order=${params.orderId}`;

  try {
    await resend.emails.send({
      from: FROM,
      to: params.sellerEmail,
      subject: `Your "${params.itemTitle}" just sold on Second Look`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px 0;">
          <p style="font-family: Georgia, serif; font-size: 20px; color: #5A2E3D; margin: 0 0 16px;">Second Look</p>
          <p style="color: #37202A; font-size: 15px;">Hi ${escapeHtml(params.sellerName)}, great news — <strong>${escapeHtml(params.itemTitle)}</strong> just sold for ${params.amount} EGP.</p>
          <p style="color: #37202A; font-size: 15px;">The buyer's payment is held safely with Second Look. Open the order to agree on a delivery method and chat with the buyer.</p>
          <a href="${link}" style="display: inline-block; margin-top: 12px; background: #C6597A; color: #fff; padding: 11px 22px; border-radius: 100px; text-decoration: none; font-size: 14px; font-weight: 600;">View the order</a>
        </div>
      `
    });
  } catch (err) {
    console.error('Failed to send order-placed notification email', err);
  }
}

/**
 * Sent on a forgot-password request. Always a real transactional send when the
 * account exists — the route itself decides whether to call this, so a bad
 * email address never learns anything from timing or response shape.
 */
export async function notifyPasswordReset(params: { recipientEmail: string; recipientName: string; token: string }) {
  if (!resend) return;

  const link = `${APP_URL}/?resetPassword=${params.token}`;

  try {
    await resend.emails.send({
      from: FROM,
      to: params.recipientEmail,
      subject: 'Reset your Second Look password',
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px 0;">
          <p style="font-family: Georgia, serif; font-size: 20px; color: #5A2E3D; margin: 0 0 16px;">Second Look</p>
          <p style="color: #37202A; font-size: 15px;">Hi ${escapeHtml(params.recipientName)}, we got a request to reset your password. This link works for 1 hour.</p>
          <a href="${link}" style="display: inline-block; margin-top: 12px; background: #C6597A; color: #fff; padding: 11px 22px; border-radius: 100px; text-decoration: none; font-size: 14px; font-weight: 600;">Reset password</a>
          <p style="color: #9C7684; font-size: 11.5px; margin-top: 28px;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
        </div>
      `
    });
  } catch (err) {
    console.error('Failed to send password reset email', err);
  }
}

/**
 * Sent once, the moment an admin approves a member's KYC — a real transactional
 * event, not a repeating notification, so it doesn't go through the debounce map.
 */
export async function notifyKycApproved(params: { recipientEmail: string; recipientName: string }) {
  if (!resend) return;

  const link = `${APP_URL}/`;

  try {
    await resend.emails.send({
      from: FROM,
      to: params.recipientEmail,
      subject: "You're verified — welcome to the Diva club 💅",
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px 0;">
          <p style="font-family: Georgia, serif; font-size: 20px; color: #5A2E3D; margin: 0 0 16px;">Second Look</p>
          <p style="color: #37202A; font-size: 15px;">Hi ${escapeHtml(params.recipientName)},</p>
          <p style="color: #37202A; font-size: 15px;">We verified that you are the most beautiful woman we have seen — you are now in Diva! 👑</p>
          <p style="color: #37202A; font-size: 15px;">Your account is fully verified — go buy, sell, and negotiate freely.</p>
          <a href="${link}" style="display: inline-block; margin-top: 12px; background: #C6597A; color: #fff; padding: 11px 22px; border-radius: 100px; text-decoration: none; font-size: 14px; font-weight: 600;">Open Second Look</a>
        </div>
      `
    });
  } catch (err) {
    console.error('Failed to send KYC-approved email', err);
  }
}

/**
 * Sent once, right after signup — a real transactional event, not a repeating
 * notification, so it doesn't go through the debounce map. Combines the
 * community guidelines (otherwise only seen slide-by-slide during onboarding)
 * into one warm, readable welcome.
 */
export async function notifyWelcome(params: { recipientEmail: string; recipientName: string }) {
  if (!resend) return;

  const link = `${APP_URL}/`;
  const name = escapeHtml(params.recipientName);

  const guidelines = [
    ['Every member is verified', 'Every seller and buyer here is a real, identity-verified woman — no anonymous strangers, no guessing who you\'re dealing with.'],
    ['Chats may be reviewed', 'For everyone\'s safety, our moderation team can look into a conversation if something\'s flagged — it keeps the whole space honest.'],
    ['Be honest, always', 'Describe your items accurately, and only review real, completed orders. Trust here is built one honest listing at a time.'],
    ['Report, don\'t retaliate', 'If something feels off, tap report instead of taking it into your own hands. We\'ll take it from there.']
  ];

  const guidelineHtml = guidelines
    .map(
      ([title, body]) => `
        <div style="background: #F6D9E3; border-radius: 10px; padding: 12px 16px; margin-bottom: 10px;">
          <p style="color: #5A2E3D; font-size: 14px; font-weight: 600; margin: 0 0 4px;">${escapeHtml(title)}</p>
          <p style="color: #37202A; font-size: 13.5px; margin: 0; line-height: 1.5;">${escapeHtml(body)}</p>
        </div>`
    )
    .join('');

  try {
    await resend.emails.send({
      from: FROM,
      to: params.recipientEmail,
      subject: 'Welcome to Second Look 💕',
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px 0;">
          <p style="font-family: Georgia, serif; font-size: 20px; color: #5A2E3D; margin: 0 0 16px;">Second Look</p>
          <p style="color: #37202A; font-size: 15px;">Hiii ${name} 💕</p>
          <p style="color: #37202A; font-size: 15px; line-height: 1.6;">Welcome to Second Look — a women-only, identity-verified space to buy and sell skincare, haircare, makeup, and clothes without the usual stranger-danger of a random Facebook group.</p>
          <p style="color: #37202A; font-size: 15px; line-height: 1.6;">A few things worth knowing before you dive in:</p>
          ${guidelineHtml}
          <p style="color: #37202A; font-size: 15px; line-height: 1.6;">And here's the part that actually protects you: when someone buys, the payment sits with Second Look — not the seller — until the buyer confirms the item arrived as expected. If anything ever feels off in a chat, there's a 🆘 SOS button right there that brings a real person from our team straight into the conversation.</p>
          <p style="color: #37202A; font-size: 15px; line-height: 1.6;">We're building something real here — a community where every one of us matters, every behavior counts, and every bit of trust is worth protecting. Keep flagging what's off, keep selling honestly, keep leaving real reviews. That's what makes this place safe for the next girl too. احنا كلنا بنات حلال 💕</p>
          <a href="${link}" style="display: inline-block; margin-top: 12px; background: #C6597A; color: #fff; padding: 11px 22px; border-radius: 100px; text-decoration: none; font-size: 14px; font-weight: 600;">Open Second Look</a>
        </div>
      `
    });
  } catch (err) {
    console.error('Failed to send welcome email', err);
  }
}

/**
 * Sent when a real admin replies to a user's customer-support message — not
 * the canned quick-reply bot, which the user already sees instantly in-app.
 */
export async function notifySupportReply(params: { recipientEmail: string; recipientName: string; preview: string }) {
  if (!resend) return;

  const debounceKey = `support:${params.recipientEmail}`;
  if (!passesDebounce(debounceKey)) return;

  const link = `${APP_URL}/?support=1`;
  const safePreview = escapeHtml(params.preview).slice(0, 300);

  try {
    await resend.emails.send({
      from: FROM,
      to: params.recipientEmail,
      subject: 'Second Look Support replied to you',
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px 0;">
          <p style="font-family: Georgia, serif; font-size: 20px; color: #5A2E3D; margin: 0 0 16px;">Second Look</p>
          <p style="color: #37202A; font-size: 15px;">Hi ${escapeHtml(params.recipientName)}, our support team replied to your message:</p>
          <p style="background: #F6D9E3; padding: 12px 16px; border-radius: 10px; color: #37202A; font-size: 14px;">${safePreview}</p>
          <a href="${link}" style="display: inline-block; margin-top: 12px; background: #C6597A; color: #fff; padding: 11px 22px; border-radius: 100px; text-decoration: none; font-size: 14px; font-weight: 600;">View the reply</a>
        </div>
      `
    });
  } catch (err) {
    console.error('Failed to send support reply notification email', err);
  }
}
