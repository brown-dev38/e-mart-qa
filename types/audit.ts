export const AUDIT_ACTIONS = {
  CREATE: "เพิ่มข้อมูล", UPDATE: "แก้ไขข้อมูล", DELETE: "ลบข้อมูล",
  REVISION_CREATE: "สร้างฉบับร่าง", EDIT: "แก้ไขฉบับร่าง", SUBMIT: "ส่งตรวจ",
  RETURN: "ส่งกลับแก้ไข", APPROVE: "อนุมัติ", LOGIN: "เข้าสู่ระบบ", LOGOUT: "ออกจากระบบ",
  REVIEW: "ทบทวนผ่าน", EFFECTIVE: "มีผลใช้บังคับ", REGISTRY_UPDATE: "แก้ทะเบียน", WITHDRAW: "ยกเลิกใช้",
} as const;
export const AUDIT_ENTITIES = {
  QUALITY_DOCUMENT: "เอกสารคุณภาพ", WORK_DOCUMENT: "เอกสารตามงาน", MASTER_DATA: "ข้อมูลพื้นฐาน",
  USER: "บัญชีผู้ใช้", USER_DEPARTMENT: "สังกัดผู้ใช้", POSITION: "ตำแหน่ง", AUTH: "การเข้า–ออกระบบ",
} as const;
export type AuditFilter = { search?: string; action?: string; entityType?: string; outcome?: string; from?: string; to?: string; page?: number };
export type AuditItem = {
  id: string; actorId: string | null; actorName: string; action: string; entityType: string;
  entityId: string | null; entityLabel: string | null; outcome: string; summary: string;
  details: unknown; createdAt: string;
};
export type AuditPage = { items: AuditItem[]; total: number; page: number; pageSize: number };
export type DeletionItem = {
  id: string; code: string; title: string; status: string; version: string; department: string;
  token: string; deletedAt: string | null; deletedBy: string | null; reason: string | null;
};
export type DeleteQualityCommand = { id: string; token: string; confirmationCode: string; reason: string };
