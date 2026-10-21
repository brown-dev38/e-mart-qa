import type { AcademicData, DocumentWorkflow } from "./academic";

export type DepartmentSelection = {
  curriculum: string | null;
  workType: string | null;
};

export type DepartmentDocumentCatalog = {
  academic: AcademicData;
  programs: {
    id: number;
    value: string;
    name: string;
    englishName: string | null;
    framework: string;
  }[];
  workTypes: {
    workflow: DocumentWorkflow | null;
    value: string;
    label: string;
    departmentName: string;
    departmentCode: string;
    subDepartmentCode: string | null;
  }[];
};
