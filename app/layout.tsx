import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";

const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sarabun",
  display: "swap",
});

export const metadata: Metadata = {
  title: "e-SMART QA · ระบบบริหารคุณภาพ คณะแพทยศาสตร์",
  description:
    "ระบบบริหารคุณภาพการศึกษา คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา ทะเบียนเอกสาร หลักฐาน และรายงานประเมินตนเอง",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${sarabun.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
