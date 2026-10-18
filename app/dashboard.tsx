"use client";

import { useEffect, useRef, useState } from "react";
import {
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Layout,
  Menu,
  Tag,
  type MenuProps,
} from "antd";
import {
  ArrowRight,
  Building2,
  ChevronDown,
  FilePlus2,
  Files,
  FolderOpen,
  LayoutDashboard,
  Menu as MenuIcon,
  ScrollText,
  X,
} from "lucide-react";
import SignOutButton from "./sign-out-button";
import DepartmentDocuments, {
  workTypes,
  type DepartmentSelection,
} from "./department-documents";
import { curricula } from "@/lib/quality-documents";
import QualityDocumentForm from "./quality-document-form";
import "./dashboard.css";

const documentPages = [
  {
    id: "documents-create",
    title: "เพิ่มเอกสารคุณภาพ",
    description: "พื้นที่สำหรับเพิ่มและขึ้นทะเบียนเอกสารคุณภาพ",
    icon: FilePlus2,
    path: ["การจัดเอกสารคุณภาพ", "เพิ่มเอกสารคุณภาพ"],
    parents: ["documents"],
  },
  {
    id: "documents-all",
    title: "เอกสารคุณภาพทั้งหมด",
    description: "รวมเอกสารคุณภาพจากทุกหน่วยงาน",
    icon: Files,
    path: ["การจัดเอกสารคุณภาพ", "เอกสารคุณภาพทั้งหมด"],
    parents: ["documents"],
  },
  {
    id: "documents-departments",
    title: "แยกตามหน่วยงาน",
    description: "ดูเอกสารคุณภาพตามหลักสูตรและประเภทงาน",
    icon: Building2,
    path: ["การจัดเอกสารคุณภาพ", "แยกตามหน่วยงาน"],
    parents: ["documents"],
  },
  {
    id: "regulations",
    title: "กฎระเบียบข้อบังคับ",
    description: "พื้นที่รวบรวมกฎ ระเบียบ และข้อบังคับที่เกี่ยวข้อง",
    icon: ScrollText,
    path: ["กฎระเบียบข้อบังคับ"],
    parents: [],
  },
] as const;

type Section = "overview" | "account" | (typeof documentPages)[number]["id"];
type UserInfo = { name: string; role: string };

type NavigationState = DepartmentSelection & {
  section: Section;
  openKeys: string[];
};

const defaultNavigation: NavigationState = {
  section: "overview",
  openKeys: [],
  curriculum: null,
  workType: null,
};
const submenuKeys = new Set<string>(
  documentPages.flatMap((page) => [...page.parents]),
);

function readNavigation(storageKey: string): NavigationState {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(storageKey) ?? "null",
    );
    if (!saved || typeof saved !== "object") return defaultNavigation;

    const { section, openKeys, curriculum, workType } = saved as Record<
      string,
      unknown
    >;
    const migratedSection = [
      "documents-teaching",
      "documents-assessment",
      "documents-admissions",
      "documents-curriculum",
    ].includes(String(section))
      ? "documents-departments"
      : section;
    const validSection =
      migratedSection === "overview" ||
      migratedSection === "account" ||
      documentPages.some((page) => page.id === migratedSection);
    const validCurriculum = curricula.some((item) => item.value === curriculum);

    return {
      section: validSection ? (migratedSection as Section) : "overview",
      curriculum: validCurriculum
        ? (curriculum as DepartmentSelection["curriculum"])
        : null,
      workType:
        validCurriculum && workTypes.some((item) => item.value === workType)
          ? (workType as DepartmentSelection["workType"])
          : null,
      openKeys: Array.isArray(openKeys)
        ? [
            ...new Set(
              openKeys.filter(
                (key): key is string =>
                  typeof key === "string" && submenuKeys.has(key),
              ),
            ),
          ]
        : [],
    };
  } catch {
    return defaultNavigation;
  }
}

const navigationItems: MenuProps["items"] = [
  {
    type: "group",
    label: "WORKSPACE",
    children: [
      {
        key: "overview",
        icon: <LayoutDashboard size={20} aria-hidden="true" />,
        label: "ภาพรวม Dashboard",
      },
    ],
  },
  {
    type: "group",
    label: "ระบบงานคุณภาพ",
    children: [
      {
        key: "documents",
        icon: <FolderOpen size={20} aria-hidden="true" />,
        label: "การจัดเอกสารคุณภาพ",
        children: [
          {
            key: "documents-create",
            icon: <FilePlus2 size={16} aria-hidden="true" />,
            label: "เพิ่มเอกสารคุณภาพ",
          },
          {
            key: "documents-all",
            icon: <Files size={16} aria-hidden="true" />,
            label: "เอกสารคุณภาพทั้งหมด",
          },
          {
            key: "documents-departments",
            icon: <Building2 size={16} aria-hidden="true" />,
            label: "แยกตามหน่วยงาน",
          },
        ],
      },
      {
        key: "regulations",
        icon: <ScrollText size={20} aria-hidden="true" />,
        label: "กฎระเบียบข้อบังคับ",
      },
    ],
  },
];

function Sidebar({
  section,
  onNavigate,
  openKeys,
  onOpenChange,
  name,
  role,
  onClose,
}: UserInfo & {
  section: Section;
  onNavigate: (section: Section) => void;
  openKeys: string[];
  onOpenChange: (keys: string[]) => void;
  onClose?: () => void;
}) {
  return (
    <div className="qa-sidebar-content">
      <div className="flex items-center justify-between gap-3 px-6 pb-7 pt-8">
        <button
          type="button"
          onClick={() => onNavigate("overview")}
          className="flex items-center gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-sm font-bold text-white">
            QA<span className="text-[#8cdbb8]">.</span>
          </span>
          <span>
            <span className="block text-lg font-semibold tracking-tight text-white">
              e-SMART QA
            </span>
            <span className="block text-[10px] tracking-[0.14em] text-white/55">
              QUALITY MANAGEMENT
            </span>
          </span>
        </button>
        {onClose && (
          <Button
            type="text"
            onClick={onClose}
            aria-label="ปิดเมนู"
            icon={<X size={20} aria-hidden="true" />}
            className="qa-sidebar-close"
          />
        )}
      </div>

      <div className="mx-5 rounded-xl border border-white/10 bg-white/5 px-4 py-3.5">
        <p className="text-[13px] font-medium text-white/90">คณะแพทยศาสตร์</p>
        <p className="mt-1 text-xs text-white/55">มหาวิทยาลัยพะเยา</p>
      </div>

      <nav aria-label="เมนูหลัก" className="qa-sidebar-nav">
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[section]}
          openKeys={openKeys}
          onOpenChange={onOpenChange}
          inlineIndent={12}
          expandIcon={
            <ChevronDown
              size={14}
              className="qa-menu-chevron"
              aria-hidden="true"
            />
          }
          items={navigationItems}
          onClick={({ key }) => onNavigate(key as Section)}
        />
      </nav>

      <div className="border-t border-white/10 p-4">
        <Button
          type="text"
          block
          onClick={() => onNavigate("account")}
          aria-current={section === "account" ? "page" : undefined}
          className="qa-account-button"
        >
          <Avatar className="qa-sidebar-avatar" size={36}>
            {Array.from(name)[0]?.toUpperCase()}
          </Avatar>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-[13px]">{name}</span>
            <span className="mt-0.5 block truncate text-[11px] font-normal text-white/55">
              {role}
            </span>
          </span>
          <ArrowRight size={16} aria-hidden="true" />
        </Button>
        <div className="mt-3">
          <SignOutButton className="qa-sign-out" />
        </div>
      </div>
    </div>
  );
}

function AccountDetails({ name, role }: UserInfo) {
  return (
    <Descriptions
      size="small"
      column={1}
      layout="vertical"
      items={[
        {
          key: "name",
          label: "ชื่อผู้ใช้งาน",
          children: <span className="break-words">{name}</span>,
        },
        { key: "role", label: "บทบาทในระบบ", children: role },
      ]}
    />
  );
}

export default function Dashboard({
  userId,
  name,
  role,
}: UserInfo & { userId: string }) {
  const storageKey = `e-smart-qa:dashboard:${userId}`;
  const [navigation, setNavigation] =
    useState<NavigationState>(defaultNavigation);
  const [restoredKey, setRestoredKey] = useState<string | null>(null);
  const { section, openKeys } = navigation;
  const [menuOpen, setMenuOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusAfterClose = useRef(false);
  const menuTrigger = useRef<HTMLElement>(null);
  const wasMenuOpen = useRef(false);
  const selectedPage = documentPages.find((item) => item.id === section);
  const title =
    selectedPage?.title ??
    (section === "account" ? "บัญชีผู้ใช้งาน" : "ภาพรวม Dashboard");

  useEffect(() => {
    setNavigation(readNavigation(storageKey));
    setRestoredKey(storageKey);
  }, [storageKey]);

  function rememberNavigation(next: NavigationState) {
    setNavigation(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Navigation still works when browser storage is unavailable.
    }
  }

  function changeOpenKeys(keys: string[]) {
    rememberNavigation({ ...navigation, openKeys: keys });
  }

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (menuOpen) {
      wasMenuOpen.current = true;
      return;
    }
    if (!wasMenuOpen.current) return;
    wasMenuOpen.current = false;
    const target = focusAfterClose.current
      ? heading.current
      : menuTrigger.current;
    focusAfterClose.current = false;
    const frame = requestAnimationFrame(() => target?.focus());
    return () => cancelAnimationFrame(frame);
  }, [menuOpen]);

  function navigate(next: Section) {
    const page = documentPages.find((item) => item.id === next);
    rememberNavigation({
      ...navigation,
      section: next,
      openKeys: page?.parents.length
        ? [...new Set([...openKeys, ...page.parents])]
        : openKeys,
    });
    if (menuOpen) {
      focusAfterClose.current = true;
      setMenuOpen(false);
    } else {
      requestAnimationFrame(() => heading.current?.focus());
    }
  }

  if (restoredKey !== storageKey) {
    return (
      <div
        role="status"
        className="flex min-h-dvh items-center justify-center text-sm text-muted"
      >
        กำลังโหลดพื้นที่ทำงาน…
      </div>
    );
  }

  return (
    <Layout hasSider className="qa-dashboard">
      <a href="#dashboard-content" className="qa-skip-link">
        ข้ามไปยังเนื้อหา
      </a>
      <Layout.Sider width={272} className="qa-sidebar">
        <Sidebar
          section={section}
          onNavigate={navigate}
          openKeys={openKeys}
          onOpenChange={changeOpenKeys}
          name={name}
          role={role}
        />
      </Layout.Sider>
      <Drawer
        id="dashboard-menu"
        title="เมนูนำทาง"
        placement="left"
        size={320}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        closable={false}
        destroyOnHidden
        rootClassName="qa-mobile-drawer"
        focusable={{ trap: true, focusTriggerAfterClose: false }}
        styles={{
          header: { display: "none" },
          body: { padding: 0, overflow: "hidden", background: "#0a2e24" },
          section: { maxWidth: "100vw" },
        }}
      >
        <Sidebar
          section={section}
          onNavigate={navigate}
          openKeys={openKeys}
          onOpenChange={changeOpenKeys}
          name={name}
          role={role}
          onClose={() => setMenuOpen(false)}
        />
      </Drawer>

      <Layout className="qa-workspace">
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-line/70 bg-paper px-5 sm:px-8 lg:px-10">
          <div className="flex min-w-0 flex-1 items-center gap-3 py-4">
            <Button
              onClick={(event) => {
                menuTrigger.current = event.currentTarget;
                setMenuOpen(true);
              }}
              aria-label="เปิดเมนูนำทาง"
              aria-controls="dashboard-menu"
              aria-expanded={menuOpen}
              aria-haspopup="dialog"
              icon={<MenuIcon size={20} aria-hidden="true" />}
              className="qa-mobile-menu-button"
            />
            <Breadcrumb
              className="qa-breadcrumb"
              items={[
                {
                  title: (
                    <span className="qa-breadcrumb-parent">พื้นที่ทำงาน</span>
                  ),
                },
                ...(selectedPage ? selectedPage.path : [title]).map(
                  (label) => ({ title: label }),
                ),
              ]}
            />
          </div>
          <Button
            type="text"
            onClick={() => navigate("account")}
            className="qa-header-account"
            aria-label={`บัญชีผู้ใช้งาน ${name}`}
          >
            <span className="hidden min-w-0 text-right sm:block">
              <span className="block max-w-40 truncate text-[13px] font-medium">
                {name}
              </span>
              <span className="block max-w-40 truncate text-[11px] text-muted">
                {role}
              </span>
            </span>
            <Avatar className="qa-user-avatar" size={36}>
              {Array.from(name)[0]?.toUpperCase()}
            </Avatar>
          </Button>
        </header>

        <main
          id="dashboard-content"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-5 py-7 outline-none sm:px-8 sm:py-9 lg:px-10"
        >
          <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-accent">
                E-SMART QA WORKSPACE
              </p>
              <h1
                ref={heading}
                tabIndex={-1}
                className="text-2xl font-semibold tracking-tight outline-none sm:text-[28px]"
              >
                {title}
              </h1>
              {section !== "overview" && (
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {selectedPage?.description ??
                    "ข้อมูลบัญชีและบทบาทการใช้งานระบบของคุณ"}
                </p>
              )}
            </div>
            <Tag className="qa-role-tag">
              <Badge status="success" text={role} />
            </Tag>
          </div>

          {section === "documents-departments" && (
            <DepartmentDocuments
              selection={{
                curriculum: navigation.curriculum,
                workType: navigation.workType,
              }}
              onChange={(selection) =>
                rememberNavigation({ ...navigation, ...selection })
              }
            />
          )}

          {section === "documents-create" && (
            <QualityDocumentForm userId={userId} />
          )}

          {selectedPage &&
            section !== "documents-departments" &&
            section !== "documents-create" && (
              <Card className="qa-pending-card mb-9">
                <Empty
                  image={
                    <selectedPage.icon
                      size={56}
                      strokeWidth={1.5}
                      className="text-accent"
                      aria-hidden="true"
                    />
                  }
                  description={
                    <>
                      <Tag className="mb-4">เตรียมเปิดใช้งาน</Tag>
                      <h2 className="text-lg font-semibold">
                        {selectedPage.title}
                      </h2>
                      <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted">
                        ระบบงานนี้อยู่ระหว่างการพัฒนา เมื่อเปิดใช้งานแล้ว
                        คุณจะสามารถจัดการข้อมูลได้จากพื้นที่นี้
                      </p>
                    </>
                  }
                >
                  <Button onClick={() => navigate("overview")}>
                    กลับไปภาพรวม Dashboard
                  </Button>
                </Empty>
              </Card>
            )}

          {section === "account" && (
            <Card className="mb-9 max-w-2xl">
              <div className="mb-7 flex items-center gap-4">
                <Avatar shape="square" size={56} className="qa-user-avatar">
                  {Array.from(name)[0]?.toUpperCase()}
                </Avatar>
                <div className="min-w-0">
                  <h2 className="break-words text-lg font-semibold">{name}</h2>
                  <p className="mt-1 text-xs text-muted">
                    บัญชีผู้ใช้งาน e-SMART QA
                  </p>
                </div>
              </div>
              <AccountDetails name={name} role={role} />
              <p className="mt-5 border-t border-line pt-5 text-xs leading-6 text-muted">
                หากต้องการแก้ไขข้อมูลบัญชีหรือสิทธิ์การใช้งาน
                กรุณาติดต่อผู้ดูแลระบบของคณะ
              </p>
            </Card>
          )}

          <footer className="mt-auto flex flex-wrap justify-between gap-2 border-t border-line/80 pt-5 text-[10px] text-muted">
            <span>e-SMART QA · ระบบบริหารคุณภาพการศึกษา</span>
            <span>คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา</span>
          </footer>
        </main>
      </Layout>
    </Layout>
  );
}
