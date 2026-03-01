"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/app/components/auth-provider";
import { loadSearchHistory } from "@/app/lib/history-storage";

export default function HistoryPage() {
  const router = useRouter();
  const { user, openAuth } = useAuth();
  const isLoggedIn = Boolean(user);
  const ownerKey = user?.user_id ?? user?.email ?? "";

  const records = useMemo(
    () =>
      loadSearchHistory()
        .filter((item) => item.ownerKey === ownerKey)
        .sort((a, b) => {
          return new Date(b.시각).getTime() - new Date(a.시각).getTime();
        }),
    [ownerKey]
  );

  if (!isLoggedIn) {
    return (
      <section className="panel">
        <h2>조회기록</h2>
        <p className="hint">조회기록은 로그인 후 확인할 수 있습니다.</p>
        <button className="btn-primary" onClick={() => openAuth("login")}>
          로그인하고 조회기록 보기
        </button>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>조회기록</h2>
      {records.length === 0 ? (
        <p className="hint">아직 저장된 개별조회 기록이 없습니다.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>순번</th>
              <th>일시</th>
              <th>유형</th>
              <th>주소</th>
              <th>결과건수</th>
            </tr>
          </thead>
          <tbody>
            {records.map((row, idx) => (
              <tr
                key={row.id}
                onClick={() => router.push(`/search?recordId=${row.id}`)}
                style={{ cursor: "pointer" }}
              >
                <td>{idx + 1}</td>
                <td>{formatKST(row.시각)}</td>
                <td>{row.유형}</td>
                <td>{row.주소요약}</td>
                <td>{row.결과.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="hint">행을 클릭하면 개별조회 페이지로 이동하여 해당 주소 결과를 다시 표시합니다.</p>
    </section>
  );
}

function formatKST(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ko-KR", { hour12: false });
}
