import { auth } from "@/lib/auth";
import { qualityDocumentPreview } from "@/lib/quality-document-versions";
import { ActionError } from "@/lib/current-actor";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "กรุณาเข้าสู่ระบบก่อนพรีวิวเอกสาร" }, { status: 401, headers });
  try {
    const { id } = await context.params;
    const page = new URL(request.url).searchParams.get("page") ?? "1";
    if (!/^[1-9]\d{0,5}$/.test(page)) return Response.json({ error: "เลขหน้าไม่ถูกต้อง" }, { status: 400, headers });
    // Return rendered pages/text only. The original document is never sent by this endpoint.
    return Response.json(await qualityDocumentPreview(id, session.user.id, Number(page)), { headers });
  } catch (error) {
    if (!(error instanceof ActionError)) console.error("Unable to render document preview", error);
    return Response.json({ error: "ไม่สามารถพรีวิวไฟล์ได้ ไฟล์อาจไม่พร้อมใช้งานหรือคุณไม่มีสิทธิ์เข้าถึง" }, { status: 404, headers });
  }
}
