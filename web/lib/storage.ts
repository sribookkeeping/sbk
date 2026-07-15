import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

// Receipt photo storage. Local development writes to ./uploads (gitignored).
//
// CLOUD SWAP: Vercel's filesystem is ephemeral — before deploying, replace
// these two functions with Vercel Blob (`@vercel/blob` put/fetch) and store
// the blob URL in Expense.receiptPath. See README "Deploying to the cloud".

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const MAX_BYTES = 10 * 1024 * 1024;

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/heic": ".heic",
  "image/webp": ".webp",
};

export async function saveReceipt(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Receipt must be an image");
  if (file.size === 0) throw new Error("Receipt image is empty");
  if (file.size > MAX_BYTES) throw new Error("Receipt image is too large (max 10 MB)");

  const ext = EXT_BY_TYPE[file.type] ?? ".jpg";
  const filename = `${crypto.randomUUID()}${ext}`;
  await mkdir(UPLOADS_DIR, { recursive: true });
  await writeFile(path.join(UPLOADS_DIR, filename), Buffer.from(await file.arrayBuffer()));
  return filename;
}

export async function readReceipt(
  receiptPath: string,
): Promise<{ data: Buffer; contentType: string } | null> {
  // Stored paths are bare filenames; reject anything that isn't.
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
