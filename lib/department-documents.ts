import type { MasterData } from "@/types/master-data";
import type {
  DepartmentDocumentCatalog,
  DepartmentSelection,
} from "@/types/department-documents";

export function buildDepartmentDocumentCatalog(
  data: MasterData,
): DepartmentDocumentCatalog {
  const frameworks = new Map(
    data.frameworks.filter((item) => item.is_active).map((item) => [item.id, item.code]),
  );

  return {
    academic: {
      academic_years: data.academic_years.filter((item) => item.is_active),
      semesters: data.semesters.filter((item) => item.is_active),
      study_years: data.study_years.filter((item) => item.is_active),
      curriculum_versions: data.curriculum_versions.filter((item) => item.is_active),
      courses: data.courses.filter((item) => item.is_active),
      course_offerings: data.course_offerings.filter((item) => item.is_active),
    },
    programs: data.programs
      .filter((item) => item.is_active && frameworks.has(item.framework_id))
      .map((item) => ({
        id: item.id,
        value: item.code,
        name: item.name_th,
        englishName: item.name_en,
        framework: frameworks.get(item.framework_id)!,
      })),
    workTypes: data.departments.filter((item) => item.is_active).flatMap<
      DepartmentDocumentCatalog["workTypes"][number]
    >((department) => {
      const parent = {
        departmentName: department.name_th,
        departmentCode: department.code,
      };
      if (!department.has_sub_department) {
        return [{
          ...parent,
          value: `department:${department.id}`,
          label: `${department.name_th} (${department.code})`,
          subDepartmentCode: null,
          workflow: null,
        }];
      }
      return data.sub_departments
        .filter((item) => item.is_active && item.department_id === department.id)
        .map((item) => ({
          ...parent,
          value: `sub-department:${item.id}`,
          label: `${item.name_th} (${department.code}/${item.code})`,
          subDepartmentCode: item.code,
          workflow: item.document_workflow ?? null,
        }));
    }),
  };
}

// Restore selections saved before the page used database codes and IDs.
const legacyPrograms: Record<string, string> = { md: "M.D.", bpmd: "B.PMD." };
const legacyJobs: Record<string, string> = {
  teaching: "TCH",
  assessment: "ASM",
  admissions: "ADM",
};

export function readDepartmentSelection(
  saved: { curriculum?: unknown; workType?: unknown },
  catalog: DepartmentDocumentCatalog,
): DepartmentSelection {
  const rawProgram = typeof saved.curriculum === "string" ? saved.curriculum : "";
  const program = catalog.programs.find((item) => item.value === rawProgram)
    ?? catalog.programs.find((item) => item.value === legacyPrograms[rawProgram]);
  const rawJob = typeof saved.workType === "string" ? saved.workType : "";
  const job = catalog.workTypes.find((item) => item.value === rawJob)
    ?? catalog.workTypes.find((item) =>
      item.departmentCode === "EDU" && item.subDepartmentCode === legacyJobs[rawJob]);

  return {
    curriculum: program?.value ?? null,
    workType: program || !rawProgram ? (job?.value ?? null) : null,
  };
}
