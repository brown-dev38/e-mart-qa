import { auth } from "@/lib/auth";
import { loadMasterData } from "@/lib/master-data";
import { loadUserDirectory } from "@/lib/user-directory";
import { buildDocumentCatalog } from "@/lib/quality-document-catalog";
import { buildDepartmentDocumentCatalog } from "@/lib/department-documents";
import { connection } from "next/server";
import Dashboard from "./dashboard";

export const instant = false;

const roleLabel: Record<string, string> = {
  admin: "ผู้ดูแลระบบ",
  staff: "เจ้าหน้าที่",
  user: "ผู้ใช้งาน",
};

export default async function Home() {
  await connection();
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6">
        <div className="text-center">
          <p className="text-sm text-muted">ต้องเข้าสู่ระบบก่อนใช้งาน</p>
          <a
            href="/login"
            className="mt-3 inline-block text-sm font-medium text-accent underline underline-offset-4"
          >
            ไปที่หน้าเข้าสู่ระบบ
          </a>
        </div>
      </div>
    );
  }

  const { name, role } = session.user;
  const roleText = role ? (roleLabel[role] ?? role) : "ไม่ระบุบทบาท";
  const canManage = role === "admin";
  const masterData = await loadMasterData();
  const [userDirectory, documentCatalog] = await Promise.all([
    canManage ? loadUserDirectory() : Promise.resolve(null),
    Promise.resolve(buildDocumentCatalog(masterData)),
  ]);

  return (
    <Dashboard
      userId={session.user.id}
      name={name || "ผู้ใช้งาน"}
      role={roleText}
      canManage={canManage}
      settings={canManage ? masterData : null}
      userDirectory={userDirectory}
      documentCatalog={documentCatalog}
      departmentDocumentCatalog={buildDepartmentDocumentCatalog(masterData)}
    />
  );
}
