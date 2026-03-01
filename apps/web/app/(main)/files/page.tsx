"use client";

import { useAuth } from "@/app/components/auth-provider";

export default function FilesPage() {
  const { user, openAuth } = useAuth();
  const isLoggedIn = Boolean(user);

  if (!isLoggedIn) {
    return (
      <section className="panel">
        <h2>파일 조회</h2>
        <p className="hint">파일 조회는 로그인 후 사용할 수 있습니다.</p>
        <button className="btn-primary" onClick={() => openAuth("login")}>
          로그인하고 파일 조회 사용하기
        </button>
      </section>
    );
  }

  return (
    <>
      <section className="panel">
        <h2>파일 조회</h2>
        <div className="file-grid">
          <div className="dropzone">엑셀 파일 Drag &amp; Drop 또는 클릭 업로드</div>
          <div className="task-box empty">
            <h3>작업 상태</h3>
            <p>진행 중인 작업이 없습니다.</p>
          </div>
        </div>
        <button className="btn-primary full">업로드 및 비동기 처리</button>
      </section>

      <section className="panel">
        <h2>조회 이력</h2>
        <div className="empty-box">아직 파일 조회 이력이 없습니다.</div>
      </section>
    </>
  );
}

