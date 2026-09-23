import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth.routes.js';
import { uploadsRouter } from './routes/uploads.routes.js';
import { listingsRouter } from './routes/listings.routes.js';
import { demandRouter } from './routes/demand.routes.js';
import { ordersRouter } from './routes/orders.routes.js';
import { reviewsRouter } from './routes/reviews.routes.js';
import { chatRouter } from './routes/chat.routes.js';
import { reportsRouter } from './routes/reports.routes.js';
import { appealsRouter } from './routes/appeals.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { profilesRouter } from './routes/profiles.routes.js';
import { growthRouter } from './routes/growth.routes.js';
import { inquiriesRouter } from './routes/inquiries.routes.js';
import { paymentsRouter } from './routes/payments.routes.js';
import { communityRouter } from './routes/community.routes.js';
import { adsRouter } from './routes/ads.routes.js';
import { feedbackRouter } from './routes/feedback.routes.js';
import { birthdaysRouter } from './routes/birthdays.routes.js';
import { petsRouter } from './routes/pets.routes.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4000);

// Render terminates TLS and proxies to us over plain HTTP, setting
// X-Forwarded-Proto: https — without this, req.protocol always reads "http"
// even on the live HTTPS domain, so generated URLs (uploads, etc.) come back
// as http:// and trip mixed-content warnings.
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'second-look-server', timestamp: new Date().toISOString() });
});

app.use('/api/uploads', uploadsRouter);
app.use('/api/auth', authRouter);
app.use('/api/listings', listingsRouter);
app.use('/api/demand', demandRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/chats', chatRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/appeals', appealsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/growth', growthRouter);
app.use('/api/inquiries', inquiriesRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/community', communityRouter);
app.use('/api/ads', adsRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/birthdays', birthdaysRouter);
app.use('/api/pets', petsRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Second Look API running on http://localhost:${port}`);
});
