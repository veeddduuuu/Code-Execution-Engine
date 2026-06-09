import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { healthRoutes } from './routes/health.routes';
import { executionRoutes } from './routes/execution.routes';
import { jobRoutes } from './routes/job.routes';

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5174' }));
app.use(express.json({ limit: '50kb' }));

app.use('/api/v1', healthRoutes);
app.use('/api/v1', executionRoutes);
app.use('/api/v1', jobRoutes);

export default app;