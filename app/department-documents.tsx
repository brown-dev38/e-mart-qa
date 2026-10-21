"use client";

import { Card, Empty, Select, Tag } from "antd";
import { ChevronDown, FolderOpen, GraduationCap } from "lucide-react";
import DepartmentWorkDocuments from "./department-work-documents";
import type {
  DepartmentDocumentCatalog,
  DepartmentSelection,
} from "@/types/department-documents";

export default function DepartmentDocuments({
  catalog,
  selection,
  onChange,
}: {
  catalog: DepartmentDocumentCatalog;
  selection: DepartmentSelection;
  onChange: (selection: DepartmentSelection) => void;
}) {
  const program = catalog.programs.find((item) => item.value === selection.curriculum);
  const workType = catalog.workTypes.find((item) => item.value === selection.workType);

  return (
    <div className="mb-9 space-y-6">
      <Card>
        <h2 className="text-base font-semibold">เลือกประเภทงานและหลักสูตร</h2>
        <p className="mt-1 text-sm text-muted">
          เลือกประเภทงานและหลักสูตร แล้วระบุข้อมูลเพื่อดูหรือเพิ่มเอกสาร
        </p>
        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="min-w-0">
            <label htmlFor="document-work-type" className="mb-2 block text-sm font-medium">
              ประเภทงาน
            </label>
            <Select
              id="document-work-type"
              className="w-full"
              size="large"
              placeholder="เลือกประเภทงาน"
              value={workType?.value}
              onChange={(value) => onChange({ curriculum: null, workType: value })}
              options={catalog.workTypes.map(({ value, label }) => ({ value, label }))}
              showSearch
              optionFilterProp="label"
              notFoundContent="ยังไม่มีประเภทงานที่เปิดใช้งาน"
              suffixIcon={<ChevronDown size={16} aria-hidden="true" />}
              virtual={false}
            />
            <p className="mt-2 text-xs leading-6 text-muted">
              {workType?.departmentName ?? "เลือกงานที่ต้องการดูเอกสาร"}
            </p>
          </div>
          <div className="min-w-0">
            <label htmlFor="document-curriculum" className="mb-2 block text-sm font-medium">
              หลักสูตร
            </label>
            <Select
              id="document-curriculum"
              className="w-full"
              size="large"
              placeholder="เลือกหลักสูตร"
              disabled={!workType}
              value={program?.value}
              onChange={(value) => onChange({ ...selection, curriculum: value })}
              options={catalog.programs.map((item) => ({
                value: item.value,
                label: [item.name, item.englishName, item.value, item.framework]
                  .filter(Boolean).join(" · "),
              }))}
              labelRender={({ value }) => {
                const item = catalog.programs.find((course) => course.value === value);
                return item ? item.name + " (" + item.value + ")" : null;
              }}
              optionRender={(option) => {
                const item = catalog.programs.find((course) => course.value === option.value);
                return item && (
                  <div className="whitespace-normal py-1 leading-6">
                    <span className="block font-medium">{item.name}</span>
                    <span className="block text-xs text-muted">
                      {[item.englishName, item.value, item.framework].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                );
              }}
              notFoundContent="ยังไม่มีหลักสูตรที่เปิดใช้งาน"
              suffixIcon={<ChevronDown size={16} aria-hidden="true" />}
              virtual={false}
            />
            <p className="mt-2 text-xs leading-6 text-muted">
              {program
                ? [program.englishName, program.value, program.framework].filter(Boolean).join(" · ")
                : workType ? "มี " + catalog.programs.length + " หลักสูตรให้เลือก" : "กรุณาเลือกประเภทงานก่อน"}
            </p>
          </div>
        </div>
      </Card>
      {program && workType ? (
        <>
          <div className="flex items-start gap-3">
            <GraduationCap size={22} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="break-words text-base font-semibold">{program.name}</h2>
              <p className="mt-1 text-xs leading-6 text-muted">
                {[program.englishName, program.value].filter(Boolean).join(" · ")}
              </p>
              <Tag className="mt-3">{workType.label}</Tag>
              <Tag color="blue">{program.framework}</Tag>
            </div>
          </div>
          <DepartmentWorkDocuments
            key={program.value + ":" + workType.value}
            program={program}
            workType={workType}
            academic={catalog.academic}
          />
        </>
      ) : (
        <Card>
          <Empty
            className="py-10"
            image={<FolderOpen size={52} strokeWidth={1.5} className="mx-auto text-accent" aria-hidden="true" />}
            styles={{ image: { height: 56 } }}
            description={
              <div aria-live="polite">
                <p className="font-medium text-ink">
                  {workType ? "เลือกหลักสูตรเพื่อดูเอกสาร" : "เลือกประเภทงานและหลักสูตร"}
                </p>
                <p className="mt-2 text-sm text-muted">
                  {catalog.workTypes.length === 0 ? "ยังไม่มีประเภทงานที่เปิดใช้งาน"
                    : catalog.programs.length === 0 ? "ยังไม่มีหลักสูตรที่เปิดใช้งาน"
                    : "เอกสารจะแสดงตามประเภทงานและหลักสูตรที่คุณเลือก"}
                </p>
              </div>
            }
          />
        </Card>
      )}
    </div>
  );
}
