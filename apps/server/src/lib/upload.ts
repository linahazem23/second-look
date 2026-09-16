import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Files used to be written to local disk, which Render's free web service
// wipes on every restart/redeploy (no persistent disk on that plan) — that's
// why uploaded photos kept disappearing. Storage now lives in a Neon Object
// Storage bucket, which persists independently of the app server.
const BUCKET = 'uploads';
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  forcePathStyle: true
});

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/webm'
]);
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB (covers short video clips)

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WEBP, GIF images or MP4, MOV, WEBM videos are allowed.'));
    }
    cb(null, true);
  }
});

/**
 * Pushes an in-memory uploaded file to the (public-read) Neon Object Storage
 * bucket and returns the URL to store on the record — no signing needed on
 * read since the bucket itself is public.
 */
export async function uploadToStorage(file: Express.Multer.File): Promise<string> {
  const ext = path.extname(file.originalname).toLowerCase();
  const key = `${crypto.randomUUID()}${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype
  }));

  return `${process.env.AWS_ENDPOINT_URL_S3}/${BUCKET}/${key}`;
}
