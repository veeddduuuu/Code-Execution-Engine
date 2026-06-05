import Router from 'express';
import { cancelJob, getJobStatus, getJobs } from '../controllers/job.controller';

const router = Router();

export const jobRoutes = router
.get('/jobs/:id', getJobStatus)
.get('/jobs', getJobs)
.post('/jobs/:id/cancel', cancelJob);

export default router;