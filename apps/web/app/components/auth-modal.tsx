"use client";

import type { FormEvent, MouseEvent } from "react";
import { useEffect, useState } from "react";

import { useAuth } from "@/app/components/auth-provider";
import type { UserTerms } from "@/app/lib/types";

type AssistMode = "none" | "find-id" | "reset-password";
type RegisterFieldKey =
  | "full_name"
  | "phone_number"
  | "email"
  | "verification_code"
  | "password"
  | "confirm_password"
  | "agreements";

const REMEMBER_ID_KEY = "piljilab_saved_login_email";
const LEGACY_REMEMBER_ID_KEY = "autolv_saved_login_email";

export function AuthModal() {
  const {
    authOpen,
    authMode,
    closeAuth,
    setAuthMode,
    setAuthMessage,
    authMessage,
    authMessageTone,
    authLoading,
    login,
    register,
    sendRecoveryCode,
    findIdByProfile,
    checkEmailAvailability,
    resetPasswordByCode,
    loadPublicTerms,
  } = useAuth();

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberId, setRememberId] = useState(false);

  const [registerName, setRegisterName] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState("");
  const [registerVerificationId, setRegisterVerificationId] = useState("");
  const [registerVerificationCode, setRegisterVerificationCode] = useState("");
  const [registerAgreements, setRegisterAgreements] = useState(false);
  const [registerEmailCheckedValue, setRegisterEmailCheckedValue] = useState("");
  const [registerEmailAvailable, setRegisterEmailAvailable] = useState<boolean | null>(null);
  const [registerEmailCheckLoading, setRegisterEmailCheckLoading] = useState(false);
  const [registerFieldErrors, setRegisterFieldErrors] = useState<Partial<Record<RegisterFieldKey, string>>>({});

  const [findIdName, setFindIdName] = useState("");
  const [findIdPhone, setFindIdPhone] = useState("");

  const [resetEmail, setResetEmail] = useState("");
  const [resetVerificationId, setResetVerificationId] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");

  const [assistMode, setAssistMode] = useState<AssistMode>("none");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterPasswordConfirm, setShowRegisterPasswordConfirm] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetPasswordConfirm, setShowResetPasswordConfirm] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsLoading, setTermsLoading] = useState(false);
  const [terms, setTerms] = useState<UserTerms | null>(null);
  const [backdropPressed, setBackdropPressed] = useState(false);

  const resetAuthForms = (options?: { keepLoginEmail?: boolean }) => {
    const keepLoginEmail = options?.keepLoginEmail ?? false;
    if (!keepLoginEmail) {
      setLoginEmail("");
    }
    setLoginPassword("");
    setRegisterName("");
    setRegisterPhone("");
    setRegisterEmail("");
    setRegisterPassword("");
    setRegisterPasswordConfirm("");
    setRegisterVerificationId("");
    setRegisterVerificationCode("");
    setRegisterAgreements(false);
    setRegisterEmailCheckedValue("");
    setRegisterEmailAvailable(null);
    setRegisterEmailCheckLoading(false);
    setRegisterFieldErrors({});
    setFindIdName("");
    setFindIdPhone("");
    setResetEmail("");
    setResetVerificationId("");
    setResetCode("");
    setResetNewPassword("");
    setResetConfirmPassword("");
    setAssistMode("none");
    setShowLoginPassword(false);
    setShowRegisterPassword(false);
    setShowRegisterPasswordConfirm(false);
    setShowResetPassword(false);
    setShowResetPasswordConfirm(false);
  };

  useEffect(() => {
    if (!authOpen) {
      setBackdropPressed(false);
      setTermsOpen(false);
      return;
    }

    const savedEmail =
      typeof window !== "undefined"
        ? window.localStorage.getItem(REMEMBER_ID_KEY) ?? window.localStorage.getItem(LEGACY_REMEMBER_ID_KEY) ?? ""
        : "";
    const hasSavedEmail = Boolean(savedEmail.trim());
    setRememberId(hasSavedEmail);
    resetAuthForms({ keepLoginEmail: hasSavedEmail });
    if (hasSavedEmail) {
      setLoginEmail(savedEmail);
    }
    setAuthMessage("");
  }, [authOpen, setAuthMessage]);

  useEffect(() => {
    setRegisterVerificationId("");
    setRegisterVerificationCode("");
    setRegisterEmailCheckedValue("");
    setRegisterEmailAvailable(null);
  }, [registerEmail]);

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
      const email = loginEmail.trim();
      await login(email, loginPassword);
      if (typeof window !== "undefined") {
        if (rememberId) {
          window.localStorage.setItem(REMEMBER_ID_KEY, email);
          window.localStorage.removeItem(LEGACY_REMEMBER_ID_KEY);
        } else {
          window.localStorage.removeItem(REMEMBER_ID_KEY);
          window.localStorage.removeItem(LEGACY_REMEMBER_ID_KEY);
        }
      }
      resetAuthForms({ keepLoginEmail: rememberId });
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "로그인 실패", "error");
    }
  };

  const clearRegisterFieldError = (field: RegisterFieldKey) => {
    setRegisterFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateRegisterFields = () => {
    const nextErrors: Partial<Record<RegisterFieldKey, string>> = {};

    if (!registerName.trim()) nextErrors.full_name = "이름은 필수 항목입니다.";
    if (!registerPhone.trim()) nextErrors.phone_number = "연락처는 필수 항목입니다.";
    if (!registerEmail.trim()) nextErrors.email = "이메일은 필수 항목입니다.";
    if (!registerVerificationCode.trim()) nextErrors.verification_code = "인증 코드는 필수 항목입니다.";
    if (!registerPassword) nextErrors.password = "비밀번호는 필수 항목입니다.";
    if (!registerPasswordConfirm) nextErrors.confirm_password = "비밀번호 확인은 필수 항목입니다.";
    if (!registerAgreements) nextErrors.agreements = "필수 약관 동의가 필요합니다.";

    setRegisterFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onRegisterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = registerEmail.trim();
    if (!validateRegisterFields()) {
      setAuthMessage("필수 항목을 입력해 주세요.", "error");
      return;
    }
    if (!registerVerificationId) {
      setRegisterFieldErrors((prev) => ({
        ...prev,
        verification_code: "이메일 중복 확인 후 인증 코드를 먼저 발송해 주세요.",
      }));
      setAuthMessage("이메일 인증 코드를 먼저 발송해 주세요.", "error");
      return;
    }
    if (registerEmailAvailable !== true || registerEmailCheckedValue !== email) {
      setRegisterFieldErrors((prev) => ({
        ...prev,
        email: "이메일 중복 확인을 완료해 주세요.",
      }));
      setAuthMessage("이메일 중복 확인을 완료해 주세요.", "error");
      return;
    }
    try {
      await register({
        full_name: registerName.trim(),
        phone_number: registerPhone.trim(),
        email,
        password: registerPassword,
        confirm_password: registerPasswordConfirm,
        agreements: registerAgreements,
        verification_id: registerVerificationId,
        verification_code: registerVerificationCode.trim(),
      });
      resetAuthForms();
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "회원가입 실패", "error");
    }
  };

  const onCheckEmailAvailability = async () => {
    const email = registerEmail.trim();
    if (!email) {
      setRegisterFieldErrors((prev) => ({ ...prev, email: "이메일은 필수 항목입니다." }));
      setAuthMessage("이메일을 먼저 입력해 주세요.", "error");
      return;
    }
    setRegisterEmailCheckLoading(true);
    try {
      const available = await checkEmailAvailability(email);
      setRegisterEmailCheckedValue(email);
      setRegisterEmailAvailable(available);
      clearRegisterFieldError("email");
      if (available) {
        setAuthMessage("사용 가능한 이메일입니다.", "success");
      } else {
        setAuthMessage("이미 가입된 이메일입니다.", "error");
      }
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "이메일 중복 확인 실패", "error");
    } finally {
      setRegisterEmailCheckLoading(false);
    }
  };

  const onSendSignupCode = async () => {
    const email = registerEmail.trim();
    if (!email) {
      setRegisterFieldErrors((prev) => ({ ...prev, email: "이메일은 필수 항목입니다." }));
      setAuthMessage("이메일을 먼저 입력해 주세요.", "error");
      return;
    }
    if (registerEmailAvailable !== true || registerEmailCheckedValue !== email) {
      setRegisterFieldErrors((prev) => ({
        ...prev,
        email: "이메일 중복 확인을 완료해 주세요.",
      }));
      setAuthMessage("인증 코드 발송 전에 이메일 중복 확인을 완료해 주세요.", "error");
      return;
    }
    try {
      const result = await sendRecoveryCode({
        purpose: "signup",
        email,
      });
      setRegisterVerificationId(result.verification_id);
      clearRegisterFieldError("verification_code");
      if (result.debug_code) {
        setRegisterVerificationCode(result.debug_code);
      }
      setAuthMessage(result.debug_code ? `인증 코드 발송 완료(개발코드: ${result.debug_code})` : result.message, "success");
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "인증 코드 발송 실패", "error");
    }
  };

  const onFindIdSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const result = await findIdByProfile({
        full_name: findIdName.trim(),
        phone_number: findIdPhone.trim(),
      });
      setAuthMessage(`가입된 아이디(이메일): ${result.masked_email}`, "success");
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "아이디 찾기 실패", "error");
    }
  };

  const onSendResetCode = async () => {
    const email = resetEmail.trim();
    if (!email) {
      setAuthMessage("가입 이메일을 먼저 입력해 주세요.", "error");
      return;
    }
    try {
      const result = await sendRecoveryCode({
        purpose: "reset_password",
        email,
      });
      setResetVerificationId(result.verification_id);
      if (result.debug_code) {
        setResetCode(result.debug_code);
      }
      setAuthMessage(result.debug_code ? `인증 코드 발송 완료(개발코드: ${result.debug_code})` : result.message, "success");
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "인증 코드 발송 실패", "error");
    }
  };

  const onResetSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resetVerificationId) {
      setAuthMessage("인증 코드를 먼저 발송해 주세요.", "error");
      return;
    }
    try {
      const message = await resetPasswordByCode({
        email: resetEmail.trim(),
        verification_id: resetVerificationId,
        code: resetCode.trim(),
        new_password: resetNewPassword,
        confirm_new_password: resetConfirmPassword,
      });
      setAuthMessage(message, "success");
      setAssistMode("none");
      setAuthMode("login");
      setResetNewPassword("");
      setResetConfirmPassword("");
      setResetCode("");
      setResetVerificationId("");
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "비밀번호 재설정 실패", "error");
    }
  };

  const onOpenTerms = async () => {
    setTermsOpen(true);
    if (terms) return;
    setTermsLoading(true);
    try {
      const response = await loadPublicTerms();
      setTerms(response);
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "약관 조회 실패", "error");
    } finally {
      setTermsLoading(false);
    }
  };

  const modalTitle =
    assistMode === "find-id" ? "아이디 찾기" : assistMode === "reset-password" ? "비밀번호 찾기" : authMode === "login" ? "로그인" : "회원가입";

  return (
    <>
      <div className="auth-overlay" onMouseDown={onOverlayMouseDown} onMouseUp={onOverlayMouseUp}>
        <div className="auth-modal" onClick={(event) => event.stopPropagation()}>
          <div className="auth-modal-head">
            <h3>{modalTitle}</h3>
            <button onClick={closeAuth} disabled={authLoading}>
              ✕
            </button>
          </div>

          {assistMode === "none" ? (
            <div className="tab-row">
              <button className={`tab-chip ${authMode === "login" ? "on" : ""}`} onClick={() => setAuthMode("login")} disabled={authLoading}>
                로그인
              </button>
              <button className={`tab-chip ${authMode === "register" ? "on" : ""}`} onClick={() => setAuthMode("register")} disabled={authLoading}>
                회원가입
              </button>
            </div>
          ) : (
            <div className="tab-row">
              <button className="tab-chip on" onClick={() => setAssistMode("none")} disabled={authLoading}>
                로그인으로 돌아가기
              </button>
            </div>
          )}

          {assistMode === "find-id" ? (
            <form className="auth-form-grid" onSubmit={(event) => void onFindIdSubmit(event)}>
              <input className="auth-input" placeholder="이름" value={findIdName} onChange={(event) => setFindIdName(event.target.value)} disabled={authLoading} />
              <input
                className="auth-input"
                placeholder="연락처 (숫자 또는 하이픈)"
                value={findIdPhone}
                onChange={(event) => setFindIdPhone(event.target.value)}
                disabled={authLoading}
              />
              <button type="submit" className="btn-primary" disabled={authLoading}>
                {authLoading ? "처리 중..." : "아이디 확인"}
              </button>
            </form>
          ) : null}

          {assistMode === "reset-password" ? (
            <form className="auth-form-grid" onSubmit={(event) => void onResetSubmit(event)}>
              <input
                className="auth-input"
                placeholder="가입 이메일"
                value={resetEmail}
                onChange={(event) => setResetEmail(event.target.value)}
                disabled={authLoading}
              />
              <div className="verification-row">
                <input className="auth-input" placeholder="인증 코드 6자리" value={resetCode} onChange={(event) => setResetCode(event.target.value)} disabled={authLoading} />
                <button type="button" className="nav-item" onClick={() => void onSendResetCode()} disabled={authLoading}>
                  코드 발송
                </button>
              </div>
              <div className="password-field">
                <input
                  className="auth-input"
                  placeholder="새 비밀번호"
                  type={showResetPassword ? "text" : "password"}
                  value={resetNewPassword}
                  onChange={(event) => setResetNewPassword(event.target.value)}
                  disabled={authLoading}
                />
                <button type="button" className="password-toggle" onClick={() => setShowResetPassword((previous) => !previous)} disabled={authLoading}>
                  {showResetPassword ? "숨김" : "보기"}
                </button>
              </div>
              <div className="password-field">
                <input
                  className="auth-input"
                  placeholder="새 비밀번호 확인"
                  type={showResetPasswordConfirm ? "text" : "password"}
                  value={resetConfirmPassword}
                  onChange={(event) => setResetConfirmPassword(event.target.value)}
                  disabled={authLoading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowResetPasswordConfirm((previous) => !previous)}
                  disabled={authLoading}
                >
                  {showResetPasswordConfirm ? "숨김" : "보기"}
                </button>
              </div>
              <button type="submit" className="btn-primary" disabled={authLoading}>
                {authLoading ? "처리 중..." : "비밀번호 재설정"}
              </button>
            </form>
          ) : null}

          {assistMode === "none" && authMode === "login" ? (
            <form className="auth-form-grid" onSubmit={(event) => void onLoginSubmit(event)}>
              <input
                className="auth-input"
                placeholder="이메일"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                disabled={authLoading}
              />
              <div className="password-field">
                <input
                  className="auth-input"
                  placeholder="비밀번호"
                  type={showLoginPassword ? "text" : "password"}
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  disabled={authLoading}
                />
                <button type="button" className="password-toggle" onClick={() => setShowLoginPassword((previous) => !previous)} disabled={authLoading}>
                  {showLoginPassword ? "숨김" : "보기"}
                </button>
              </div>
              <label className="remember-label">
                <input type="checkbox" checked={rememberId} onChange={(event) => setRememberId(event.target.checked)} disabled={authLoading} />
                아이디 저장
              </label>
              <button type="submit" className="btn-primary" disabled={authLoading}>
                {authLoading ? "처리 중..." : "로그인"}
              </button>
              <div className="auth-help-row">
                <button type="button" className="btn-link" onClick={() => setAssistMode("find-id")} disabled={authLoading}>
                  아이디 찾기
                </button>
                <button type="button" className="btn-link" onClick={() => setAssistMode("reset-password")} disabled={authLoading}>
                  비밀번호 찾기
                </button>
              </div>
            </form>
          ) : null}

          {assistMode === "none" && authMode === "register" ? (
            <form className="auth-form-grid" onSubmit={(event) => void onRegisterSubmit(event)}>
              <div className="auth-field">
                <label className="auth-field-label" htmlFor="register-name">
                  이름 <span className="auth-required-mark">*</span>
                </label>
                <input
                  id="register-name"
                  className={`auth-input ${registerFieldErrors.full_name ? "invalid" : ""}`}
                  placeholder="이름 (2~20자, 한글/영문/숫자)"
                  value={registerName}
                  onChange={(event) => {
                    setRegisterName(event.target.value);
                    clearRegisterFieldError("full_name");
                  }}
                  disabled={authLoading}
                />
                {registerFieldErrors.full_name ? <p className="auth-field-error">{registerFieldErrors.full_name}</p> : null}
              </div>

              <div className="auth-field">
                <label className="auth-field-label" htmlFor="register-phone">
                  연락처 <span className="auth-required-mark">*</span>
                </label>
                <input
                  id="register-phone"
                  className={`auth-input ${registerFieldErrors.phone_number ? "invalid" : ""}`}
                  placeholder="연락처 (숫자 또는 하이픈)"
                  value={registerPhone}
                  onChange={(event) => {
                    setRegisterPhone(event.target.value);
                    clearRegisterFieldError("phone_number");
                  }}
                  disabled={authLoading}
                />
                {registerFieldErrors.phone_number ? <p className="auth-field-error">{registerFieldErrors.phone_number}</p> : null}
              </div>

              <div className="auth-field">
                <label className="auth-field-label" htmlFor="register-email">
                  이메일 <span className="auth-required-mark">*</span>
                </label>
                <div className="input-action-field email-action-field">
                  <input
                    id="register-email"
                    className={`auth-input ${registerFieldErrors.email ? "invalid" : ""}`}
                    placeholder="이메일"
                    value={registerEmail}
                    onChange={(event) => {
                      setRegisterEmail(event.target.value);
                      clearRegisterFieldError("email");
                    }}
                    disabled={authLoading || registerEmailCheckLoading}
                  />
                  <button
                    type="button"
                    className="input-action-btn"
                    onClick={() => void onCheckEmailAvailability()}
                    disabled={authLoading || registerEmailCheckLoading}
                  >
                    {registerEmailCheckLoading ? "확인 중" : "중복 확인"}
                  </button>
                </div>
                {registerEmailAvailable === true && registerEmailCheckedValue === registerEmail.trim() ? (
                  <p className="auth-field-help success">사용 가능한 이메일입니다.</p>
                ) : null}
                {registerFieldErrors.email ? <p className="auth-field-error">{registerFieldErrors.email}</p> : null}
              </div>

              <div className="auth-field">
                <label className="auth-field-label" htmlFor="register-code">
                  인증 코드 <span className="auth-required-mark">*</span>
                </label>
                <div className="verification-row">
                  <input
                    id="register-code"
                    className={`auth-input ${registerFieldErrors.verification_code ? "invalid" : ""}`}
                    placeholder="인증 코드 6자리"
                    value={registerVerificationCode}
                    onChange={(event) => {
                      setRegisterVerificationCode(event.target.value);
                      clearRegisterFieldError("verification_code");
                    }}
                    disabled={authLoading}
                  />
                  <button type="button" className="nav-item" onClick={() => void onSendSignupCode()} disabled={authLoading}>
                    코드 발송
                  </button>
                </div>
                {registerFieldErrors.verification_code ? <p className="auth-field-error">{registerFieldErrors.verification_code}</p> : null}
              </div>

              <div className="auth-field">
                <label className="auth-field-label" htmlFor="register-password">
                  비밀번호 <span className="auth-required-mark">*</span>
                </label>
                <div className="password-field">
                  <input
                    id="register-password"
                    className={`auth-input ${registerFieldErrors.password ? "invalid" : ""}`}
                    placeholder="비밀번호 (8~16자, 영문/숫자/특수문자)"
                    type={showRegisterPassword ? "text" : "password"}
                    value={registerPassword}
                    onChange={(event) => {
                      setRegisterPassword(event.target.value);
                      clearRegisterFieldError("password");
                    }}
                    disabled={authLoading}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowRegisterPassword((previous) => !previous)}
                    disabled={authLoading}
                  >
                    {showRegisterPassword ? "숨김" : "보기"}
                  </button>
                </div>
                {registerFieldErrors.password ? <p className="auth-field-error">{registerFieldErrors.password}</p> : null}
              </div>

              <div className="auth-field">
                <label className="auth-field-label" htmlFor="register-password-confirm">
                  비밀번호 확인 <span className="auth-required-mark">*</span>
                </label>
                <div className="password-field">
                  <input
                    id="register-password-confirm"
                    className={`auth-input ${registerFieldErrors.confirm_password ? "invalid" : ""}`}
                    placeholder="비밀번호 확인"
                    type={showRegisterPasswordConfirm ? "text" : "password"}
                    value={registerPasswordConfirm}
                    onChange={(event) => {
                      setRegisterPasswordConfirm(event.target.value);
                      clearRegisterFieldError("confirm_password");
                    }}
                    disabled={authLoading}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowRegisterPasswordConfirm((previous) => !previous)}
                    disabled={authLoading}
                  >
                    {showRegisterPasswordConfirm ? "숨김" : "보기"}
                  </button>
                </div>
                {registerFieldErrors.confirm_password ? <p className="auth-field-error">{registerFieldErrors.confirm_password}</p> : null}
              </div>

              <div className="auth-field auth-check-field">
                <label className="agree-label">
                  <input
                    type="checkbox"
                    checked={registerAgreements}
                    onChange={(event) => {
                      setRegisterAgreements(event.target.checked);
                      clearRegisterFieldError("agreements");
                    }}
                    disabled={authLoading}
                  />
                  <span>
                    <span className="auth-required-mark">*</span> 서비스 이용약관{" "}
                    <button type="button" className="btn-link agree-link" onClick={() => void onOpenTerms()}>
                      보기
                    </button>{" "}
                    및{" "}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className="btn-link agree-link">
                      개인정보처리방침
                    </a>{" "}
                    확인 후 동의합니다
                  </span>
                </label>
                {registerFieldErrors.agreements ? <p className="auth-field-error">{registerFieldErrors.agreements}</p> : null}
              </div>
              <button type="submit" className="btn-primary" disabled={authLoading}>
                {authLoading ? "처리 중..." : "회원가입"}
              </button>
            </form>
          ) : null}

          <p
            className={`auth-message ${
              authMessageTone === "error" ? "error" : authMessageTone === "success" ? "success" : ""
            }`}
          >
            {authMessage}
          </p>
        </div>
      </div>

      {termsOpen ? (
        <div className="auth-overlay terms-overlay" onClick={() => setTermsOpen(false)}>
          <div className="auth-modal terms-modal" onClick={(event) => event.stopPropagation()}>
            <div className="auth-modal-head">
              <h3>서비스 약관</h3>
              <button type="button" onClick={() => setTermsOpen(false)}>
                ✕
              </button>
            </div>
            {termsLoading ? <p className="hint">약관을 불러오는 중입니다...</p> : null}
            {!termsLoading && terms ? (
              <>
                <p className="hint">
                  버전: <strong>{terms.version}</strong>
                </p>
                <pre className="terms-content-box">{terms.content}</pre>
              </>
            ) : null}
            {!termsLoading && !terms ? <p className="hint">약관 정보를 불러오지 못했습니다.</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
