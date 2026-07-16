// Almacenamiento de estado en Vercel Blob (token acotado SOLO a este store —
// BLOB_READ_WRITE_TOKEN, auto-provisionado al linkar el store wellness-state).
// Sustituye al viejo hack de env-vars-como-KV que exigía un token de cuenta
// (y que llevaba 18 días muerto con un token inválido, fallando en silencio).
// Los archivos con "_" en /api no se exponen como rutas.
import { put, list } from '@vercel/blob';

export async function blobSet(pathname, obj) {
  return put(pathname, JSON.stringify(obj), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: 'application/json',
  });
}

export async function blobMeta(pathname) {
  const { blobs } = await list({ prefix: pathname, limit: 5 });
  return blobs.find(b => b.pathname === pathname) || null;
}

export async function blobGet(pathname) {
  const b = await blobMeta(pathname);
  if (!b) return null;
  // cache-buster: las URLs públicas de Blob van por CDN; el query param fuerza lectura fresca
  const r = await fetch(`${b.url}?t=${Date.now()}`);
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

export const SUB_PATH = 'state/subscription.json';
export const WORK_PATH = 'state/work-mode.json';

export async function getSubscription() {
  return blobGet(SUB_PATH);
}
