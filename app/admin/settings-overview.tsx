"use client";

import { useState } from "react";
import { Button, Card, Empty, Input } from "antd";
import { ChevronRight, Search } from "lucide-react";
import { settingsGroups, settingsPages, type SettingsSection } from "@/lib/settings-navigation";
import type { MasterData } from "@/types/master-data";

export default function SettingsOverview({ data, onNavigate }: {
  data: MasterData;
  onNavigate: (section: SettingsSection) => void;
}) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase("th-TH");
  const groups = settingsGroups.map((group) => ({
    ...group,
    pages: settingsPages.filter((page) => page.group === group.id &&
      `${group.title} ${page.title} ${page.description}`.toLocaleLowerCase("th-TH").includes(query)),
  })).filter((group) => group.pages.length > 0);

  return (
    <div className="mb-9 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{settingsPages.length} รายการตั้งค่า · {settingsGroups.length} หมวดหมู่</p>
        <Input
          className="w-full sm:max-w-sm"
          prefix={<Search size={16} aria-hidden="true" />}
          placeholder="ค้นหาการตั้งค่า เช่น หลักสูตร ปีการศึกษา"
          aria-label="ค้นหาการตั้งค่า"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          allowClear
        />
      </div>
      {groups.length > 0 ? (
        <div className="grid items-start gap-5 xl:grid-cols-2">
          {groups.map((group) => {
            const Icon = group.icon;
            return (
              <Card key={group.id} className="h-full" styles={{ body: { padding: 0 } }}>
                <div className="flex items-start gap-3 border-b border-line px-5 py-5 sm:px-6">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <Icon size={21} aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold">{group.title}</h2>
                    <p className="mt-1 text-xs leading-6 text-muted">{group.description}</p>
                  </div>
                </div>
                <div className="space-y-1 p-3">
                  {group.pages.map((page) => {
                    const PageIcon = page.icon;
                    return (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => onNavigate(page.id)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-accent/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        <PageIcon size={18} className="shrink-0 text-muted" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{page.title}</span>
                          <span className="mt-1 block text-xs leading-5 text-muted">{page.description}</span>
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted">{data[page.entity].length.toLocaleString("th-TH")} รายการ</span>
                        <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card><Empty description="ไม่พบการตั้งค่าที่ค้นหา"><Button onClick={() => setSearch("")}>ล้างการค้นหา</Button></Empty></Card>
      )}
    </div>
  );
}
