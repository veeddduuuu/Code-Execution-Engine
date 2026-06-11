import Router from 'express';
import { cancelJob, getJobStatus, getJobs, getDlq, replayDlq } from '../controllers/job.controller';

const router = Router();

export const jobRoutes = router
.get('/jobs/:id', getJobStatus)
.get('/jobs', getJobs)
.post('/jobs/:id/cancel', cancelJob)
.get('/dlq', getDlq)
.post('/dlq/:id/replay', replayDlq);

export default router;