export type VersionState = "DRAFT" | "RETURNED" | "PENDING" | "SCHEDULED" | "EFFECTIVE" | "SUPERSEDED" | "WITHDRAWN";
export type DocumentVersion = {
  id: string; version: string; title: string; description: string; changeNote: string;
  state: VersionState; effectiveDate: string | null; approvedAt: string | null;
  fileName: string | null; previewUrl: string | null;
};
export type DocumentVersions = {
  id: string; code: string; title: string; currentVersion: string | null; deleted: boolean;
  versions: DocumentVersion[];
};
export type DocumentPreview =
  | { kind: "pdf"; image: string; width: number; height: number; page: number; totalPages: number }
  | { kind: "text"; text: string; truncated: boolean }
  | { kind: "spreadsheet"; sheets: { name: string; rows: string[][]; truncated: boolean }[] };
