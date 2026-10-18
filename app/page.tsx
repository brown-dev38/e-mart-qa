import { auth } from "@/lib/auth";
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

  return (
    <Dashboard
      userId={session.user.id}
      name={name || "ผู้ใช้งาน"}
      role={roleText}
    />
  );
}
