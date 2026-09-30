"use client";

import { useMemo } from "react";

import { Notice } from "@/components/Notice";
import type { Fc27Career } from "@/lib/fc27/read";
import type { SavePlayer } from "@/lib/save/types";

import { Fc27Table, TableNotes } from "./Fc27Table";

export function YouthTab({ career, byId }: { career: Fc27Career; byId: Map<number, SavePlayer> }) {
  const youth = useMemo(
    () =>
      career.youthIds
        .map((id) => byId.get(id))
        .filter((p): p is SavePlayer => Boolean(p))
        .sort((a, b) => (b.potential ?? 0) - (a.potential ?? 0)),
    [career.youthIds, byId],
  );

  if (career.errors.youth) {
    return (
      <Notice tone="error" title="Không đọc được học viện">
        {career.errors.youth}
      </Notice>
    );
  }
  return (
    <div className="space-y-3">
      {career.warnings.youth?.map((w) => (
        <Notice key={w} title="Cần lưu ý">
          {w}
        </Notice>
      ))}
      <p className="text-sm text-mist">
        Học viện của <strong className="text-ghost">{career.club?.name}</strong> ({youth.length} cầu thủ)
        <span className="text-mist-dim"> — danh sách thật đọc từ save, chỉ gồm học viện CLB bạn quản lý.</span>
      </p>
      <Fc27Table players={youth} empty="Bảng học viện (career_youthplayers) trong file save này không có dòng nào. Thường gặp khi career vừa bắt đầu; nếu học viện của bạn đang có cầu thủ trong game, hãy báo lại kèm file save." />
      <TableNotes />
    </div>
  );
}
