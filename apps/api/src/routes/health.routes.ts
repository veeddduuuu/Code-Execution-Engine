import Router from 'express';
const router = Router();
import { getHealth } from '../controllers/health.controller';

export const healthRoutes = router.get('/health', getHealth);

export default router;