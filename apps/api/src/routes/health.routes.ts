import Router from 'express';
const router = Router();
import { getHealth } from '../health.controller';

export const healthRoutes = router.get('/health', getHealth);

export default router;