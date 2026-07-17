import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { put } from "@vercel/blob";

// Receipt & proof photo storage.
//
// Cloud (BLOB_READ_WRITE_TOKEN set, i.e. on Vercel): files go to Vercel Blob
// under an unguessable random path. They're still served only through the
// app's auth-gated routes (/api/receipts/[id], /api/proofs/[id]), which verify
// family membership before streaming the bytes.
//
// Local development (no token): files go to ./uploads (gitignored).

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const MAX_BYTES = 10 * 1024 * 1024;

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/heic": ".heic",
  "image/webp": ".webp",
};

/** Uploads an image; returns the value to store in receiptPath/proofImage. */
export async function saveReceipt(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Receipt must be an image");
  if (file.size === 0) throw new Error("Receipt image is empty");
  if (file.size > MAX_BYTES) throw new Error("Receipt image is too large (max 10 MB)");

  const ext = EXT_BY_TYPE[file.type] ?? ".jpg";
  const filename = `${crypto.randomUUID()}${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { url } = await put(`receipts/${filename}`, file, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: false,
    });
    return url;
  }

  await mkdir(UPLOADS_DIR, { recursive: true });
  await writeFile(path.join(UPLOADS_DIR, filename), Buffer.from(await file.arrayBuffer()));
  return filename;
}

/** Fetches the stored image bytes for the auth-gated serving routes. */
export async function readReceipt(
  receiptPath: string,
): Promise<{ data: Buffer; contentType: string } | null> {
  if (/^https:\/\//.test(receiptPath)) {
    try {
      const res = await fetch(receiptPath);
      if (!res.ok) return null;
      const data = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers.get("content-type") ?? "image/jpeg";
      return { data, contentType };
    } catch {
      return null;
    }
  }

  // Local path: stored values are bare filenames; reject anything that isn't.
  const filename = path.basename(receiptPath);
  if (filename !== receiptPath) return null;
  try {
    const data = await readFile(path.join(UPLOADS_DIR, filename));
    const ext = path.extname(filename).toLowerCase();
    const contentType =
      Object.entries(EXT_BY_TYPE).find(([, e]) => e === ext)?.[0] ?? "image/jpeg";
    return { data, contentType };
  } catch {
    return null;
  }
}
