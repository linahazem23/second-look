import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

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

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Second Look API running on http://localhost:${port}`);
});
