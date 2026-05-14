"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (data.success) {
        router.push("/servers");
        router.refresh();
      } else {
        setError(data.message || "登录失败");
      }
    } catch {
      setError("无法连接到服务器");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <section className="glass-panel login-box fade-in">
        <div className="login-header">
          <div className="logo-icon-large">CI</div>
          <span className="login-label">Server Console</span>
          <h1>欢迎回来</h1>
          <p>请输入账号信息，进入自动化发布工作台。</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          <div className="input-group">
            <label htmlFor="username">用户名</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入账号"
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">密码</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? "正在验证..." : "进入控制台"}
          </button>
        </form>
      </section>

      <style jsx>{`
        .login-container {
          min-height: calc(100vh - 44px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        .login-box {
          width: min(100%, 430px);
          padding: 30px 26px;
          border-radius: 32px;
        }

        .login-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 10px;
          margin-bottom: 28px;
        }

        .logo-icon-large {
          width: 66px;
          height: 66px;
          border-radius: 22px;
          display: grid;
          place-items: center;
          background: linear-gradient(180deg, #2990ff, var(--brand));
          color: #fff;
          font-weight: 700;
          letter-spacing: 0.08em;
          box-shadow: 0 16px 30px rgba(22, 119, 255, 0.16);
        }

        .login-label {
          color: var(--brand);
          font-size: 0.76rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          margin-top: 4px;
        }

        h1 {
          font-size: 1.95rem;
          font-weight: 700;
          letter-spacing: -0.05em;
        }

        .login-header p {
          color: var(--text-soft);
          font-size: 0.96rem;
          line-height: 1.7;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .input-group label {
          font-size: 0.76rem;
          color: var(--text-soft);
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-weight: 700;
        }

        .input-group input {
          min-height: 54px;
          background: #fbfcfe;
          border: 1px solid rgba(15, 23, 42, 0.08);
          padding: 0 16px;
          border-radius: 16px;
          color: var(--text-main);
          outline: none;
          transition: all 0.22s ease;
        }

        .input-group input:focus {
          border-color: rgba(22, 119, 255, 0.18);
          box-shadow: 0 0 0 4px rgba(22, 119, 255, 0.08);
        }

        .error-message {
          color: #c24141;
          font-size: 0.88rem;
          text-align: center;
          background: rgba(239, 68, 68, 0.08);
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid rgba(239, 68, 68, 0.12);
        }

        .login-btn {
          width: 100%;
          min-height: 52px;
          margin-top: 4px;
        }

        @media (max-width: 640px) {
          .login-container {
            padding: 18px;
          }

          .login-box {
            padding: 24px 18px;
          }
        }
      `}</style>
    </div>
  );
}
