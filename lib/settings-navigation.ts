import {
  BookOpen, Building2, CalendarDays, CalendarRange, FileStack,
  GraduationCap, Layers, ListTree, Network, Settings2, ShieldCheck,
} from "lucide-react";

export const settingsGroups = [
  {
    id: "settings-organization", title: "หน่วยงานและงานย่อย", icon: Building2,
    description: "โครงสร้างหน่วยงาน ประเภทงาน และรูปแบบเอกสารของแต่ละงาน",
  },
  {
    id: "settings-curriculum", title: "หลักสูตรและรายวิชา", icon: GraduationCap,
    description: "หลักสูตร ฉบับปรับปรุง รายวิชา และการเปิดสอน",
  },
  {
    id: "settings-academic", title: "ปีและภาคการศึกษา", icon: CalendarDays,
    description: "ปีการศึกษา ภาคเรียน และชั้นปีที่ใช้ร่วมกันในระบบ",
  },
  {
    id: "settings-quality", title: "เอกสารและเกณฑ์ประเมิน", icon: ShieldCheck,
    description: "กรอบเกณฑ์ โครงสร้างการประเมิน และระดับเอกสารคุณภาพ",
  },
] as const;

const pages = [
  { id: "settings-departments", title: "หน่วยงานหลัก", description: "กำหนดหน่วยงานหลักและรหัสหน่วยงาน", icon: Building2, group: "settings-organization", entity: "departments" },
  { id: "settings-sub-departments", title: "งานย่อยและประเภทงาน", description: "กำหนดงานภายใต้หน่วยงานและรูปแบบเอกสาร", icon: Network, group: "settings-organization", entity: "sub_departments" },
  { id: "settings-programs", title: "หลักสูตร", description: "กำหนดหลักสูตรและกรอบเกณฑ์ที่ใช้ประเมิน", icon: GraduationCap, group: "settings-curriculum", entity: "programs" },
  { id: "settings-curriculum-versions", title: "ฉบับหลักสูตร", description: "หลักสูตรใหม่และฉบับปรับปรุงของแต่ละหลักสูตร", icon: FileStack, group: "settings-curriculum", entity: "curriculum_versions" },
  { id: "settings-courses", title: "รายวิชา", description: "รหัสและชื่อรายวิชาแยกตามหลักสูตร", icon: BookOpen, group: "settings-curriculum", entity: "courses" },
  { id: "settings-course-offerings", title: "การเปิดสอนรายวิชา", description: "ผูกรายวิชากับปีการศึกษา ภาคเรียน และชั้นปี", icon: CalendarRange, group: "settings-curriculum", entity: "course_offerings" },
  { id: "settings-academic-years", title: "ปีการศึกษา", description: "กำหนดปีการศึกษา พ.ศ. สำหรับจัดเก็บเอกสาร", icon: CalendarDays, group: "settings-academic", entity: "academic_years" },
  { id: "settings-semesters", title: "ภาคการศึกษา", description: "กำหนดภาคเรียนและลำดับการแสดง", icon: CalendarRange, group: "settings-academic", entity: "semesters" },
  { id: "settings-study-years", title: "ชั้นปี", description: "กำหนดชั้นปีที่ใช้ในการเปิดสอนรายวิชา", icon: GraduationCap, group: "settings-academic", entity: "study_years" },
  { id: "settings-frameworks", title: "กรอบเกณฑ์การประเมิน", description: "จัดการกรอบเกณฑ์ WFME และ AUN", icon: ShieldCheck, group: "settings-quality", entity: "frameworks" },
  { id: "settings-criteria", title: "โครงสร้างเกณฑ์", description: "จัดหัวข้อและข้อเกณฑ์ประเมินตามลำดับชั้น", icon: ListTree, group: "settings-quality", entity: "criteria" },
  { id: "settings-levels", title: "ระดับเอกสารคุณภาพ", description: "กำหนดระดับเอกสาร QM, SP, WI, FM และ SD", icon: Layers, group: "settings-quality", entity: "document_levels" },
] as const;

export const settingsPages = pages.map((page) => ({
  ...page,
  parents: [page.group],
  path: ["ตั้งค่าข้อมูลพื้นฐาน", settingsGroups.find((group) => group.id === page.group)!.title, page.title],
}));

export type SettingsSection = (typeof settingsPages)[number]["id"];

export const settingsHomePage = {
  id: "settings-overview",
  title: "ตั้งค่าข้อมูลพื้นฐาน",
  description: "เลือกหมวดหมู่เพื่อจัดการข้อมูลที่ใช้ร่วมกันในระบบ",
  icon: Settings2,
  path: ["ตั้งค่าข้อมูลพื้นฐาน"],
  parents: [],
} as const;
