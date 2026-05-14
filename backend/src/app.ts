import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { requestLogger } from './middleware/requestLogger';
import authRoutes from './routes/auth';
import groupRoutes from './routes/groups';
import inviteRoutes from './routes/invites';
import splitRoutes from './routes/splits';
import settlementRoutes from './routes/settlements';
import balanceRoutes from './routes/balance';
import budgetRoutes from './routes/budget';
import transactionRoutes from './routes/transactions';
import profileRoutes from './routes/profile';

const app: Application = express();
const isProd = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1); // Traefik forwards X-Forwarded-For
app.use(requestLogger); // Must come BEFORE body parsing so we time the full request

app.use(
  helmet({
    contentSecurityPolicy: false, // CSP would break the inline-script invite landing page
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(cors());
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: true, limit: '512kb' }));

// Auth rate limit — protects login/signup brute force without locking out NAT'd
// groups of legitimate users.  60 req / 15 min per IP across all auth routes.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Try again in 15 minutes.' },
});

// General API limiter — 1200 req / 15 min per IP. Generous enough that active
// users won't notice, tight enough to slow scrapers.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded.' },
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Android App Links verification — populate APP_FINGERPRINT in .env to enable
app.get('/.well-known/assetlinks.json', (_req: Request, res: Response) => {
  const fingerprint = process.env.APP_FINGERPRINT;
  const links = fingerprint
    ? [{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: 'com.bacchat.app', sha256_cert_fingerprints: [fingerprint] } }]
    : [];
  res.setHeader('Content-Type', 'application/json');
  res.json(links);
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/v1/auth', authLimiter, authRoutes);
app.use('/v1/groups', apiLimiter, groupRoutes);
app.use('/v1', apiLimiter, inviteRoutes);
app.use('/', inviteRoutes); // invite landing pages — un-prefixed, no API limit
app.use('/v1', apiLimiter, splitRoutes);
app.use('/v1', apiLimiter, settlementRoutes);
app.use('/v1', apiLimiter, balanceRoutes);
app.use('/v1/budget', apiLimiter, budgetRoutes);
app.use('/v1/transactions', apiLimiter, transactionRoutes);
app.use('/v1/profile', apiLimiter, profileRoutes);

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[500] Unhandled error:', err.stack || err.message);
  res.status(500).json({
    error: 'Internal server error',
    ...(isProd ? {} : { detail: err.message }),
  });
});

export default app;
