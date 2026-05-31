import { Router } from 'express';
import { createSession, runSession, getSessions, stopSession } from '../controllers/sessions.controller';

const router = Router();

const sessionRoutes = router.post('/sessions', createSession())
.post('/sessions/:id/run', runSession())
.get('/sessions/:id', getSessions())
.post('/sessions/:id/stop', stopSession())

export default router;