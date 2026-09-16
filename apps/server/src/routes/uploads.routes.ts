import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import { upload, uploadToStorage } from '../lib/upload.js';

export const uploadsRouter = Router();

uploadsRouter.post('/', requireAuth, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(422).json({ error: err.message });
    if (!req.file) return res.status(422).json({ error: 'No file uploaded.' });

    try {
      return res.status(201).json({ url: await uploadToStorage(req.file) });
    } catch {
      return res.status(502).json({ error: 'Upload failed — please try again.' });
    }
  });
});
