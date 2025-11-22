import express from 'express';
import { articleOps } from '../services/database.js';

const router = express.Router();

router.get('/', (req, res) => {
  const { feedId, unreadOnly } = req.query;
  const articles = articleOps.all(
    feedId ? parseInt(feedId) : null,
    unreadOnly === 'true'
  );
  res.json(articles);
});

router.patch('/:id/read', (req, res) => {
  const { isRead } = req.body;
  articleOps.updateRead(parseInt(req.params.id), isRead);
  res.json({ success: true });
});

router.patch('/:id/saved', (req, res) => {
  const { isSaved } = req.body;
  articleOps.updateSaved(parseInt(req.params.id), isSaved);
  res.json({ success: true });
});

export default router;
