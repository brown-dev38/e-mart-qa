import { readFile } from "node:fs/promises";
import { auth } from "@/lib/auth";
import { qualityRevisionFile } from "@/lib/quality-document-workflow";
import { qualityFilePath, verifiedSubmissionBytes } from "@/lib/quality-document-files";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  try {
    const { id } = await context.params;
    const file = await qualityRevisionFile(id, session.user.id);
    const data = file.evidence
      ? await verifiedSubmissionBytes({ file_path: file.path, file_sha256: file.hash })
      : await readFile(qualityFilePath(file.path));
    return new Response(data, { headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch { return new Response("Not found", { status: 404 }); }
}
