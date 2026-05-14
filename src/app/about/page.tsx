"use client";

import React from "react";

export default function AboutPage() {
  return (
    <div className="page-shell fade-in">
      <header className="page-hero">
        <div className="hero-content">
          <div className="page-kicker">ABOUT PROJECT</div>
          <h1 className="page-title">关于</h1>
          <p className="page-copy">
            我们致力于简化 CI/CD 流程，提供直观、高效且美观的管理界面。
            为开源社区贡献一份力量。
          </p>
        </div>
        <div className="hero-actions">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginRight: "8px" }}
            >
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
            </svg>
            GitHub
          </a>
        </div>
      </header>

      <section className="about-section glass-panel">
        <div className="section-header">
          <h2 className="modal-title">投喂作者</h2>
          <p className="modal-subtitle">如果您觉得这个项目对您有帮助，可以请作者喝杯咖啡 ☕️</p>
        </div>

        <div className="donation-grid">
          <div className="donation-card surface-panel">
            <div className="qr-placeholder">
              {/* 图片路径预留：支付宝 */}
              <img src="/qr_alipay.png" alt="支付宝收款码" className="qr-image" />
            </div>
            <div className="donation-label">支付宝</div>
          </div>

          <div className="donation-card surface-panel">
            <div className="qr-placeholder">
              <img src="/qr_wechat.png" alt="微信收款码" className="qr-image" />
            </div>
            <div className="donation-label">微信</div>
          </div>
        </div>
      </section>



      <style jsx>{`
        .about-section {
          padding: 40px;
          margin-top: 24px;
        }
        .section-header {
          text-align: center;
          margin-bottom: 48px;
        }
        .donation-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 32px;
          justify-content: center;
        }
        .donation-card {
          padding: 24px;
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .donation-card:hover {
          transform: translateY(-8px);
          box-shadow: var(--shadow-lg);
        }
        .qr-placeholder {
          position: relative;
          width: 200px;
          height: 200px;
          background: #fff;
          border-radius: var(--radius-md);
          overflow: hidden;
          border: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
        }
        .qr-image {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .qr-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(to top, rgba(22, 119, 255, 0.9), rgba(22, 119, 255, 0.7));
          color: white;
          padding: 10px;
          text-align: center;
          font-size: 13px;
          font-weight: 600;
          backdrop-filter: blur(4px);
        }
        .donation-label {
          font-weight: 700;
          color: var(--text-main);
          font-size: 1.1rem;
        }
        .oss-section {
          margin-top: 32px;
          padding: 60px 40px;
          text-align: center;
          background: linear-gradient(135deg, rgba(255,255,255,0.8), rgba(22,119,255,0.05));
        }
        .oss-content h3 {
          font-size: 2rem;
          font-weight: 800;
          margin: 16px 0;
          background: linear-gradient(to right, var(--text-main), var(--brand));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .oss-content p {
          max-width: 600px;
          margin: 0 auto 32px;
          color: var(--text-soft);
          line-height: 1.8;
        }
        .github-footer-link {
          min-width: 240px;
        }
      `}</style>
    </div>
  );
}
