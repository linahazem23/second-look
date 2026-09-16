// Twilio's REST API over plain fetch — same pattern as lib/paymob.ts, no SDK
// needed. Silently no-ops when credentials aren't configured (same fallback
// behavior as lib/email.ts when RESEND_API_KEY is missing), so phone
// verification can ship now and start actually texting the moment a Twilio
// account is connected.
const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;

export async function sendSms(to: string, body: string): Promise<void> {
  if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM_NUMBER) {
    console.warn(`[SMS not sent — Twilio not configured] To: ${to} | ${body}`);
    return;
  }

  const auth = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ To: to, From: FROM_NUMBER, Body: body })
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Twilio SMS failed: ${detail}`);
  }
}
