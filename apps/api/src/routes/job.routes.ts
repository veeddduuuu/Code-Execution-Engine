import Router from 'express';
import { getJobStatus, getJobs } from '../controllers/job.controller';

const router = Router();

export const jobRoutes = router
.get('/jobs/:id', getJobStatus)
.get('/jobs', getJobs);

export default router;