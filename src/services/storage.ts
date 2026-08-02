import { File, Paths } from 'expo-file-system';

import { STORAGE_BUCKET, USE_MOCK_DATA } from '@/constants/config';
import { supabase } from '@/lib/supabase';
import { mockSignedUrl, mockUploadImage } from '@/mocks/backend';

/**
 * SDK 54 replaced the `FileSystem.readAsStringAsync` + `EncodingType` API with
 * the `File` class. `bytes()` hands back a Uint8Array directly, which is what
 * supabase-js wants for an upload — so the hand-rolled base64 decoder this file
 * used to carry is gone.
 */

/** Uploads a local image to receipts/<userId>/<uuid>.<ext>; returns the path. */
export async function uploadReceiptImage(userId: string, localUri: string): Promise<string> {
  if (USE_MOCK_DATA) return mockUploadImage(localUri);

  const ext = (localUri.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const contentType = ext === 'png' ? 'image/png' : ext === 'pdf' ? 'application/pdf' : 'image/jpeg';

  const bytes = await new File(localUri).bytes();

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, bytes, { contentType, upsert: false });
  if (error) throw error;

  return path;
}

/** Base64 of a local file, for handing to the OCR provider without a round trip. */
export function readAsBase64(localUri: string): Promise<string> {
  return new File(localUri).base64();
}

export async function signedReceiptUrl(path: string, expiresInSeconds = 3600): Promise<string> {
  if (USE_MOCK_DATA) return mockSignedUrl(path);

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * A local file for the system share sheet.
 *
 * Sharing needs a real file on disk: a signed https URL would be shared as a
 * link that expires in an hour and that the recipient cannot open at all (the
 * bucket is private). So the image is copied into the cache directory first.
 *
 * Nothing is uploaded — this only ever reads. The cache directory is the right
 * home because the OS may reclaim it, and a re-share simply downloads again.
 * A file already fetched is reused rather than downloaded twice.
 */
export async function localCopyForSharing(path: string): Promise<string> {
  const url = await signedReceiptUrl(path);

  // Mock mode hands the local uri straight back, and a freshly captured photo
  // is already on disk — either way there is nothing to fetch.
  if (url.startsWith('file://')) return url;

  const name = path.split('/').pop() || `receipt-${Date.now()}.jpg`;
  const cached = new File(Paths.cache, name);
  if (cached.exists) return cached.uri;

  const downloaded = await File.downloadFileAsync(url, cached);
  return downloaded.uri;
}

export async function deleteReceiptImage(path: string): Promise<void> {
  if (USE_MOCK_DATA) return;

  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  if (error) throw error;
}
