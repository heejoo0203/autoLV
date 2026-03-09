"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/app/components/auth-provider";
import { BrandLogo } from "@/app/components/brand-logo";

type NavItem = {
  label: string;
  href: string;
  key: string;
  requiresAuth?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { key: "features", label: "서비스 소개", href: "/features" },
  { key: "map", label: "지도 분석", href: "/map", requiresAuth: true },
  { key: "search", label: "개별 조회", href: "/search" },
  { key: "files", label: "파일 분석", href: "/files", requiresAuth: true },
  { key: "history", label: "이용내역", href: "/history", requiresAuth: true },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, openAuth, logout } = useAuth();

  const isLoggedIn = Boolean(user);
  const activeKey =
    pathname === "/"
      ? "features"
      : pathname.startsWith("/map")
        ? "map"
        : pathname.startsWith("/search")
          ? "search"
          : pathname.startsWith("/files")
            ? "files"
            : pathname.startsWith("/history")
              ? "history"
              : pathname.startsWith("/features")
                ? "features"
                : "";

  const openProtected = (href: string) => {
    if (!isLoggedIn) {
      openAuth("login");
      return;
    }
    router.push(href);
  };

  return (
    <div className="app-shell">
      <header className="lab-header">
        <BrandLogo href="/features" size="md" withTagline />

        <nav className="lab-header-nav" aria-label="주요 메뉴">
          {NAV_ITEMS.map((item) =>
            item.requiresAuth && !isLoggedIn ? (
              <button
                key={item.key}
                type="button"
                className={`lab-nav-link ${activeKey === item.key ? "active" : ""}`}
                onClick={() => openProtected(item.href)}
              >
                {item.label}
              </button>
            ) : (
              <Link key={item.key} href={item.href} className={`lab-nav-link ${activeKey === item.key ? "active" : ""}`}>
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="lab-header-actions">
          {isLoggedIn ? (
            <>
              <Link href="/mypage" className={`lab-nav-link subtle ${pathname === "/mypage" ? "active" : ""}`}>
                마이페이지
              </Link>
              <button
                className="lab-nav-link danger"
                type="button"
                onClick={async () => {
                  await logout();
                  router.push("/features");
                }}
              >
                로그아웃
              </button>
            </>
          ) : (
            <button className="lab-nav-link filled" type="button" onClick={() => openAuth("login")}>
              로그인
            </button>
          )}
        </div>
      </header>

      <main className={`content-wrap ${pathname === "/map" ? "content-wrap-bleed" : ""}`}>{children}</main>

      <footer className="site-footer">
        <Link href="/privacy">개인정보처리방침</Link>
        <span>·</span>
        <Link href="/account-deletion">계정 삭제</Link>
        <span>·</span>
        <Link href="/features">서비스 소개</Link>
      </footer>

      <nav className="mobile-dock" aria-label="모바일 바로가기">
        <Link href="/features" className={activeKey === "features" ? "active" : ""}>
          소개
        </Link>
        <Link href="/search" className={activeKey === "search" ? "active" : ""}>
          개별조회
        </Link>
        <button
          type="button"
          className={activeKey === "map" ? "active" : ""}
          onClick={() => openProtected("/map")}
        >
          지도분석
        </button>
        {isLoggedIn ? (
          <Link href="/history" className={activeKey === "history" ? "active" : ""}>
            내역
          </Link>
        ) : (
          <button type="button" onClick={() => openAuth("login")}>
            로그인
          </button>
        )}
      </nav>
    </div>
  );
}
