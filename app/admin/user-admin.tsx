"use client";

import { useState, useTransition } from "react";
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
  Briefcase,
  Building2,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  deleteDepartmentAction,
  deletePositionAction,
  saveDepartmentAction,
  savePositionAction,
  saveUserAction,
} from "./user-actions";
import type { SaveResult } from "@/types/user-directory";
import type {
  DirectoryUser,
  UserDirectoryData,
} from "@/types/user-directory";

export const directoryPages = [
  {
    id: "directory-departments",
    title: "หน่วยงาน/สังกัด",
    description: "จัดการหน่วยงานหรือสังกัดของผู้ใช้งาน",
    icon: Building2,
    path: ["จัดการผู้ใช้งาน", "หน่วยงาน/สังกัด"],
  },
  {
    id: "directory-positions",
    title: "ตำแหน่ง",
    description: "จัดการตำแหน่งงานของผู้ใช้งาน",
    icon: Briefcase,
    path: ["จัดการผู้ใช้งาน", "ตำแหน่ง"],
  },
  {
    id: "directory-users",
    title: "ผู้ใช้งาน/พนักงาน",
    description: "เพิ่มและแก้ไขข้อมูลบัญชี บทบาท และสังกัดของผู้ใช้งาน",
    icon: Users,
    path: ["จัดการผู้ใช้งาน", "ผู้ใช้งาน/พนักงาน"],
  },
] as const;

export type DirectorySection = (typeof directoryPages)[number]["id"];

type Option = { value: number; label: string; disabled?: boolean };
type Row = Record<string, unknown>;
type FormValues = Record<string, unknown>;

type FieldConfig = {
  key: string;
  label: string;
  type: "text" | "number" | "switch" | "select";
  required?: boolean;
  maxLength?: number;
  min?: number;
  placeholder?: string;
  options?: Option[];
};

type EntityConfig = {
  addLabel: string;
  fields: FieldConfig[];
  columns: NonNullable<TableProps<Row>["columns"]>;
  defaults: FormValues;
  rows: Row[];
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
): NonNullable<TableProps<Row>["columns"]>[number] {
  return {
    title,
    dataIndex: key,
    key,
    width: 110,
    render: (value: unknown) =>
      value ? (
        <Tag color="green">ใช้งาน</Tag>
      ) : (
        <Tag>ปิดใช้งาน</Tag>
      ),
  };
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

  const input = (() => {
    switch (field.type) {
      case "number":
        return (
          <InputNumber
            className="w-full"
            min={field.min}
            precision={0}
          />
        );
      case "switch":
        return <Switch />;
      case "select":
        return (
          <Select
            options={field.options ?? []}
            placeholder={field.placeholder}
            allowClear={!field.required}
            showSearch
            optionFilterProp="label"
          />
        );
      default:
        return <Input maxLength={field.maxLength} placeholder={field.placeholder} />;
    }
  })();

  return (
    <Form.Item
      name={field.key}
      label={field.label}
      rules={rules}
      valuePropName={field.type === "switch" ? "checked" : undefined}
    >
      {input}
    </Form.Item>
  );
}

function CrudPanel({
  config,
  onSave,
  onDelete,
}: {
  config: EntityConfig;
  onSave: (input: FormValues) => Promise<SaveResult>;
  onDelete: (id: number) => Promise<SaveResult>;
}) {
  const router = useRouter();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [pending, startTransition] = useTransition();

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
      const result = await onSave(input);
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
      const result = await onDelete(id);
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
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm leading-6 text-muted">
          จัดการข้อมูลรายการที่ใช้กำหนดสังกัดของบัญชีผู้ใช้งาน
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
        dataSource={config.rows}
        columns={columns}
        size="middle"
        pagination={{ pageSize: 8, showSizeChanger: false }}
        scroll={{ x: "max-content" }}
      />

      <Modal
        forceRender
        open={open}
        title={editing ? `แก้ไข${config.addLabel.replace("เพิ่ม", "")}` : config.addLabel}
        okText="บันทึก"
        cancelText="ยกเลิก"
        confirmLoading={pending}
        onOk={() => form.submit()}
        onCancel={closeModal}
        width={500}
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
    </>
  );
}

function UsersPanel({ data }: { data: UserDirectoryData }) {
  const router = useRouter();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DirectoryUser | null>(null);
  const [pending, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ is_active: true });
    setOpen(true);
  }

  function openEdit(user: DirectoryUser) {
    setEditing(user);
    form.resetFields();
    form.setFieldsValue({
      username: user.username,
      email: user.email,
      citizen_id: user.citizen_id,
      firstname: user.firstname,
      lastname: user.lastname,
      role_id: user.role_id,
      department_id: user.department_id,
      position_id: user.position_id,
      is_active: user.is_active,
      password: "",
      confirm_password: "",
    });
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
      const result = await saveUserAction(input);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(editing ? "บันทึกข้อมูลผู้ใช้งานแล้ว" : "เพิ่มผู้ใช้งานแล้ว");
      setOpen(false);
      setEditing(null);
      router.refresh();
    });
  }

  const columns: NonNullable<TableProps<DirectoryUser>["columns"]> = [
    {
      title: "ชื่อผู้ใช้",
      dataIndex: "username",
      key: "username",
      width: 140,
      render: (value: string) => (
        <span className="font-medium">{value || "—"}</span>
      ),
    },
    {
      title: "ชื่อ-นามสกุล",
      key: "fullname",
      width: 200,
      render: (_: unknown, row: DirectoryUser) =>
        [row.firstname, row.lastname].filter(Boolean).join(" ") || (
          <span className="text-muted">—</span>
        ),
    },
    {
      title: "บทบาท",
      dataIndex: "role_name",
      key: "role_name",
      width: 120,
      render: (value: string | null) =>
        value ? <Tag color="blue">{value}</Tag> : <span className="text-muted">—</span>,
    },
    {
      title: "หน่วยงาน/สังกัด",
      dataIndex: "department_name",
      key: "department_name",
      render: (value: string | null) => value ?? <span className="text-muted">—</span>,
    },
    {
      title: "ตำแหน่ง",
      dataIndex: "position_name",
      key: "position_name",
      render: (value: string | null) => value ?? <span className="text-muted">—</span>,
    },
    {
      title: "สถานะ",
      dataIndex: "is_active",
      key: "is_active",
      width: 110,
      render: (value: unknown) =>
        value ? (
          <Tag color="green">ใช้งาน</Tag>
        ) : (
          <Tag>ปิดใช้งาน</Tag>
        ),
    },
    {
      title: "จัดการ",
      key: "actions",
      width: 80,
      fixed: "right",
      render: (_: unknown, row: DirectoryUser) => (
        <Button
          type="text"
          size="small"
          aria-label="แก้ไขผู้ใช้งาน"
          icon={<Pencil size={16} aria-hidden="true" />}
          onClick={() => openEdit(row)}
          disabled={pending}
        />
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm leading-6 text-muted">
          เพิ่มหรือแก้ไขข้อมูลบัญชีผู้ใช้ บทบาท หน่วยงาน/สังกัด ตำแหน่ง และรหัสผ่าน
          (ผู้ดูแลระบบเท่านั้น)
        </p>
        <Button
          type="primary"
          icon={<Plus size={16} aria-hidden="true" />}
          onClick={openCreate}
          disabled={pending}
        >
          เพิ่มผู้ใช้งาน
        </Button>
      </div>

      <Table<DirectoryUser>
        rowKey="id"
        dataSource={data.users}
        columns={columns}
        size="middle"
        pagination={{ pageSize: 10, showSizeChanger: false }}
        scroll={{ x: "max-content" }}
      />

      <Modal
        forceRender
        open={open}
        title={editing ? `แก้ไขผู้ใช้งาน · ${editing.username}` : "เพิ่มผู้ใช้งาน"}
        okText="บันทึก"
        cancelText="ยกเลิก"
        confirmLoading={pending}
        onOk={() => form.submit()}
        onCancel={closeModal}
        width={620}
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
            <FieldItem
              field={{ key: "username", label: "ชื่อผู้ใช้", type: "text", required: true, maxLength: 150 }}
              form={form}
            />
            <FieldItem
              field={{ key: "email", label: "อีเมล", type: "text", maxLength: 191 }}
              form={form}
            />
            <FieldItem
              field={{ key: "citizen_id", label: "เลขบัตรประชาชน", type: "text", maxLength: 100 }}
              form={form}
            />
            <FieldItem
              field={{ key: "firstname", label: "ชื่อ", type: "text", maxLength: 150 }}
              form={form}
            />
            <FieldItem
              field={{ key: "lastname", label: "นามสกุล", type: "text", maxLength: 150 }}
              form={form}
            />
            <FieldItem
              field={{
                key: "role_id",
                label: "บทบาท",
                type: "select",
                required: true,
                placeholder: "เลือกบทบาท",
                options: data.roles.map((item) => ({
                  value: item.id,
                  label: item.is_active ? item.name : `${item.name} (ปิดใช้งาน)`,
                  disabled: !item.is_active && editing?.role_id !== item.id,
                })),
              }}
              form={form}
            />
            <FieldItem
              field={{
                key: "department_id",
                label: "หน่วยงาน/สังกัด",
                type: "select",
                placeholder: "ไม่ระบุ",
                options: data.departments.map((item) => ({
                  value: item.id,
                  label: item.is_active ? item.name : `${item.name} (ปิดใช้งาน)`,
                  disabled:
                    !item.is_active && editing?.department_id !== item.id,
                })),
              }}
              form={form}
            />
            <FieldItem
              field={{
                key: "position_id",
                label: "ตำแหน่ง",
                type: "select",
                placeholder: "ไม่ระบุ",
                options: data.positions.map((item) => ({
                  value: item.id,
                  label: item.is_active ? item.name : `${item.name} (ปิดใช้งาน)`,
                  disabled: !item.is_active && editing?.position_id !== item.id,
                })),
              }}
              form={form}
            />
            <FieldItem
              field={{ key: "is_active", label: "เปิดใช้งาน", type: "switch" }}
              form={form}
            />
            <div />
            <Form.Item
              name="password"
              label={editing ? "รหัสผ่านใหม่" : "รหัสผ่านเริ่มต้น"}
              rules={[
                ...(editing
                  ? []
                  : [{ required: true, message: "กรุณากรอกรหัสผ่าน" }]),
                { min: 8, message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" },
              ]}
              help={editing ? "ปล่อยว่างหากไม่ต้องการเปลี่ยนรหัสผ่าน" : undefined}
            >
              <Input.Password
                autoComplete="new-password"
                placeholder={editing ? "ปล่อยว่าง = คงรหัสเดิม" : "อย่างน้อย 8 ตัวอักษร"}
              />
            </Form.Item>
            <Form.Item
              name="confirm_password"
              label="ยืนยันรหัสผ่าน"
              dependencies={["password"]}
              rules={[
                ({ getFieldValue }) => ({
                  async validator(_rule, value) {
                    const password = getFieldValue("password");
                    if (!password && !value) return;
                    if (!value) throw new Error("กรุณายืนยันรหัสผ่าน");
                    if (password !== value) {
                      throw new Error("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน");
                    }
                  },
                }),
              ]}
            >
              <Input.Password
                autoComplete="new-password"
                placeholder="กรอกรหัสผ่านอีกครั้ง"
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </>
  );
}

export default function UserAdmin({
  section,
  data,
}: {
  section: DirectorySection;
  data: UserDirectoryData;
}) {
  return (
    <div className="mb-9">
      <Card>
        <div className="mb-5">
          <p className="max-w-2xl text-sm leading-6 text-muted">
            {directoryPages.find((page) => page.id === section)?.description}
          </p>
        </div>

        {section === "directory-departments" && (
          <CrudPanel
            config={{
              addLabel: "เพิ่มหน่วยงาน/สังกัด",
              fields: [
                { key: "name", label: "ชื่อหน่วยงาน/สังกัด", type: "text", required: true, maxLength: 150 },
                { key: "is_active", label: "เปิดใช้งาน", type: "switch" },
              ],
              columns: [
                textColumn("ชื่อหน่วยงาน/สังกัด", "name"),
                boolColumn("สถานะ", "is_active"),
              ],
              defaults: { is_active: true },
              rows: data.departments as unknown as Row[],
            }}
            onSave={saveDepartmentAction}
            onDelete={deleteDepartmentAction}
          />
        )}

        {section === "directory-positions" && (
          <CrudPanel
            config={{
              addLabel: "เพิ่มตำแหน่ง",
              fields: [
                { key: "name", label: "ชื่อตำแหน่ง", type: "text", required: true, maxLength: 150 },
                { key: "is_active", label: "เปิดใช้งาน", type: "switch" },
              ],
              columns: [
                textColumn("ชื่อตำแหน่ง", "name"),
                boolColumn("สถานะ", "is_active"),
              ],
              defaults: { is_active: true },
              rows: data.positions as unknown as Row[],
            }}
            onSave={savePositionAction}
            onDelete={deletePositionAction}
          />
        )}

        {section === "directory-users" && <UsersPanel data={data} />}
      </Card>
    </div>
  );
}
