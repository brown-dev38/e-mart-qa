import { auth } from "@/lib/auth";
import SignOutButton from "./sign-out-button";

export const instant = false;

const roleLabel: Record<string, string> = {
  admin: "ผู้ดูแลระบบ",
  staff: "เจ้าหน้าที่",
  user: "ผู้ใช้งาน",
};

export default async function Home() {
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
  const roleText = role ? roleLabel[role] ?? role : "ไม่ระบุบทบาท";

  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between gap-4 border-b border-line bg-paper px-6 py-4 sm:px-10">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
            คณะแพทยศาสตร์ · มหาวิทยาลัยพะเยา
          </p>
          <p className="text-lg font-semibold tracking-tight text-ink">e-SMART QA</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-ink">{name}</p>
            <p className="text-[12px] text-muted">{roleText}</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-14 sm:px-10">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">ยินดีต้อนรับ</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">เข้าสู่ระบบสำเร็จ</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          บัญชี <span className="font-medium text-ink">{name}</span> ได้รับสิทธิ์ในระดับ {roleText}
          ระบบงานหลัก (SAR, กระบวนการ, ตัวชี้วัด, เอกสารคุณภาพ) จะแสดงในส่วนถัดไป
        </p>
      </main>
    </div>
  );
}
