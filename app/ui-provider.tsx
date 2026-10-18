"use client";

import { ConfigProvider, type ThemeConfig } from "antd";
import thTH from "antd/locale/th_TH";
import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { Toaster } from "react-hot-toast";

const theme: ThemeConfig = {
  token: {
    colorPrimary: "#016d53",
    colorInfo: "#016d53",
    colorSuccess: "#016d53",
    colorText: "#0a2a20",
    colorTextSecondary: "#596f68",
    colorBorder: "#d5e2dc",
    colorBorderSecondary: "#dfe7e2",
    colorBgLayout: "#f4f7f5",
    borderRadius: 10,
    borderRadiusLG: 16,
    controlHeight: 40,
    fontFamily: "var(--font-inter), var(--font-kanit), sans-serif",
    fontSize: 14,
    fontWeightStrong: 600,
  },
  components: {
    Button: { primaryShadow: "none", defaultShadow: "none" },
    Card: { headerFontSize: 16 },
    Menu: {
      darkItemBg: "#0a2e24",
      darkSubMenuItemBg: "#0a2e24",
      darkItemColor: "#b1c7be",
      darkGroupTitleColor: "#88a69a",
      darkItemSelectedBg: "#1d4c3a",
      darkItemSelectedColor: "#c7eed8",
      darkItemHoverBg: "#163c30",
      darkItemHoverColor: "#ffffff",
      itemHeight: 44,
      itemBorderRadius: 10,
      itemMarginInline: 0,
      iconSize: 20,
    },
    Layout: { siderBg: "#0a2e24", bodyBg: "#f4f7f5" },
  },
};

export default function UIProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider locale={thTH} theme={theme}>
      {children}
      <Toaster
        position="top-right"
        containerClassName="qa-toaster"
        containerStyle={{ zIndex: 2000 }}
        toastOptions={{
          className: "qa-toast",
          duration: 4000,
          style: {
            maxWidth: "min(420px, calc(100vw - 32px))",
            padding: "12px 16px",
            border: "1px solid #d5e2dc",
            borderRadius: 12,
            background: "#ffffff",
            color: "#0a2a20",
            fontFamily: "var(--font-inter), var(--font-kanit), sans-serif",
            fontSize: 14,
            lineHeight: 1.6,
            overflowWrap: "anywhere",
            boxShadow: "0 8px 30px rgba(10, 42, 32, 0.12)",
          },
          success: {
            icon: (
              <CircleCheck
                size={20}
                className="shrink-0 text-accent"
                aria-hidden="true"
              />
            ),
          },
          error: {
            duration: 5000,
            icon: (
              <CircleAlert
                size={20}
                className="shrink-0 text-danger"
                aria-hidden="true"
              />
            ),
          },
          loading: {
            icon: (
              <LoaderCircle
                size={20}
                className="shrink-0 animate-spin text-accent"
                aria-hidden="true"
              />
            ),
          },
        }}
      />
    </ConfigProvider>
  );
}
