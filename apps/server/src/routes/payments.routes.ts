import { Router } from 'express';
import { prisma } from '../lib/db.js';
import { verifyWebhookHmac } from '../lib/paymob.js';

export const paymentsRouter = Router();

// Paymob's server-to-server "Transaction Processed Callback" — not user-facing,
// so it has no auth middleware; authenticity comes entirely from the HMAC check.
paymentsRouter.post('/paymob/webhook', async (req, res) => {
  const hmac = req.query.hmac as string | undefined;
  const obj = req.body?.obj;
  if (!hmac || !obj) return res.status(400).json({ error: 'Malformed webhook payload' });

  if (!verifyWebhookHmac(obj, hmac)) {
    return res.status(401).json({ error: 'Invalid HMAC signature' });
  }

  const merchantOrderId = obj.order?.merchant_order_id as string | undefined;
  if (!merchantOrderId) return res.status(400).json({ error: 'Missing merchant_order_id' });

  if (merchantOrderId.startsWith('boost_')) {
    const boostPaymentId = merchantOrderId.slice('boost_'.length);
    const boostPayment = await prisma.boostPayment.findUnique({ where: { id: boostPaymentId } });
    if (!boostPayment) return res.status(404).json({ error: 'Boost payment not found' });

    // Idempotent — Paymob may redeliver the same webhook.
    if (boostPayment.paid) return res.json({ ok: true });

    if (obj.success === true) {
      const boostedTargetUpdate = boostPayment.targetType === 'demand'
        ? prisma.demandRequest.update({ where: { id: boostPayment.targetId }, data: { boosted: true } })
        : prisma.listing.update({ where: { id: boostPayment.targetId }, data: { boosted: true } });
      await prisma.$transaction([
        prisma.boostPayment.update({ where: { id: boostPayment.id }, data: { paid: true } }),
        boostedTargetUpdate
      ]);
    }
    // On failure there's nothing to revert — the target was never marked boosted.

    return res.json({ ok: true });
  }

  const order = await prisma.order.findUnique({ where: { id: merchantOrderId } });
  if (!order) return res.status(404).json({ error: 'Order not found' });

  // Idempotent — Paymob may redeliver the same webhook.
  if (order.escrowStatus !== 'AwaitingPayment') return res.json({ ok: true });

  if (obj.success === true) {
    // obj.id is Paymob's transaction id (distinct from paymobOrderId, its order
    // id) — kept so a later dispute refund can be issued against this exact charge.
    await prisma.order.update({ where: { id: order.id }, data: { escrowStatus: 'InEscrow', paymobTransactionId: String(obj.id) } });
  } else {
    await prisma.$transaction([
      prisma.order.update({ where: { id: order.id }, data: { escrowStatus: 'PaymentFailed' } }),
      prisma.listing.update({ where: { id: order.listingId }, data: { status: 'Active' } })
    ]);
  }

  return res.json({ ok: true });
});
