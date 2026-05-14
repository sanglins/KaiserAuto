"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import "./globals.css";

function getRoleFromCookie() {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split("; ");
  const roleCookie = cookies.find((row) => row.startsWith("user_role="));
  return roleCookie ? roleCookie.split("=")[1] : null;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    setRole(getRoleFromCookie());
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/login', { method: 'DELETE' });
    router.push('/login');
  };

  return (
    <html lang="zh">
      <head>
        <title>KaiserAuto | 高级自动化发布控制台</title>
        <meta name="description" content="Next Generation Jenkins Management" />
      </head>
      <body>
        <div className="layout-wrapper">
          {!isLoginPage && (
            <aside className="sidebar-aside glass-panel">
              <div className="brand-copy">
                <img src="/logo.png" alt="KaiserAuto Logo" className="brand-logo-img" />
                <strong>KaiserAuto</strong>
                <span>自动化发布控制台</span>
              </div>
              <nav className="sidebar-nav">
                <Link
                  href="/servers"
                  className={`nav-item ${pathname === "/servers" || pathname === "/" ? "active" : ""}`}
                  title="自动化发布"
                >
                  <strong>•</strong>
                  <span>自动化发布</span>
                </Link>
                <Link
                  href="/about"
                  className={`nav-item ${pathname === "/about" ? "active" : ""}`}
                  title="关于项目"
                >
                  <strong>•</strong>
                  <span>关于项目</span>
                </Link>
                {/* <Link
                  href="/tasks"
                  className={`nav-item ${pathname === "/tasks" ? "active" : ""}`}
                  title="脚本任务"
                >
                  <strong>•</strong>
                  <span>脚本任务</span>
                </Link> */}
              </nav>
            </aside>
          )}

          <main className={isLoginPage ? "full-screen" : "main-content-area"}>
            {!isLoginPage && (
              <div className="main-content-frame">
                <header className="top-status-bar">
                  <div className="user-profile">
                    <span className="role-badge">
                      <span className="role-dot"></span>
                      {role === 'admin' ? '管理员模式' : '操作员模式'}
                    </span>
                    <button className="top-logout-btn" onClick={handleLogout}>退出登录</button>
                  </div>
                </header>
                <div className="main-content-inner">
                  {children}
                </div>
                <footer className="global-footer">Powered by Kaiser</footer>
              </div>
            )}

            {isLoginPage && (
              <>
                {children}
                <footer className="global-footer">Powered by Kaiser</footer>
              </>
            )}
          </main>
        </div>
      </body>
    </html>
  );
}
