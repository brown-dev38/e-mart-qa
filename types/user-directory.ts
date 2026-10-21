export type DirectoryDepartment = {
  id: number;
  name: string;
  is_active: boolean;
};

export type DirectoryPosition = {
  id: number;
  name: string;
  is_active: boolean;
};

export type DirectoryRole = {
  id: number;
  name: string;
  is_active: boolean;
};

export type DirectoryUser = {
  id: number;
  username: string;
  email: string | null;
  citizen_id: string | null;
  firstname: string | null;
  lastname: string | null;
  must_change_password: boolean;
  is_active: boolean;
  role_id: number | null;
  role_name: string | null;
  department_id: number | null;
  department_name: string | null;
  position_id: number | null;
  position_name: string | null;
};

export type UserDirectoryData = {
  departments: DirectoryDepartment[];
  positions: DirectoryPosition[];
  roles: DirectoryRole[];
  users: DirectoryUser[];
};

export type DirectoryRecordInput = Record<string, unknown>;

export type SaveResult = { ok: true } | { ok: false; error: string };
