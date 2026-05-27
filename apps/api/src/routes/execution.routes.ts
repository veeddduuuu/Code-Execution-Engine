import { Router } from 'express';
import { executeCode } from '../controllers/execution.controller';

const router = Router();
export const executionRoutes = router.post('/execute', executeCode);

export default router;