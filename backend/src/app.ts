import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
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

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/v1/auth', authRoutes);
app.use('/v1/groups', groupRoutes);
app.use('/v1', inviteRoutes);
app.use('/v1', splitRoutes);
app.use('/v1', settlementRoutes);
app.use('/v1', balanceRoutes);
app.use('/v1/budget', budgetRoutes);
app.use('/v1/transactions', transactionRoutes);
app.use('/v1/profile', profileRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

export default app;
