/**
 * lib/supabase.js
 * Cliente Supabase para Storage (upload de imagens).
 * Usa a service_role key para operações de admin.
 */

import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Nome do bucket para imagens de produtos
export const BUCKET = 'tenkai-images';

/**
 * Faz upload de um arquivo para o Supabase Storage.
 * @param {Buffer} buffer - conteúdo do arquivo
 * @param {string} filename - nome do arquivo (ex: item_123.jpg)
 * @param {string} mimetype - tipo MIME (ex: image/jpeg)
 * @returns {Promise<string>} URL pública do arquivo
 */
export async function uploadImage(buffer, filename, mimetype) {
  const path = `uploads/${filename}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mimetype, upsert: true });

  if (error) throw new Error(`Upload falhou: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Remove um arquivo do Supabase Storage.
 * @param {string} url - URL pública do arquivo
 */
export async function deleteImage(url) {
  if (!url) return;
  try {
    // Extrai o path da URL pública
    const path = url.split(`${BUCKET}/`)[1];
    if (path) await supabase.storage.from(BUCKET).remove([path]);
  } catch (e) {
    console.warn('[Storage] Erro ao deletar imagem:', e.message);
  }
}
