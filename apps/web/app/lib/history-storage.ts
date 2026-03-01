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
  const displaySummary = formatSummary(params.summary, params.results);
  const next: SearchHistoryRecord = {
    id: createId(),
    ownerKey: params.ownerKey,
    시각: new Date().toISOString(),
    유형: params.type,
    주소요약: displaySummary,
    결과: params.results,
  };
  const merged = [next, ...existing].slice(0, 200);
  saveSearchHistory(merged);
  return next;
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatSummary(fallback: string, results: LandResultRow[]): string {
  if (results.length > 0) {
    const first = results[0];
    const location = (first.토지소재지 ?? "").trim();
    const jibun = (first.지번 ?? "").trim();
    if (location && jibun) return `${location} ${jibun}`.trim();
    if (location) return location;
  }
  return fallback;
}
