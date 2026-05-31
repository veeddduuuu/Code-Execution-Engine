import { Router } from 'express';
import { createSession, runSession, getSession, stopSession } from '../controllers/sessions.controller';

const router = Router();

export const sessionRoutes = router.post('/sessions', createSession())
    .post('/sessions/:id/run', runSession())
    .get('/sessions/:id', getSession())
    .post('/sessions/:id/stop', stopSession())

export default router;