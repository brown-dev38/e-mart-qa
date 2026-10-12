import Image from "next/image";
import LoginForm from "./login-form";

const proof = [
  ["เกณฑ์อ้างอิง", "WFME องค์ประกอบ 1–8 · 32 หัวข้อ"],
  ["ทะเบียนเอกสาร", "คู่มือ ระเบียบปฏิบัติ วิธีปฏิบัติงาน และหลักฐาน"],
  ["รายงานประเมินตนเอง", "SAR ระดับคณะและหน่วยงาน หลายปีการศึกษา"],
  ["ตัวชี้วัดและ CQI", "ผลลัพธ์ เป้าหมาย และการปรับปรุงที่ต่อเนื่อง"],
];

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden flex-col justify-between bg-ink px-12 py-14 text-white/90 lg:flex xl:px-16">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">
            คณะแพทยศาสตร์ · มหาวิทยาลัยพะเยา
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-white">e-SMART QA</p>
        </div>

        <div className="max-w-md">
          <h2 className="text-[1.9rem] font-semibold leading-[1.35] text-white">
            ระบบบริหารคุณภาพการศึกษา
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/65">
            ศูนย์รวมทะเบียนเอกสาร หลักฐาน และผลการดำเนินงาน สำหรับการประเมินคุณภาพตามเกณฑ์ WFME
          </p>

          <dl className="mt-10 border-t border-white/15">
            {proof.map(([term, detail]) => (
              <div
                key={term}
                className="grid grid-cols-[9rem_1fr] gap-4 border-b border-white/10 py-3.5"
              >
                <dt className="text-[12.5px] text-white/55">{term}</dt>
                <dd className="text-[13.5px] text-white/85">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="text-[12px] text-white/45">
          เข้าถึงตามสิทธิ์ของบัญชี · บันทึกการใช้งานตามนโยบายของคณะ
        </p>
      </aside>

      <main className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-[400px] lg:mx-0">
          <div className="mb-9">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted lg:hidden">
              คณะแพทยศาสตร์ · มหาวิทยาลัยพะเยา
            </p>
            {/* <Image
              src="/logo.png"
              alt="e-SMART QA ระบบบริหารคุณภาพ คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา"
              width={170}
              height={30}
              priority
              className="mt-2 h-auto w-[170px] lg:mt-0"
            /> */}
          </div>

          <LoginForm />
        </div>
      </main>
    </div>
  );
}
