"use client";

import Link from "next/link";

import { useAuth } from "@/app/components/auth-provider";

const quickActions = [
  {
    title: "지도에서 조회",
    description: "필지를 클릭하거나 구역을 그려 공시지가와 사업성 지표를 확인합니다.",
    href: "/map",
    locked: false,
  },
  {
    title: "주소로 조회",
    description: "지번과 도로명을 구조화해 연도별 개별공시지가를 빠르게 확인합니다.",
    href: "/search",
    locked: false,
  },
  {
    title: "파일로 분석",
    description: "CSV/XLSX 파일을 업로드해 대량 주소를 비동기 처리합니다.",
    href: "/files",
    locked: true,
  },
] as const;

const highlights = [
  { label: "개별 조회", value: "지번 · 도로명 기준 단건 분석" },
  { label: "지도 분석", value: "필지 선택 · 지적도 · 구역 집계" },
  { label: "파일 분석", value: "CSV/XLSX 일괄 처리 · 결과 다운로드" },
] as const;

export default function FeaturesPage() {
  const { user, openAuth } = useAuth();
  const isLoggedIn = Boolean(user);

  return (
    <div className="lab-page">
      <section className="lab-hero">
        <div className="lab-hero-copy">
          <span className="lab-eyebrow">Land Intelligence</span>
          <h1>필지와 구역을 데이터로 분석하세요</h1>
          <p>
            필지Lab은 단순 조회 화면이 아니라, 필지와 구역을 빠르게 읽고 판단하는 토지 분석 도구입니다. 개별조회,
            지도 분석, 파일 분석을 한 흐름으로 연결했습니다.
          </p>
          <div className="lab-hero-actions">
            <Link href="/map" className="lab-btn lab-btn-primary">
              지도에서 바로 조회
            </Link>
            <Link href="/search" className="lab-btn lab-btn-secondary">
              주소로 조회하기
            </Link>
            {isLoggedIn ? (
              <Link href="/files" className="lab-btn lab-btn-tertiary">
                파일 업로드 분석
              </Link>
            ) : (
              <button type="button" className="lab-btn lab-btn-tertiary" onClick={() => openAuth("login")}>
                파일 분석은 로그인 필요
              </button>
            )}
          </div>
        </div>

        <div className="lab-hero-panel">
          <div className="lab-hero-panel-grid">
            {highlights.map((item) => (
              <article key={item.label} className="lab-mini-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lab-section">
        <div className="lab-section-head">
          <span className="lab-eyebrow">Quick Actions</span>
          <h2>지금 바로 시작할 작업</h2>
        </div>
        <div className="lab-action-grid">
          {quickActions.map((action) => {
            const cta =
              action.locked && !isLoggedIn ? (
                <button type="button" className="lab-card-link" onClick={() => openAuth("login")}>
                  로그인 후 사용
                </button>
              ) : (
                <Link href={action.href} className="lab-card-link">
                  바로 열기
                </Link>
              );

            return (
              <article key={action.title} className="lab-action-card">
                <span className="lab-card-kicker">{action.title}</span>
                <p>{action.description}</p>
                {cta}
              </article>
            );
          })}
        </div>
      </section>

      <section className="lab-section">
        <div className="lab-section-head">
          <span className="lab-eyebrow">Why PiljiLab</span>
          <h2>조회 툴이 아니라 판단 도구처럼 보이게</h2>
        </div>
        <div className="lab-decision-grid">
          <article className="lab-info-card">
            <h3>지도와 데이터가 붙어 있습니다</h3>
            <p>필지 선택, 지적도, 구역 경계, 포함 필지 시각화가 한 화면에서 이어집니다.</p>
          </article>
          <article className="lab-info-card">
            <h3>결과를 리포트처럼 읽습니다</h3>
            <p>핵심 지표, 상세 이력, 다운로드 액션을 분리해 숫자 나열보다 판단 흐름을 우선합니다.</p>
          </article>
          <article className="lab-info-card">
            <h3>실무자가 보는 기준을 담습니다</h3>
            <p>공시지가뿐 아니라 노후도, 용적률, 과소필지 비율까지 함께 검토할 수 있습니다.</p>
          </article>
        </div>
      </section>
    </div>
  );
}
