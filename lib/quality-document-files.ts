import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const DIRECTORY = path.join(process.cwd(), "storage", "qa-documents");
const EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx"]);

export function qualityFilePath(value: string): string {
  // Accept only application-owned paths, including files uploaded before migration.
  const prefix = value.startsWith("/uploads/qa-documents/")
    ? "/uploads/qa-documents/" : "storage/qa-documents/";
  const name = value.slice(prefix.length);
  if (!value.startsWith(prefix) || !name || name !== path.basename(name) || /[\\/]/.test(name)) {
    throw new Error("เส้นทางไฟล์ไม่ถูกต้อง");
  }
  return prefix.startsWith("/")
    ? path.join(process.cwd(), "public", "uploads", "qa-documents", name)
    : path.join(DIRECTORY, name);
}

export async function storeQualityFile(entry: FormDataEntryValue | null) {
  if (!(entry instanceof File) || entry.size === 0) return null;
  if (entry.size > 20 * 1024 * 1024) throw new Error("ไฟล์ต้องมีขนาดไม่เกิน 20 MB");
  const extension = path.extname(entry.name).toLowerCase();
  if (!EXTENSIONS.has(extension)) throw new Error("รองรับเฉพาะไฟล์ PDF, Word และ Excel");
  const name = `${randomUUID()}${extension}`;
  await mkdir(DIRECTORY, { recursive: true });
  const destination = path.join(DIRECTORY, name);
  try {
    await writeFile(destination, Buffer.from(await entry.arrayBuffer()));
  } catch (error) {
    await unlink(destination).catch(() => undefined);
    throw error;
  }
  return {
    file_path: `storage/qa-documents/${name}`,
    file_name: entry.name.slice(0, 255),
    file_mime_type: entry.type?.slice(0, 100) || null,
    file_size_bytes: BigInt(entry.size),
  };
}

export async function removeQualityFile(value: string) {
  await unlink(qualityFilePath(value)).catch(() => undefined);
}

export function revisionFileUrl(id: bigint | string) {
  return `/api/quality-documents/revisions/${id}/file`;
}

export function submissionFileUrl(id: bigint | string) {
  return `/api/quality-documents/submissions/${id}/file`;
}

export function revisionReviewFileUrl(id: bigint | string) {
  return `${revisionFileUrl(id)}?purpose=review`;
}

export function submissionReviewFileUrl(id: bigint | string) {
  return `${submissionFileUrl(id)}?purpose=review`;
}

export async function snapshotQualityFile(source: string) {
  let buffer: Buffer;
  try { buffer = await readFile(qualityFilePath(source)); }
  catch { throw new Error("ไม่พบไฟล์ส่งตรวจ กรุณาแนบไฟล์ฉบับร่างอีกครั้ง"); }
  if (!buffer.length || buffer.length > 20 * 1024 * 1024) throw new Error("ไฟล์ส่งตรวจต้องมีขนาดไม่เกิน 20 MB และต้องไม่ว่าง");
  const extension = path.extname(source).toLowerCase();
  if (!EXTENSIONS.has(extension)) throw new Error("ไฟล์ส่งตรวจไม่ใช่ประเภทที่รองรับ");
  const name = `${randomUUID()}${extension}`;
  const destination = path.join(DIRECTORY, name);
  await mkdir(DIRECTORY, { recursive: true });
  try { await writeFile(destination, buffer, { flag: "wx" }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") await unlink(destination).catch(() => undefined);
    throw error;
  }
  return {
    file_path: `storage/qa-documents/${name}`,
    file_size_bytes: BigInt(buffer.length),
    file_sha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

export async function verifiedSubmissionBytes(file: { file_path: string; file_sha256: string | null }) {
  const buffer = await readFile(qualityFilePath(file.file_path));
  if (!file.file_sha256 || createHash("sha256").update(buffer).digest("hex") !== file.file_sha256) {
    throw new Error("ไฟล์สำเนาส่งตรวจไม่ตรงกับหลักฐานที่บันทึกไว้");
  }
  return buffer;
}
