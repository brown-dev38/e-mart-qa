import type { Metadata } from "next";
import { Inter, Kanit } from "next/font/google";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { Suspense } from "react";
import UIProvider from "./ui-provider";
import "./globals.css";

const kanit = Kanit({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-kanit",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  adjustFontFallback: false,
  display: "swap",
});

export const metadata: Metadata = {
  title: "e-SMART QA · ระบบบริหารคุณภาพ คณะแพทยศาสตร์",
  description:
    "ระบบบริหารคุณภาพการศึกษา คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา ทะเบียนเอกสาร หลักฐาน และรายงานประเมินตนเอง",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${kanit.variable} ${inter.variable} h-full`}>
      <body className="min-h-full">
        <Suspense
          fallback={
            <div
              role="status"
              className="flex min-h-dvh items-center justify-center text-sm text-muted"
            >
              กำลังโหลดระบบ…
            </div>
          }
        >
          <AntdRegistry layer>
            <UIProvider>{children}</UIProvider>
          </AntdRegistry>
        </Suspense>
      </body>
    </html>
  );
}
