export type WorkFlow = {
  mode: "year" | "version" | "course";
  types: { code: string; label: string; group?: string }[];
};

export function getWorkFlow(workflow: string | null, framework: string): WorkFlow | null {
  switch (workflow) {
    case "QA":
      return {
        mode: "year",
        types: framework === "WFME" ? [
          { code: "SAR", label: "รายงานประเมินตนเอง (SAR)", group: "SAR" },
          { code: "ACCREDITATION", label: "หนังสือรับรองหลักสูตรจากแพทยสภา", group: "SAR" },
          { code: "APR", label: "Annual Progress Report", group: "APR" },
          { code: "APR_RESULT", label: "รายงานผลการพิจารณา APR (หนังสือได้รับการรับรอง)", group: "APR" },
        ] : framework === "AUN" ? [
          { code: "SAR", label: "รายงานประเมินตนเอง (SAR)" },
          { code: "CAR", label: "รายงานผลการประเมิน (CAR)" },
        ] : [],
      };
    case "CM": return { mode: "version", types: [{ code: "CURRICULUM", label: "เอกสารหลักสูตร" }] };
    case "TCH": return { mode: "course", types: [
      { code: "TQF3", label: "มคอ.3" }, { code: "TQF5", label: "มคอ.5" }, { code: "EVALUATION", label: "ผลประเมิน" },
    ] };
    case "ASM": return { mode: "course", types: [{ code: "STUDY_RESULT", label: "ผลการศึกษา" }] };
    case "ADM": return { mode: "year", types: [{ code: "ADMISSION_ANNOUNCEMENT", label: "ประกาศการรับสมัคร" }] };
    default: return null;
  }
}

export function curriculumVersionLabel(version: { year: number; is_initial: boolean }) {
  return `${version.is_initial ? "หลักสูตรใหม่" : "ฉบับปรับปรุง"} พ.ศ. ${version.year}`;
}
