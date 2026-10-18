import { isValidCriterion } from "./assessment-criteria";

export { isValidCriterion } from "./assessment-criteria";

export const curricula = [
  {
    value: "md",
    name: "หลักสูตรแพทยศาสตรบัณฑิต",
    englishName: "Doctor of Medicine",
    abbreviation: "M.D.",
    framework: "WFME",
  },
  {
    value: "bpmd",
    name: "หลักสูตรฉุกเฉินการแพทยบัณฑิต",
    englishName: "Bachelor of Paramedicine",
    abbreviation: "B.PMD.",
    framework: "AUN",
  },
] as const;

export const departments = [
  { value: "EDU", label: "หน่วยงานการศึกษา (EDU)" },
  { value: "MGT", label: "หน่วยงานบริหาร (MGT)" },
] as const;

export const educationJobs = [
  { value: "ADM", label: "งานรับเข้า (ADM)" },
  { value: "TCH", label: "งานจัดการเรียนการสอน (TCH)" },
  { value: "ASM", label: "งานวัดและประเมินผล (ASM)" },
  { value: "STU", label: "งานนิสิต (STU)" },
] as const;

export const documentLevels = [
  { value: "QM", label: "นโยบายคุณภาพ (QM)" },
  { value: "SP", label: "ระเบียบปฏิบัติ (SP)" },
  { value: "WI", label: "แนวทางปฏิบัติ (WI)" },
  { value: "FM", label: "แบบฟอร์ม (FM)" },
  { value: "SD", label: "เอกสารสนับสนุน (SD)" },
] as const;

export type QualityDocumentValues = {
  department?: (typeof departments)[number]["value"];
  job?: (typeof educationJobs)[number]["value"];
  curriculum?: (typeof curricula)[number]["value"];
  level?: (typeof documentLevels)[number]["value"];
  criterion?: string;
  sequence: string;
  title: string;
  description: string;
};

export const emptyDocument: QualityDocumentValues = {
  sequence: "000",
  title: "",
  description: "",
};

export function buildDocumentCode(
  values: Partial<QualityDocumentValues>,
): string | null {
  const curriculum = curricula.find((item) => item.value === values.curriculum);
  const criterion = values.criterion?.trim().toUpperCase() ?? "";
  const sequence = values.sequence?.trim() ?? "";
  if (
    !departments.some((item) => item.value === values.department) ||
    !curriculum ||
    !documentLevels.some((item) => item.value === values.level) ||
    !isValidCriterion(criterion, curriculum.framework) ||
    !/^\d{1,3}$/.test(sequence) ||
    (values.department === "EDU" &&
      !educationJobs.some((item) => item.value === values.job))
  )
    return null;

  return [
    values.department,
    ...(values.department === "EDU" ? [values.job] : []),
    curriculum.abbreviation,
    values.level,
    criterion,
    sequence.padStart(3, "0"),
  ].join("-");
}

export function readDocumentDraft(
  raw: string | null,
): { values: QualityDocumentValues; hadAttachment: boolean } | null {
  try {
    const saved: unknown = JSON.parse(raw ?? "null");
    if (
      !saved ||
      typeof saved !== "object" ||
      !("values" in saved) ||
      !saved.values ||
      typeof saved.values !== "object"
    )
      return null;
    const values = saved.values as Record<string, unknown>;
    const department = departments.find(
      (item) => item.value === values.department,
    )?.value;
    const curriculum = curricula.find((item) => item.value === values.curriculum);
    let criterion =
      typeof values.criterion === "string"
        ? values.criterion.slice(0, 32).trim().toUpperCase()
        : undefined;
    // Preserve selections from drafts saved with either previous AUN format.
    if (curriculum?.framework === "AUN") {
      criterion = criterion
        ?.replace(/^A(\d+\.\d+)\.1$/, "A$1-1")
        .replace(/^(\d+\.\d+)$/, "A$1-1");
    }
    return {
      values: {
        department,
        job:
          department === "EDU"
            ? educationJobs.find((item) => item.value === values.job)?.value
            : undefined,
        curriculum: curriculum?.value,
        level: documentLevels.find((item) => item.value === values.level)
          ?.value,
        criterion:
          criterion &&
          curriculum &&
          isValidCriterion(criterion, curriculum.framework)
            ? criterion
            : undefined,
        sequence:
          typeof values.sequence === "string" &&
          /^\d{1,3}$/.test(values.sequence)
            ? values.sequence.padStart(3, "0")
            : "000",
        title:
          typeof values.title === "string" ? values.title.slice(0, 200) : "",
        description:
          typeof values.description === "string"
            ? values.description.slice(0, 2000)
            : "",
      },
      hadAttachment: "hadAttachment" in saved && saved.hadAttachment === true,
    };
  } catch {
    return null;
  }
}
