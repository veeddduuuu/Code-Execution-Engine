import Router from 'express';
import { getJobStatus } from '../controllers/job.controller';

const router = Router();

export const jobRoutes = router.get('/jobs/:id', getJobStatus);

export default router;