"use client";

import { Card, Empty, Select, Tag } from "antd";
import { ChevronDown, FolderOpen, GraduationCap } from "lucide-react";
import { curricula } from "@/lib/quality-documents";

export const workTypes = [
  { value: "teaching", label: "การจัดการเรียนการสอน" },
  { value: "assessment", label: "การวัดและประเมินผล" },
  { value: "admissions", label: "งานรับเข้า" },
] as const;

export type DepartmentSelection = {
  curriculum: (typeof curricula)[number]["value"] | null;
  workType: (typeof workTypes)[number]["value"] | null;
};

export default function DepartmentDocuments({
  selection,
  onChange,
}: {
  selection: DepartmentSelection;
  onChange: (selection: DepartmentSelection) => void;
}) {
  const curriculum = curricula.find(
    (item) => item.value === selection.curriculum,
  );
  const workType = workTypes.find((item) => item.value === selection.workType);
  const ready = Boolean(curriculum && workType);

  return (
    <div className="mb-9 space-y-6">
      <Card>
        <h2 className="text-base font-semibold">เลือกหลักสูตรและประเภทงาน</h2>
        <p className="mt-1 text-sm text-muted">
          เลือกหลักสูตรที่ต้องการ แล้วเลือกประเภทงานเพื่อดูเอกสารคุณภาพ
        </p>

        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <label
              htmlFor="document-curriculum"
              className="mb-2 block text-sm font-medium"
            >
              หลักสูตร
            </label>
            <Select<NonNullable<DepartmentSelection["curriculum"]>>
              id="document-curriculum"
              className="w-full"
              size="large"
              placeholder="เลือกหลักสูตร"
              value={selection.curriculum ?? undefined}
              onChange={(value) =>
                onChange({ curriculum: value, workType: null })
              }
              options={curricula.map((item) => ({
                value: item.value,
                label: `${item.name} (${item.englishName}) ${item.abbreviation}`,
              }))}
              labelRender={({ value }) => {
                const item = curricula.find((course) => course.value === value);
                return item ? `${item.name} (${item.abbreviation})` : null;
              }}
              optionRender={(option) => {
                const item = curricula.find(
                  (course) => course.value === option.value,
                );
                return (
                  item && (
                    <div className="whitespace-normal py-1 leading-6">
                      <span className="block font-medium">{item.name}</span>
                      <span className="block text-xs text-muted">
                        {item.englishName} · {item.abbreviation}
                      </span>
                    </div>
                  )
                );
              }}
              suffixIcon={<ChevronDown size={16} aria-hidden="true" />}
              virtual={false}
            />
            <p className="mt-2 text-xs leading-6 text-muted">
              {curriculum
                ? `${curriculum.englishName} · ${curriculum.abbreviation}`
                : "มี 2 หลักสูตรให้เลือก"}
            </p>
          </div>

          <div className="min-w-0">
            <label
              htmlFor="document-work-type"
              className="mb-2 block text-sm font-medium"
            >
              ประเภทงาน
            </label>
            <Select<NonNullable<DepartmentSelection["workType"]>>
              id="document-work-type"
              className="w-full"
              size="large"
              placeholder="เลือกประเภทงาน"
              value={selection.workType ?? undefined}
              disabled={!curriculum}
              onChange={(value) => onChange({ ...selection, workType: value })}
              options={workTypes.map((item) => ({ ...item }))}
              suffixIcon={<ChevronDown size={16} aria-hidden="true" />}
              virtual={false}
            />
            <p className="mt-2 text-xs leading-6 text-muted">
              {curriculum
                ? "เลือกงานที่ต้องการดูเอกสาร"
                : "กรุณาเลือกหลักสูตรก่อน"}
            </p>
          </div>
        </div>
      </Card>

      <Card>
        {ready && curriculum && workType && (
          <div className="mb-8 flex items-start gap-3 border-b border-line pb-5">
            <GraduationCap
              size={22}
              className="mt-0.5 shrink-0 text-accent"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <h2 className="break-words text-base font-semibold">
                {curriculum.name}
              </h2>
              <p className="mt-1 text-xs leading-6 text-muted">
                {curriculum.englishName} · {curriculum.abbreviation}
              </p>
              <Tag className="mt-3">{workType.label}</Tag>
            </div>
          </div>
        )}
        <Empty
          className="py-10"
          image={
            <FolderOpen
              size={52}
              strokeWidth={1.5}
              className="mx-auto text-accent"
              aria-hidden="true"
            />
          }
          styles={{ image: { height: 56 } }}
          description={
            <div aria-live="polite">
              <p className="font-medium text-ink">
                {ready
                  ? "เอกสารคุณภาพจะแสดงในส่วนนี้"
                  : curriculum
                    ? "เลือกประเภทงานเพื่อดูเอกสารคุณภาพ"
                    : "เลือกหลักสูตรและประเภทงาน"}
              </p>
              <p className="mt-2 text-sm text-muted">
                {ready
                  ? "รายการเอกสารสำหรับหลักสูตรและประเภทงานที่เลือก"
                  : "เอกสารจะแสดงตามหลักสูตรและประเภทงานที่คุณเลือก"}
              </p>
            </div>
          }
        >
          {ready && <Tag>เตรียมเปิดใช้งาน</Tag>}
        </Empty>
      </Card>
    </div>
  );
}
