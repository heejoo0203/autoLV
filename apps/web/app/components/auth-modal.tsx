"use client";

import type { FormEvent, MouseEvent } from "react";
import { useState } from "react";

import { useAuth } from "@/app/components/auth-provider";

export function AuthModal() {
  const { authOpen, authMode, closeAuth, setAuthMode, setAuthMessage, authMessage, authLoading, login, register } = useAuth();

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterPasswordConfirm, setShowRegisterPasswordConfirm] = useState(false);
  const [registerAgreements, setRegisterAgreements] = useState(false);
  const [backdropPressed, setBackdropPressed] = useState(false);

  if (!authOpen) return null;

  const onOverlayMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    setBackdropPressed(event.target === event.currentTarget);
  };

  const onOverlayMouseUp = (event: MouseEvent<HTMLDivElement>) => {
    const isBackdrop = event.target === event.currentTarget;
    if (backdropPressed && isBackdrop) {
      closeAuth();
    }
    setBackdropPressed(false);
  };

  const onLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await login(loginEmail, loginPassword);
    } catch (e) {
      setAuthMessage(e instanceof Error ? e.message : "로그인 실패");
    }
  };

  const onRegisterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await register({
        full_name: registerName,
        email: registerEmail,
        password: registerPassword,
        confirm_password: registerPasswordConfirm,
        agreements: registerAgreements,
      });
    } catch (e) {
      setAuthMessage(e instanceof Error ? e.message : "회원가입 실패");
    }
  };

  return (
    <div className="auth-overlay" onMouseDown={onOverlayMouseDown} onMouseUp={onOverlayMouseUp}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-head">
          <h3>{authMode === "login" ? "로그인" : "회원가입"}</h3>
          <button onClick={closeAuth}>✕</button>
        </div>

        <div className="tab-row">
          <button className={`tab-chip ${authMode === "login" ? "on" : ""}`} onClick={() => setAuthMode("login")}>
            로그인
          </button>
          <button className={`tab-chip ${authMode === "register" ? "on" : ""}`} onClick={() => setAuthMode("register")}>
            회원가입
          </button>
        </div>

        {authMode === "login" ? (
          <form className="auth-form-grid" onSubmit={(e) => void onLoginSubmit(e)}>
            <input placeholder="이메일" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
            <div className="password-field">
              <input
                placeholder="비밀번호"
                type={showLoginPassword ? "text" : "password"}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowLoginPassword((prev) => !prev)}
              >
                {showLoginPassword ? "숨김" : "보기"}
              </button>
            </div>
            <button type="submit" className="btn-primary" disabled={authLoading}>
              {authLoading ? "처리 중..." : "로그인"}
            </button>
            <div className="auth-help-row">
              <button type="button" className="btn-link" onClick={() => setAuthMessage("아이디 찾기 기능은 준비 중입니다.")}>
                아이디 찾기
              </button>
              <button type="button" className="btn-link" onClick={() => setAuthMessage("비밀번호 찾기 기능은 준비 중입니다.")}>
                비밀번호 찾기
              </button>
            </div>
          </form>
        ) : (
          <form className="auth-form-grid" onSubmit={(e) => void onRegisterSubmit(e)}>
            <input
              placeholder="닉네임 (2~20자, 한글/영문/숫자)"
              value={registerName}
              onChange={(e) => setRegisterName(e.target.value)}
            />
            <input
              placeholder="이메일"
              value={registerEmail}
              onChange={(e) => setRegisterEmail(e.target.value)}
            />
            <div className="password-field">
              <input
                placeholder="비밀번호 (8~16자, 영문/숫자/특수문자)"
                type={showRegisterPassword ? "text" : "password"}
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowRegisterPassword((prev) => !prev)}
              >
                {showRegisterPassword ? "숨김" : "보기"}
              </button>
            </div>
            <div className="password-field">
              <input
                placeholder="비밀번호 확인"
                type={showRegisterPasswordConfirm ? "text" : "password"}
                value={registerPasswordConfirm}
                onChange={(e) => setRegisterPasswordConfirm(e.target.value)}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowRegisterPasswordConfirm((prev) => !prev)}
              >
                {showRegisterPasswordConfirm ? "숨김" : "보기"}
              </button>
            </div>
            <label className="agree-label">
              <input
                type="checkbox"
                checked={registerAgreements}
                onChange={(e) => setRegisterAgreements(e.target.checked)}
              />
              [필수] 서비스 이용약관 및 개인정보 처리방침 동의
            </label>
            <button type="submit" className="btn-primary" disabled={authLoading}>
              {authLoading ? "처리 중..." : "회원가입"}
            </button>
          </form>
        )}

        <p className="auth-message">{authMessage}</p>
      </div>
    </div>
  );
}
