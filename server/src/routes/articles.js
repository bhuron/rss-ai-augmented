import express from 'express';
import { z } from 'zod';
import { articleOps } from '../services/database.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import {
  UpdateReadStatusRequestSchema,
  UpdateSavedStatusRequestSchema
} from '../schemas/api.js';

const router = express.Router();

router.get('/', (req, res) => {
  const { feedId, unreadOnly } = req.query;
  const articles = articleOps.all(
    feedId ? parseInt(feedId) : null,
    unreadOnly === 'true'
  );
  res.json(articles);
});

router.patch('/:id/read',
  validateParams(z.object({ id: z.string().regex(/^\d+$/, 'Invalid article ID') })),
  validateBody(UpdateReadStatusRequestSchema),
  (req, res) => {
  const { isRead } = req.body;
  articleOps.updateRead(parseInt(req.params.id), isRead);
  res.json({ success: true });
});

router.patch('/:id/saved',
  validateParams(z.object({ id: z.string().regex(/^\d+$/, 'Invalid article ID') })),
  validateBody(UpdateSavedStatusRequestSchema),
  (req, res) => {
  const { isSaved } = req.body;
  articleOps.updateSaved(parseInt(req.params.id), isSaved);
  res.json({ success: true });
});

export default router;
