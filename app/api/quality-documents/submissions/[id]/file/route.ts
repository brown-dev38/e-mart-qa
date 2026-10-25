import { auth } from "@/lib/auth";
import { qualitySubmissionFile } from "@/lib/quality-document-workflow";
import { verifiedSubmissionBytes } from "@/lib/quality-document-files";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  try {
    const { id } = await context.params;
    const file = await qualitySubmissionFile(id, session.user.id);
    const data = await verifiedSubmissionBytes({ file_path: file.path, file_sha256: file.hash });
    return new Response(data, { headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch { return new Response("Not found", { status: 404 }); }
}
