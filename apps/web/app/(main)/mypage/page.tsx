"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/app/components/auth-provider";
import type { UserTerms } from "@/app/lib/types";

export default function MyPage() {
  const {
    user,
    openAuth,
    authLoading,
    authMessage,
    updateProfile,
    changePassword,
    deleteAccount,
    loadTerms,
    expectedWithdrawalText,
  } = useAuth();

  const isLoggedIn = Boolean(user);
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [profileImage, setProfileImage] = useState<File | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [withdrawText, setWithdrawText] = useState("");
  const [terms, setTerms] = useState<UserTerms | null>(null);
  const [termsLoading, setTermsLoading] = useState(false);
  const [pageMessage, setPageMessage] = useState("");
  const [actionMessage, setActionMessage] = useState<{
    target: "profile" | "password" | "withdrawal";
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [activeAction, setActiveAction] = useState<null | "profile" | "password" | "withdrawal">(null);
  const androidApkPath = "/downloads/autoLV-android-release-v2.2.0.apk";

  useEffect(() => {
    if (!isLoggedIn) return;
    setFullName(user?.full_name ?? "");
    setPhoneNumber(user?.phone_number ?? "");
  }, [isLoggedIn, user?.full_name, user?.phone_number]);

  useEffect(() => {
    if (!isLoggedIn) return;
    let ignore = false;
    const run = async () => {
      setTermsLoading(true);
      try {
        const payload = await loadTerms();
        if (ignore) return;
        setTerms(payload);
      } catch (error) {
        if (ignore) return;
        setPageMessage(error instanceof Error ? error.message : "약관을 불러오지 못했습니다.");
      } finally {
        if (!ignore) setTermsLoading(false);
      }
    };
    void run();
    return () => {
      ignore = true;
    };
  }, [isLoggedIn, loadTerms]);

  const mergedMessage = useMemo(() => pageMessage || authMessage, [pageMessage, authMessage]);

  if (!isLoggedIn) {
    return (
      <div className="lab-page mypage-page">
        <section className="lab-hero mypage-hero-shell">
          <div className="lab-hero-copy">
            <span className="lab-eyebrow">My PiljiLab</span>
            <h1>계정과 서비스 설정을 한 화면에서 관리합니다.</h1>
            <p>회원 정보, 보안, 약관 동의 내역, 앱 다운로드와 계정 삭제를 마이페이지에서 정리했습니다.</p>
          </div>
          <div className="lab-hero-panel-grid">
            <article className="lab-mini-card">
              <span>프로필</span>
              <strong>이름 · 연락처 · 이미지 수정</strong>
            </article>
            <article className="lab-mini-card">
              <span>보안</span>
              <strong>비밀번호 변경 · 탈퇴 확인</strong>
            </article>
          </div>
        </section>
        <section className="lab-surface">
          <div className="lab-section-head">
            <h2>마이페이지는 로그인 후 사용할 수 있습니다.</h2>
            <p>로그인 후 계정 설정, 약관 확인, 앱 다운로드 기능을 이용할 수 있습니다.</p>
          </div>
          <button className="lab-btn lab-btn-primary" onClick={() => openAuth("login")}>
            로그인하고 마이페이지 열기
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="lab-page mypage-page">
      <section className="lab-hero mypage-hero-shell">
        <div className="lab-hero-copy">
          <span className="lab-eyebrow">My PiljiLab</span>
          <h1>계정과 서비스 설정을 한 화면에서 다룹니다.</h1>
          <p>프로필 수정, 보안 관리, 약관 확인, 앱 다운로드, 계정 삭제를 운영형 서비스 흐름에 맞춰 정리했습니다.</p>
          {mergedMessage ? <p className="hint">{mergedMessage}</p> : null}
        </div>
        <div className="lab-hero-panel-grid">
          <article className="lab-mini-card">
            <span>이름</span>
            <strong>{user?.full_name || "-"}</strong>
          </article>
          <article className="lab-mini-card">
            <span>이메일</span>
            <strong>{user?.email || "-"}</strong>
          </article>
          <article className="lab-mini-card">
            <span>연락처</span>
            <strong>{user?.phone_number || "-"}</strong>
          </article>
          <article className="lab-mini-card">
            <span>권한</span>
            <strong>{user?.role || "user"}</strong>
          </article>
        </div>
      </section>

      <section className="mypage-layout">
        <article className="lab-surface mypage-card-pro">
          <div className="lab-section-head compact">
            <h2>회원 정보 수정</h2>
            <p>이름, 연락처, 프로필 이미지를 최신 상태로 유지합니다.</p>
          </div>
          <label className="field-label" htmlFor="mypage-name">
            이름
          </label>
          <input
            id="mypage-name"
            className="auth-input"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="이름"
          />

          <label className="field-label" htmlFor="mypage-phone">
            연락처
          </label>
          <input
            id="mypage-phone"
            className="auth-input"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="연락처 (숫자 또는 하이픈)"
          />

          <label className="field-label" htmlFor="mypage-image">
            프로필 이미지
          </label>
          <input
            id="mypage-image"
            className="auth-input"
            type="file"
            accept=".png,.jpg,.jpeg,.webp"
            onChange={(event) => setProfileImage(event.target.files?.[0] ?? null)}
          />

          <button
            type="button"
            className="lab-btn lab-btn-primary"
            disabled={authLoading}
            onClick={async () => {
              setPageMessage("");
              setActionMessage(null);
              setActiveAction("profile");
              try {
                await updateProfile({ full_name: fullName, phone_number: phoneNumber, profile_image: profileImage });
                setProfileImage(null);
                setActionMessage({
                  target: "profile",
                  tone: "success",
                  text: "회원정보가 저장되었습니다.",
                });
              } catch (error) {
                setActionMessage({
                  target: "profile",
                  tone: "error",
                  text: error instanceof Error ? error.message : "회원정보 저장에 실패했습니다.",
                });
              } finally {
                setActiveAction(null);
              }
            }}
          >
            {authLoading && activeAction === "profile" ? "저장 중..." : "저장"}
          </button>
          {actionMessage?.target === "profile" ? (
            <p className={`auth-message ${actionMessage.tone}`}>{actionMessage.text}</p>
          ) : null}
        </article>

        <article className="lab-surface mypage-card-pro">
          <div className="lab-section-head compact">
            <h2>비밀번호 변경</h2>
            <p>기존 비밀번호 확인 후 새 비밀번호로 교체합니다.</p>
          </div>
          <label className="field-label" htmlFor="mypage-current-password">
            기존 비밀번호
          </label>
          <input
            id="mypage-current-password"
            className="auth-input"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="기존 비밀번호"
          />

          <label className="field-label" htmlFor="mypage-new-password">
            새 비밀번호
          </label>
          <input
            id="mypage-new-password"
            className="auth-input"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="새 비밀번호"
          />

          <label className="field-label" htmlFor="mypage-confirm-password">
            새 비밀번호 확인
          </label>
          <input
            id="mypage-confirm-password"
            className="auth-input"
            type="password"
            value={confirmNewPassword}
            onChange={(event) => setConfirmNewPassword(event.target.value)}
            placeholder="새 비밀번호 확인"
          />

          <button
            type="button"
            className="lab-btn lab-btn-primary"
            disabled={authLoading}
            onClick={async () => {
              setPageMessage("");
              setActionMessage(null);
              if (!currentPassword || !newPassword || !confirmNewPassword) {
                setActionMessage({
                  target: "password",
                  tone: "error",
                  text: "기존 비밀번호와 새 비밀번호 항목을 모두 입력해 주세요.",
                });
                return;
              }
              if (newPassword !== confirmNewPassword) {
                setActionMessage({
                  target: "password",
                  tone: "error",
                  text: "새 비밀번호와 새 비밀번호 확인이 일치하지 않습니다.",
                });
                return;
              }
              setActiveAction("password");
              try {
                await changePassword({
                  current_password: currentPassword,
                  new_password: newPassword,
                  confirm_new_password: confirmNewPassword,
                });
                setCurrentPassword("");
                setNewPassword("");
                setConfirmNewPassword("");
                setActionMessage({
                  target: "password",
                  tone: "success",
                  text: "비밀번호가 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용해 주세요.",
                });
              } catch (error) {
                setActionMessage({
                  target: "password",
                  tone: "error",
                  text: error instanceof Error ? error.message : "비밀번호 변경에 실패했습니다.",
                });
              } finally {
                setActiveAction(null);
              }
            }}
          >
            {authLoading && activeAction === "password" ? "변경 중..." : "비밀번호 변경"}
          </button>
          <p className="hint">비밀번호는 8~16자, 영문/숫자/특수문자를 각각 1자 이상 포함해야 합니다.</p>
          {actionMessage?.target === "password" ? (
            <p className={`auth-message ${actionMessage.tone}`}>{actionMessage.text}</p>
          ) : null}
        </article>

        <article className="lab-surface mypage-card-pro">
          <div className="lab-section-head compact">
            <h2>서비스 약관</h2>
            <p>회원가입 시 동의한 약관 버전과 전문을 다시 확인할 수 있습니다.</p>
          </div>
          {termsLoading ? <p className="hint">약관을 불러오는 중입니다...</p> : null}
          {!termsLoading && terms ? (
            <>
              <p className="hint">
                동의 버전: <strong>{terms.version}</strong>
                <br />
                동의 일시: {terms.accepted_at ? new Date(terms.accepted_at).toLocaleString("ko-KR") : "-"}
              </p>
              <pre className="terms-content-box">{terms.content}</pre>
            </>
          ) : null}
          {!termsLoading && !terms ? <p className="hint">약관 정보를 불러오지 못했습니다.</p> : null}
        </article>

        <article className="lab-surface mypage-card-pro">
          <div className="lab-section-head compact">
            <h2>앱 다운로드</h2>
            <p>안드로이드 기기에서 필지랩 앱을 설치해 모바일 환경에서 바로 사용할 수 있습니다.</p>
          </div>
          <a className="lab-btn lab-btn-primary full" href={androidApkPath} download target="_blank" rel="noopener noreferrer">
            필지랩 안드로이드 APK 다운로드
          </a>
          <p className="hint">현재 권장 다운로드 버전: v2.2.0</p>
        </article>

        <article className="lab-surface mypage-card-pro danger-zone">
          <div className="lab-section-head compact">
            <h2>회원 탈퇴</h2>
            <p>확인 문구를 정확히 입력해야 탈퇴할 수 있습니다.</p>
          </div>
          <p className="danger-guide">
            <strong>{expectedWithdrawalText}</strong>
          </p>
          <input
            className="auth-input"
            value={withdrawText}
            onChange={(event) => setWithdrawText(event.target.value)}
            placeholder="확인 문구 입력"
          />
          <button
            type="button"
            className="lab-btn lab-btn-danger full"
            disabled={authLoading}
            onClick={async () => {
              setPageMessage("");
              setActionMessage(null);
              setActiveAction("withdrawal");
              try {
                await deleteAccount(withdrawText);
              } catch (error) {
                setActionMessage({
                  target: "withdrawal",
                  tone: "error",
                  text: error instanceof Error ? error.message : "회원 탈퇴에 실패했습니다.",
                });
              } finally {
                setActiveAction(null);
              }
            }}
          >
            {authLoading && activeAction === "withdrawal" ? "탈퇴 처리 중..." : "회원 탈퇴"}
          </button>
          {actionMessage?.target === "withdrawal" ? (
            <p className={`auth-message ${actionMessage.tone}`}>{actionMessage.text}</p>
          ) : null}
        </article>
      </section>
    </div>
  );
}
