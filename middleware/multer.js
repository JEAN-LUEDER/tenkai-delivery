/**
 * middleware/multer.js
 * Configuração do Multer usando memória (não salva no disco).
 * O buffer é enviado diretamente para o Supabase Storage.
 */

import multer from 'multer';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE      = 5 * 1024 * 1024; // 5 MB

export const upload = multer({
  storage: multer.memoryStorage(), // ← buffer em memória, vai pro Supabase
  limits:  { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato não suportado. Use JPG, PNG, WebP ou GIF.'));
    }
  }
});
