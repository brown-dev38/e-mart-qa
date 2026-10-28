"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Switch,
  Table,
  Tag,
  type FormInstance,
  type TableProps,
} from "antd";
import {
  ArrowLeft,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import { deleteRecordAction, saveRecordAction } from "./actions";
import type {
  MasterData,
  MasterEntity,
  QaCriterion,
  WfmeStandardType,
} from "@/types/master-data";

import {
  settingsPages,
  settingsGroups,
  type SettingsSection,
} from "@/lib/settings-navigation";

export { settingsPages } from "@/lib/settings-navigation";
export type { SettingsSection } from "@/lib/settings-navigation";

const SECTION_ENTITY = Object.fromEntries(
  settingsPages.map((page) => [page.id, page.entity]),
) as Record<SettingsSection, MasterEntity>;

const WFME_LABELS: Record<WfmeStandardType, string> = {
  NONE: "ไม่ระบุ",
  BASIC: "เกณฑ์พื้นฐาน",
  QUALITY_DEV: "เกณฑ์พัฒนา",
};

const LEVEL_LABELS: Record<number, string> = {
  1: "หมวดหลัก (Area)",
  2: "หมวดย่อย (Sub-area)",
  3: "ข้อเกณฑ์ (Standard)",
};

type Row = Record<string, unknown>;
type Option = { value: string | number; label: string };
type FormValues = Record<string, unknown>;

type FieldConfig = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "switch" | "select";
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  placeholder?: string;
  options?: Option[] | ((values: FormValues) => Option[]);
  full?: boolean;
};

type EntityConfig = {
  description: string;
  addLabel: string;
  fields: FieldConfig[];
  columns: NonNullable<TableProps<Row>["columns"]>;
  defaults: FormValues;
  rows: (data: MasterData) => Row[];
};

function textColumn(
  title: string,
  key: string,
  width?: number,
): NonNullable<TableProps<Row>["columns"]>[number] {
  return {
    title,
    dataIndex: key,
    key,
    width,
    render: (value: unknown) =>
      value === null || value === undefined || value === "" ? (
        <span className="text-muted">—</span>
      ) : (
        String(value)
      ),
  };
}

function boolColumn(
  title: string,
  key: string,
  labels: [string, string] = ["ใช้งาน", "ปิดใช้งาน"],
  color = "green",
): NonNullable<TableProps<Row>["columns"]>[number] {
  return {
    title,
    dataIndex: key,
    key,
    width: 120,
    render: (value: unknown) =>
      value ? <Tag color={color}>{labels[0]}</Tag> : <Tag>{labels[1]}</Tag>,
  };
}

function buildCriteriaTree(criteria: QaCriterion[]): Row[] {
  const nodes = new Map<number, Row>();
  for (const item of criteria) {
    nodes.set(item.id, { ...item });
  }

  const roots: Row[] = [];
  for (const item of criteria) {
    const node = nodes.get(item.id)!;
    if (item.parent_id !== null && nodes.has(item.parent_id)) {
      const parent = nodes.get(item.parent_id)!;
      const children = (parent.children as Row[] | undefined) ?? [];
      children.push(node);
      parent.children = children;
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function buildConfig(entity: MasterEntity, data: MasterData): EntityConfig {
  const workflowOptions: Option[] = [
    { value: "QAS", label: "งานประกันคุณภาพ (SAR / APR / CAR)" },
    { value: "CUR", label: "งานบริหารหลักสูตร" },
    { value: "TCH", label: "งานจัดการเรียนการสอน" },
    { value: "ASM", label: "งานวัดและประเมินผล" },
    { value: "ADM", label: "งานรับเข้า" },
    { value: "STU", label: "งานนิสิต" },
  ];
  const activeField: FieldConfig = { key: "is_active", label: "เปิดใช้งาน", type: "switch" };
  const programField: FieldConfig = {
    key: "program_id", label: "หลักสูตร", type: "select", required: true,
    options: data.programs.map((item) => ({ value: item.id, label: `${item.code} — ${item.name_th}` })),
  };
  const programColumn = {
    title: "หลักสูตร", dataIndex: "program_id", key: "program_id",
    render: (id: number) => data.programs.find((item) => item.id === id)?.code ?? "—",
  };
  const yearField: FieldConfig = { key: "year", label: "ปี พ.ศ.", type: "number", required: true, min: 2400, max: 3000 };
  switch (entity) {
    case "academic_years":
    case "study_years": {
      const isStudyYear = entity === "study_years";
      return {
        description: isStudyYear ? "ชั้นปีสำหรับการเปิดสอนรายวิชา" : "ปีการศึกษาที่ใช้จัดเก็บเอกสาร (พ.ศ.)",
        addLabel: isStudyYear ? "เพิ่มชั้นปี" : "เพิ่มปีการศึกษา",
        fields: [{ ...yearField, label: isStudyYear ? "ชั้นปี" : "ปีการศึกษา พ.ศ.", min: isStudyYear ? 1 : 2400, max: isStudyYear ? 20 : 3000 }, activeField],
        columns: [textColumn(isStudyYear ? "ชั้นปี" : "ปีการศึกษา พ.ศ.", "year"), boolColumn("สถานะ", "is_active")],
        defaults: { is_active: true }, rows: (source) => source[entity].map((item) => ({ ...item })),
      };
    }
    case "semesters":
      return {
        description: "กำหนดภาคการศึกษาที่ใช้ร่วมกันทุกหลักสูตร", addLabel: "เพิ่มภาคการศึกษา",
        fields: [
          { key: "code", label: "รหัสภาคการศึกษา", type: "text", required: true, maxLength: 20 },
          { key: "name_th", label: "ชื่อภาคการศึกษา", type: "text", required: true, maxLength: 100 },
          { key: "sort_order", label: "ลำดับ", type: "number", min: 0 }, activeField,
        ],
        columns: [textColumn("รหัส", "code"), textColumn("ภาคการศึกษา", "name_th"), textColumn("ลำดับ", "sort_order"), boolColumn("สถานะ", "is_active")],
        defaults: { is_active: true, sort_order: 0 }, rows: (source) => source.semesters.map((item) => ({ ...item })),
      };
    case "curriculum_versions":
      return {
        description: "ฉบับหลักสูตรจะแสดงเฉพาะหลักสูตรที่ผูกไว้", addLabel: "เพิ่มฉบับหลักสูตร",
        fields: [programField, yearField, { key: "is_initial", label: "หลักสูตรใหม่ (ปิด = ฉบับปรับปรุง)", type: "switch" }, activeField],
        columns: [programColumn, textColumn("ปี พ.ศ.", "year"), boolColumn("ประเภทฉบับ", "is_initial", ["หลักสูตรใหม่", "ฉบับปรับปรุง"]), boolColumn("สถานะ", "is_active")],
        defaults: { is_initial: false, is_active: true }, rows: (source) => source.curriculum_versions.map((item) => ({ ...item })),
      };
    case "courses":
      return {
        description: "เพิ่มรายวิชา แล้วกำหนดปี ภาคเรียน และชั้นปีในเมนูการเปิดสอนรายวิชา", addLabel: "เพิ่มรายวิชา",
        fields: [programField, { key: "code", label: "รหัสรายวิชา", type: "text", required: true, maxLength: 30 }, { key: "name_th", label: "ชื่อรายวิชา", type: "text", required: true, maxLength: 200 }, activeField],
        columns: [programColumn, textColumn("รหัสรายวิชา", "code"), textColumn("ชื่อรายวิชา", "name_th"), boolColumn("สถานะ", "is_active")],
        defaults: { is_active: true }, rows: (source) => source.courses.map((item) => ({ ...item })),
      };
    case "course_offerings": {
      const fields: FieldConfig[] = [
        { key: "course_id", label: "รายวิชา", type: "select", required: true, options: data.courses.map((item) => ({ value: item.id, label: `${data.programs.find((program) => program.id === item.program_id)?.code ?? ""} · ${item.code} — ${item.name_th}` })) },
        { key: "academic_year_id", label: "ปีการศึกษา", type: "select", required: true, options: data.academic_years.map((item) => ({ value: item.id, label: String(item.year) })) },
        { key: "semester_id", label: "ภาคการศึกษา", type: "select", required: true, options: data.semesters.map((item) => ({ value: item.id, label: item.name_th })) },
        { key: "study_year_id", label: "ชั้นปี", type: "select", required: true, options: data.study_years.map((item) => ({ value: item.id, label: `ชั้นปีที่ ${item.year}` })) },
      ];
      return {
        description: "กำหนดว่ารายวิชาเปิดสอนในปี ภาคเรียน และชั้นปีใด เพื่อให้ปรากฏในหน้าแยกตามหน่วยงาน", addLabel: "เพิ่มการเปิดสอนรายวิชา",
        fields: [...fields, activeField],
        columns: [...fields.map((field) => ({ title: field.label, key: field.key, dataIndex: field.key, render: (id: number) => (field.options as Option[]).find((item) => item.value === id)?.label ?? "—" })), boolColumn("สถานะ", "is_active")],
        defaults: { is_active: true }, rows: (source) => source.course_offerings.map((item) => ({ ...item })),
      };
    }
    case "departments":
      return {
        description:
          "หน่วยงานหลักใช้เป็นส่วนแรกของรหัสเอกสาร และกำหนดว่าหน่วยงานนั้นมีงานย่อยหรือไม่",
        addLabel: "เพิ่มหน่วยงานหลัก",
        fields: [
          {
            key: "code",
            label: "รหัสหน่วยงาน",
            type: "text",
            required: true,
            maxLength: 20,
            placeholder: "เช่น EDU, MGT",
          },
          {
            key: "name_th",
            label: "ชื่อหน่วยงาน (ไทย)",
            type: "text",
            required: true,
            maxLength: 150,
          },
          {
            key: "name_en",
            label: "ชื่อหน่วยงาน (อังกฤษ)",
            type: "text",
            maxLength: 150,
          },
          {
            key: "sort_order",
            label: "ลำดับการแสดงผล",
            type: "number",
            min: 0,
          },
          {
            key: "has_sub_department",
            label: "มีงานย่อยภายใต้หน่วยงาน",
            type: "switch",
          },
          { key: "is_active", label: "เปิดใช้งาน", type: "switch" },
        ],
        columns: [
          textColumn("รหัส", "code", 100),
          textColumn("ชื่อหน่วยงาน (ไทย)", "name_th"),
          textColumn("ชื่อหน่วยงาน (อังกฤษ)", "name_en"),
          boolColumn("มีงานย่อย", "has_sub_department", ["มี", "ไม่มี"], "blue"),
          textColumn("ลำดับ", "sort_order", 90),
          boolColumn("สถานะ", "is_active"),
        ],
        defaults: { has_sub_department: false, sort_order: 0, is_active: true },
        rows: (source) => source.departments as unknown as Row[],
      };

    case "sub_departments":
      return {
        description:
          "งานย่อยใช้เป็นส่วนที่สองของรหัสเอกสาร สำหรับหน่วยงานที่มีงานย่อยเท่านั้น",
        addLabel: "เพิ่มงานย่อย",
        fields: [
          {
            key: "department_id",
            label: "หน่วยงานหลัก",
            type: "select",
            required: true,
            placeholder: "เลือกหน่วยงานหลัก",
            options: data.departments.map((item) => ({
              value: item.id,
              label: `${item.code} — ${item.name_th}`,
            })),
          },
          {
            key: "code",
            label: "รหัสงานย่อย",
            type: "text",
            required: true,
            maxLength: 20,
            placeholder: "เช่น ADM, TCH, ASM, STU",
          },
          {
            key: "name_th",
            label: "ชื่องานย่อย (ไทย)",
            type: "text",
            required: true,
            maxLength: 150,
          },
          {
            key: "name_en",
            label: "ชื่องานย่อย (อังกฤษ)",
            type: "text",
            maxLength: 150,
          },
          {
            key: "document_workflow", label: "รูปแบบเอกสาร", type: "select",
            options: workflowOptions, placeholder: "ไม่เลือก = เอกสารคุณภาพทั่วไป",
          },
          {
            key: "sort_order",
            label: "ลำดับการแสดงผล",
            type: "number",
            min: 0,
          },
          { key: "is_active", label: "เปิดใช้งาน", type: "switch" },
        ],
        columns: [
          {
            title: "หน่วยงานหลัก",
            dataIndex: "department_id",
            key: "department_id",
            render: (value: unknown) => {
              const department = data.departments.find(
                (item) => item.id === Number(value),
              );
              return department
                ? `${department.code} — ${department.name_th}`
                : "—";
            },
          },
          textColumn("รหัส", "code", 100),
          textColumn("ชื่องานย่อย (ไทย)", "name_th"),
          textColumn("ชื่องานย่อย (อังกฤษ)", "name_en"),
          { title: "รูปแบบเอกสาร", dataIndex: "document_workflow", key: "document_workflow", render: (value: string | null) => workflowOptions.find((item) => item.value === value)?.label ?? "เอกสารคุณภาพทั่วไป" },
          textColumn("ลำดับ", "sort_order", 90),
          boolColumn("สถานะ", "is_active"),
        ],
        defaults: {
          department_id: data.departments[0]?.id,
          sort_order: 0,
          is_active: true,
        },
        rows: (source) => source.sub_departments as unknown as Row[],
      };

    case "frameworks":
      return {
        description:
          "กรอบเกณฑ์ใช้กำหนดชุดเกณฑ์การประเมินที่ผูกกับหลักสูตร เช่น WFME หรือ AUN",
        addLabel: "เพิ่มกรอบเกณฑ์",
        fields: [
          {
            key: "code",
            label: "รหัสกรอบเกณฑ์",
            type: "text",
            required: true,
            maxLength: 20,
            placeholder: "เช่น WFME, AUN",
          },
          {
            key: "prefix_char",
            label: "ตัวอักษรนำหน้ารหัสเกณฑ์",
            type: "text",
            required: true,
            maxLength: 5,
            placeholder: "เช่น W, A",
          },
          {
            key: "name_th",
            label: "ชื่อกรอบเกณฑ์ (ไทย)",
            type: "text",
            required: true,
            maxLength: 150,
          },
          {
            key: "name_en",
            label: "ชื่อกรอบเกณฑ์ (อังกฤษ)",
            type: "text",
            maxLength: 150,
          },
          {
            key: "version_year",
            label: "ปี/รุ่นของเกณฑ์",
            type: "text",
            maxLength: 20,
            placeholder: "เช่น 2020, 4.0",
          },
          { key: "is_active", label: "เปิดใช้งาน", type: "switch" },
        ],
        columns: [
          textColumn("รหัส", "code", 100),
          textColumn("อักษรนำหน้า", "prefix_char", 120),
          textColumn("ชื่อกรอบเกณฑ์ (ไทย)", "name_th"),
          textColumn("ชื่อกรอบเกณฑ์ (อังกฤษ)", "name_en"),
          textColumn("ปี/รุ่น", "version_year", 100),
          boolColumn("สถานะ", "is_active"),
        ],
        defaults: { is_active: true },
        rows: (source) => source.frameworks as unknown as Row[],
      };

    case "programs":
      return {
        description:
          "หลักสูตรแต่ละหลักสูตรผูกกับกรอบเกณฑ์หนึ่งกรอบ เพื่อล็อกเกณฑ์ที่สามารถเลือกได้",
        addLabel: "เพิ่มหลักสูตร",
        fields: [
          {
            key: "code",
            label: "รหัสหลักสูตร",
            type: "text",
            required: true,
            maxLength: 20,
            placeholder: "เช่น M.D., B.PMD.",
          },
          {
            key: "name_th",
            label: "ชื่อหลักสูตร (ไทย)",
            type: "text",
            required: true,
            maxLength: 200,
          },
          {
            key: "name_en",
            label: "ชื่อหลักสูตร (อังกฤษ)",
            type: "text",
            maxLength: 200,
          },
          {
            key: "framework_id",
            label: "กรอบเกณฑ์",
            type: "select",
            required: true,
            placeholder: "เลือกกรอบเกณฑ์",
            options: data.frameworks.map((item) => ({
              value: item.id,
              label: `${item.code} — ${item.name_th}`,
            })),
          },
          { key: "is_active", label: "เปิดใช้งาน", type: "switch" },
        ],
        columns: [
          textColumn("รหัส", "code", 120),
          textColumn("ชื่อหลักสูตร (ไทย)", "name_th"),
          textColumn("ชื่อหลักสูตร (อังกฤษ)", "name_en"),
          {
            title: "กรอบเกณฑ์",
            dataIndex: "framework_id",
            key: "framework_id",
            render: (value: unknown) => {
              const framework = data.frameworks.find(
                (item) => item.id === Number(value),
              );
              return framework ? (
                <Tag color="blue">{framework.code}</Tag>
              ) : (
                "—"
              );
            },
          },
          boolColumn("สถานะ", "is_active"),
        ],
        defaults: {
          framework_id: data.frameworks[0]?.id,
          is_active: true,
        },
        rows: (source) => source.programs as unknown as Row[],
      };

    case "document_levels":
      return {
        description:
          "ระดับเอกสารกำหนดลำดับชั้นของเอกสารคุณภาพ ตั้งแต่ QM ถึง SD",
        addLabel: "เพิ่มระดับเอกสาร",
        fields: [
          {
            key: "code",
            label: "รหัสระดับเอกสาร",
            type: "text",
            required: true,
            maxLength: 10,
            placeholder: "เช่น QM, SP, WI, FM, SD",
          },
          {
            key: "name_th",
            label: "ชื่อระดับเอกสาร (ไทย)",
            type: "text",
            required: true,
            maxLength: 100,
          },
          {
            key: "name_en",
            label: "ชื่อระดับเอกสาร (อังกฤษ)",
            type: "text",
            maxLength: 100,
          },
          {
            key: "level_order",
            label: "ลำดับชั้นเอกสาร",
            type: "number",
            required: true,
            min: 1,
            max: 255,
          },
          { key: "is_active", label: "เปิดใช้งาน", type: "switch" },
        ],
        columns: [
          textColumn("รหัส", "code", 100),
          textColumn("ชื่อระดับเอกสาร (ไทย)", "name_th"),
          textColumn("ชื่อระดับเอกสาร (อังกฤษ)", "name_en"),
          textColumn("ลำดับชั้น", "level_order", 100),
          boolColumn("สถานะ", "is_active"),
        ],
        defaults: { level_order: 1, is_active: true },
        rows: (source) => source.document_levels as unknown as Row[],
      };

    case "criteria":
      return {
        description:
          "เกณฑ์ถูกจัดเป็นลำดับชั้นด้วยเกณฑ์แม่ (parent) ใช้ตัวเลือก “เลือกผูกเอกสารได้” กับข้อเกณฑ์ระดับใบเท่านั้น",
        addLabel: "เพิ่มเกณฑ์",
        fields: [
          {
            key: "framework_id",
            label: "กรอบเกณฑ์",
            type: "select",
            required: true,
            placeholder: "เลือกกรอบเกณฑ์",
            options: data.frameworks.map((item) => ({
              value: item.id,
              label: `${item.code} — ${item.name_th}`,
            })),
          },
          {
            key: "parent_id",
            label: "เกณฑ์แม่",
            type: "select",
            placeholder: "ไม่ระบุ (เป็นหมวดหลัก)",
            options: (values) => {
              const frameworkId = Number(values.framework_id);
              return data.criteria
                .filter((item) => item.framework_id === frameworkId)
                .map((item) => ({
                  value: item.id,
                  label: `${item.code} — ${item.title_th}`,
                }));
            },
          },
          {
            key: "code",
            label: "รหัสเกณฑ์",
            type: "text",
            required: true,
            maxLength: 30,
            placeholder: "เช่น W1.1.1, A1.1-1",
          },
          {
            key: "section_number",
            label: "เลขข้อเกณฑ์",
            type: "text",
            required: true,
            maxLength: 20,
            placeholder: "เช่น 1.1.1",
          },
          {
            key: "level_depth",
            label: "ระดับชั้น",
            type: "number",
            required: true,
            min: 1,
            max: 3,
          },
          {
            key: "wfme_standard_type",
            label: "ประเภทมาตรฐาน WFME",
            type: "select",
            required: true,
            options: (
              Object.keys(WFME_LABELS) as WfmeStandardType[]
            ).map((value) => ({ value, label: WFME_LABELS[value] })),
          },
          {
            key: "title_th",
            label: "ชื่อหัวข้อเกณฑ์ (ไทย)",
            type: "text",
            required: true,
            maxLength: 500,
            full: true,
          },
          {
            key: "title_en",
            label: "ชื่อหัวข้อเกณฑ์ (อังกฤษ)",
            type: "text",
            maxLength: 500,
            full: true,
          },
          {
            key: "description_th",
            label: "คำอธิบายเกณฑ์",
            type: "textarea",
            maxLength: 20000,
            full: true,
          },
          {
            key: "sort_order",
            label: "ลำดับการแสดงผล",
            type: "number",
            min: 0,
          },
          {
            key: "is_selectable",
            label: "เลือกผูกเอกสารได้",
            type: "switch",
          },
          { key: "is_active", label: "เปิดใช้งาน", type: "switch" },
        ],
        columns: [
          {
            title: "กรอบเกณฑ์",
            dataIndex: "framework_id",
            key: "framework_id",
            width: 120,
            render: (value: unknown) => {
              const framework = data.frameworks.find(
                (item) => item.id === Number(value),
              );
              return framework ? (
                <Tag color="blue">{framework.code}</Tag>
              ) : (
                "—"
              );
            },
          },
          textColumn("รหัสเกณฑ์", "code", 120),
          textColumn("เลขข้อ", "section_number", 100),
          {
            title: "ระดับชั้น",
            dataIndex: "level_depth",
            key: "level_depth",
            width: 150,
            render: (value: unknown) =>
              LEVEL_LABELS[Number(value)] ?? String(value),
          },
          textColumn("ชื่อหัวข้อเกณฑ์ (ไทย)", "title_th"),
          {
            title: "ประเภท WFME",
            dataIndex: "wfme_standard_type",
            key: "wfme_standard_type",
            width: 140,
            render: (value: unknown) =>
              WFME_LABELS[value as WfmeStandardType] ?? "—",
          },
          boolColumn(
            "ผูกเอกสารได้",
            "is_selectable",
            ["ได้", "หัวข้อกลุ่ม"],
            "green",
          ),
          boolColumn("สถานะ", "is_active"),
        ],
        defaults: {
          framework_id: data.frameworks[0]?.id,
          level_depth: 1,
          wfme_standard_type: "NONE",
          is_selectable: true,
          sort_order: 0,
          is_active: true,
        },
        rows: (source) => buildCriteriaTree(source.criteria),
      };
  }
}

function FieldItem({
  field,
  form,
}: {
  field: FieldConfig;
  form: FormInstance;
}) {
  const rules = field.required
    ? [{ required: true, message: `กรุณากรอก${field.label}` }]
    : undefined;

  const renderInput = (values: FormValues) => {
    switch (field.type) {
      case "textarea":
        return (
          <Input.TextArea
            rows={3}
            maxLength={field.maxLength}
            showCount={Boolean(field.maxLength)}
          />
        );
      case "number":
        return (
          <InputNumber
            className="w-full"
            min={field.min}
            max={field.max}
            precision={0}
          />
        );
      case "switch":
        return <Switch />;
      case "select":
        return (
          <Select
            options={
              typeof field.options === "function"
                ? field.options(values)
                : (field.options ?? [])
            }
            placeholder={field.placeholder}
            allowClear={!field.required}
            showSearch
            optionFilterProp="label"
          />
        );
      default:
        return (
          <Input
            maxLength={field.maxLength}
            placeholder={field.placeholder}
          />
        );
    }
  };

  if (field.type === "select" && typeof field.options === "function") {
    return (
      <Form.Item noStyle shouldUpdate>
        {() => (
          <Form.Item
            name={field.key}
            label={field.label}
            rules={rules}
            className={field.full ? "sm:col-span-2" : undefined}
          >
            {renderInput(form.getFieldsValue(true) as FormValues)}
          </Form.Item>
        )}
      </Form.Item>
    );
  }

  return (
    <Form.Item
      name={field.key}
      label={field.label}
      rules={rules}
      valuePropName={field.type === "switch" ? "checked" : undefined}
      className={field.full ? "sm:col-span-2" : undefined}
    >
      {renderInput({})}
    </Form.Item>
  );
}

export default function AdminSettings({
  section,
  data,
  onNavigate,
}: {
  section: SettingsSection;
  data: MasterData;
  onNavigate: (section: SettingsSection | "settings-overview") => void;
}) {
  const page = settingsPages.find((item) => item.id === section)!;
  const group = settingsGroups.find((item) => item.id === page.group)!;
  const entity = SECTION_ENTITY[section];
  const config = useMemo(() => buildConfig(entity, data), [entity, data]);
  const router = useRouter();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [pending, startTransition] = useTransition();
  const rows = useMemo(() => config.rows(data), [config, data]);

  function openCreate() {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue(config.defaults);
    setOpen(true);
  }

  function openEdit(row: Row) {
    setEditing(row);
    const values: FormValues = {};
    for (const field of config.fields) {
      values[field.key] = row[field.key] ?? undefined;
    }
    form.resetFields();
    form.setFieldsValue(values);
    setOpen(true);
  }

  function closeModal() {
    if (pending) return;
    setOpen(false);
    setEditing(null);
  }

  function handleFinish(values: FormValues) {
    const input = editing ? { ...values, id: editing.id } : values;
    startTransition(async () => {
      const result = await saveRecordAction(entity, input);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(editing ? "บันทึกการแก้ไขแล้ว" : "เพิ่มข้อมูลแล้ว");
      setOpen(false);
      setEditing(null);
      router.refresh();
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      const result = await deleteRecordAction(entity, id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("ลบข้อมูลแล้ว");
      router.refresh();
    });
  }

  const columns: NonNullable<TableProps<Row>["columns"]> = [
    ...config.columns,
    {
      title: "จัดการ",
      key: "actions",
      width: 110,
      fixed: "right",
      render: (_value, row) => (
        <div className="flex items-center gap-1">
          <Button
            type="text"
            size="small"
            aria-label="แก้ไขรายการ"
            icon={<Pencil size={16} aria-hidden="true" />}
            onClick={() => openEdit(row)}
            disabled={pending}
          />
          <Popconfirm
            title="ยืนยันการลบรายการนี้?"
            description="ข้อมูลที่ลบแล้วไม่สามารถกู้คืนได้"
            okText="ลบ"
            cancelText="ยกเลิก"
            okButtonProps={{ danger: true, loading: pending }}
            onConfirm={() => handleDelete(Number(row.id))}
          >
            <Button
              type="text"
              size="small"
              danger
              aria-label="ลบรายการ"
              icon={<Trash2 size={16} aria-hidden="true" />}
              disabled={pending}
            />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="mb-9">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button type="text" icon={<ArrowLeft size={16} aria-hidden="true" />} onClick={() => onNavigate("settings-overview")}>
          กลับหน้าตั้งค่า
        </Button>
        <Select
          className="w-full sm:w-72"
          aria-label={`รายการตั้งค่าในหมวด${group.title}`}
          value={section}
          onChange={onNavigate}
          options={settingsPages.filter((item) => item.group === group.id).map((item) => ({ value: item.id, label: item.title }))}
        />
      </div>
      <Card>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-2xl text-sm leading-6 text-muted">
            {config.description}
            <span className="mt-2 block text-xs">ทั้งหมด {data[entity].length.toLocaleString("th-TH")} รายการ</span>
          </p>
          <Button
            type="primary"
            icon={<Plus size={16} aria-hidden="true" />}
            onClick={openCreate}
            disabled={pending}
          >
            {config.addLabel}
          </Button>
        </div>

        <Table<Row>
          rowKey="id"
          dataSource={rows}
          columns={columns}
          size="middle"
          pagination={{ pageSize: 8, showSizeChanger: false }}
          scroll={{ x: "max-content" }}
          expandable={{ defaultExpandAllRows: true }}
        />
      </Card>

      <Modal
        forceRender
        open={open}
        title={editing ? `แก้ไข${config.addLabel.replace("เพิ่ม", "")}` : config.addLabel}
        okText="บันทึก"
        cancelText="ยกเลิก"
        confirmLoading={pending}
        onOk={() => form.submit()}
        onCancel={closeModal}
        width={config.fields.length > 8 ? 760 : 560}
        mask={{ closable: !pending }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          preserve={false}
          className="mt-6"
        >
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            {config.fields.map((field) => (
              <FieldItem key={field.key} field={field} form={form} />
            ))}
          </div>
        </Form>
      </Modal>
    </div>
  );
}
