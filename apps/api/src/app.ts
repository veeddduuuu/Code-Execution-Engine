import express from 'express';
import { healthRoutes } from './routes/health.routes';
import { executionRoutes } from './routes/execution.routes';
import { jobsRoutes } from './routes/jobs.routes';

const app = express();

app.use(express.json({limit : '50kb'}));

app.use('/api/v1', healthRoutes);
app.use('/api/v1', executionRoutes);
app.use('/api/v1', jobsRoutes);

export default app;