import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import { upload, uploadedFileUrl } from '../lib/upload.js';

export const uploadsRouter = Router();

uploadsRouter.post('/', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(422).json({ error: err.message });
    if (!req.file) return res.status(422).json({ error: 'No file uploaded.' });

    return res.status(201).json({ url: uploadedFileUrl(req, req.file.filename) });
  });
});
