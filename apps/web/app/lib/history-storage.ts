"use client";

import type { LandResultRow, SearchHistoryRecord, SearchTab } from "@/app/lib/types";

const KEY = "autolv_search_history_v1";

export function loadSearchHistory(): SearchHistoryRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SearchHistoryRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSearchHistory(records: SearchHistoryRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(records));
}

export function addSearchHistory(params: {
  ownerKey: string;
  type: SearchTab;
  summary: string;
  results: LandResultRow[];
}) {
  const existing = loadSearchHistory();
  const next: SearchHistoryRecord = {
    id: createId(),
    ownerKey: params.ownerKey,
    시각: new Date().toISOString(),
    유형: params.type,
    주소요약: params.summary,
    결과: params.results,
  };
  const merged = [next, ...existing].slice(0, 200);
  saveSearchHistory(merged);
  return next;
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
