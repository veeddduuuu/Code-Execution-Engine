import express from 'express';
import { healthRoutes } from './routes/health.routes';
import { executionRoutes } from './routes/execution.routes';
import { jobRoutes } from './routes/job.routes';
import { sessionRoutes } from './routes/sessions.routes';

const app = express();

app.use(express.json({limit : '50kb'}));

app.use('/api/v1', healthRoutes);
app.use('/api/v1', executionRoutes);
app.use('/api/v1', jobRoutes);
app.use('/api/v1', sessionRoutes);

export default app;