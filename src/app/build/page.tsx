"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";

type AliasMap = Record<string, string>;

type SelectablePaths = {
  realPaths: string[];
  aliases: AliasMap;
};

type SelectableScripts = {
  realNames: string[];
  aliases: AliasMap;
};

type BackupItem = {
  name: string;
  label: string;
};

type BuildServerInfo = {
  id: string;
  name: string;
  host: string;
  config?: {
    mode?: "linux" | "k8s";
    imageName?: string;
    linuxConfig?: {
      sourceDir?: string;
      targetDir?: string;
    };
    k8s?: {
      workDir?: string;
    };
  };
};

function BuildContent() {
  const searchParams = useSearchParams();
  const serverId = searchParams.get('serverId');

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [scripts, setScripts] = useState<SelectableScripts>({ realNames: [], aliases: {} });
  const [selectedScript, setSelectedScript] = useState("");
  const [building, setBuilding] = useState(false);
  const [log, setLog] = useState("");
  
  const [serverInfo, setServerInfo] = useState<BuildServerInfo | null>(null);
  const [folders, setFolders] = useState<SelectablePaths>({ realPaths: [], aliases: {} });
  const [selectedFolder, setSelectedFolder] = useState("/");

  const [uploadProgress, setUploadProgress] = useState(0);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [selectedBackup, setSelectedBackup] = useState("");
  
  const logEndRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      if (!serverId) return;
      const sRes = await fetch("/api/servers");
      const sData: BuildServerInfo[] = await sRes.json();
      const info = sData.find((server) => server.id === serverId) || null;
      if (!active) return;
      setServerInfo(info);

      if (info?.config?.mode === "linux" && info.config?.linuxConfig?.sourceDir) {
        setSelectedFolder(info.config.linuxConfig.sourceDir);
      } else if (info?.config?.mode === "k8s" && info.config?.k8s?.workDir) {
        setSelectedFolder(info.config.k8s.workDir);
      }

      const scRes = await fetch(`/api/scripts?serverId=${serverId}`);
      const scData: SelectableScripts = await scRes.json();
      if (active && scData.realNames) setScripts(scData);

      const fRes = await fetch(`/api/folders?serverId=${serverId}`);
      const fData: SelectablePaths = await fRes.json();
      if (active && fData.realPaths) setFolders(fData);

      if (info?.config?.mode) {
        const bRes = await fetch(`/api/backups?serverId=${serverId}`);
        const bData: { backups?: BackupItem[] } = await bRes.json();
        if (active && bData.backups) setBackups(bData.backups);
      }
    };

    void loadData();

    return () => {
      active = false;
    };
  }, [serverId]);
  useEffect(() => { if (logEndRef.current) logEndRef.current.scrollTop = logEndRef.current.scrollHeight; }, [log]);

  const handleUpload = () => {
    if (!file || !serverId) return;
    setUploading(true);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', selectedFolder);
    formData.append('serverId', serverId);
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 90)); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setUploadProgress(100);
        setLog(prev => prev + `>>> 产物包已分发至源节点: ${file.name}\n`);
        setTimeout(() => { setUploading(false); setFile(null); }, 800);
      } else { setUploading(false); }
    };
    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  };

  const handleAutoDeploy = async () => {
    setBuilding(true);
    setLog(prev => prev + `\n>>> [启动] 流水线任务: ${serverInfo?.name}...\n`);
    try {
      const response = await fetch(`/api/servers/deploy?serverId=${serverId}`);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      while (reader) {
        const { value, done } = await reader.read();
        if (done) break;
        setLog(prev => prev + decoder.decode(value, { stream: true }));
      }
      const refreshRes = await fetch("/api/servers");
      const refreshData: BuildServerInfo[] = await refreshRes.json();
      const refreshedInfo = refreshData.find((server) => server.id === serverId) || null;
      setServerInfo(refreshedInfo);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "未知错误";
      setLog(prev => prev + `\n❌ 部署失败: ${message}`);
    } finally { setBuilding(false); }
  };

  const handleRollback = async () => {
    if (!selectedBackup) return;
    if (!confirm(`确定回滚至版本: ${selectedBackup} ?`)) return;
    setBuilding(true);
    setLog(prev => prev + `\n>>> [指令] 版本回滚启动...\n`);
    try {
      const response = await fetch(`/api/servers/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId, backupFile: selectedBackup })
      });
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      while (reader) {
        const { value, done } = await reader.read();
        if (done) break;
        setLog(prev => prev + decoder.decode(value, { stream: true }));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "未知错误";
      setLog(prev => prev + `\n❌ 回滚异常: ${message}`);
    } finally { setBuilding(false); }
  };

  if (!serverId) return <div className="loading">Initializing...</div>;
  const isLinux = serverInfo?.config?.mode === 'linux';

  return (
    <div className="app-container">
      <div className="bg-blur-effect"></div>
      
      <div className="top-nav">
        <div className="nav-info">
          <div className="server-badge">NODE · {serverInfo?.name}</div>
          <h1 className="main-title">{isLinux ? '自动化部署' : 'K8s 容器化发布'}</h1>
          <p className="nav-copy">支持上传、发布、回滚。</p>
        </div>
        <div className="nav-status">
          <div className={`status-dot ${building ? 'pulsing' : ''}`}></div>
          <span className="status-text">{building ? 'PIPELINE ACTIVE' : 'SYSTEM READY'}</span>
        </div>
      </div>

      <div className="content-grid">
        <div className="control-sidebar">
          
          <div className="neo-card">
            <div className="neo-card-head">资源分发</div>
            <div className="neo-card-body">
              <select className="neo-select" value={selectedFolder} onChange={(e) => setSelectedFolder(e.target.value)}>
                {folders.realPaths.map(p => <option key={p} value={p}>{folders.aliases[p] || p}</option>)}
              </select>
              <div className="neo-upload" onClick={() => document.getElementById('file-in')?.click()}>
                <input type="file" id="file-in" hidden onChange={e => setFile(e.target.files?.[0] || null)} />
                <div className="upload-icon">{file ? '📦' : '📂'}</div>
                <div className="upload-name">{file ? file.name : "点击选择文件上传"}</div>
              </div>
              <button className="neo-btn blue" onClick={handleUpload} disabled={uploading || !file}>
                <span className="btn-label">{uploading ? `上传中 ${uploadProgress}%` : '上传'}</span>
                <div className="shine"></div>
              </button>
            </div>
          </div>

          <div className="neo-card active">
            <div className="neo-card-head">一键全量发布</div>
            <div className="neo-card-body">
              <div className="info-row">
                <span className="info-tag">TARGET</span>
                <span className="info-val">{isLinux ? serverInfo?.config?.linuxConfig?.targetDir : serverInfo?.config?.imageName}</span>
              </div>
              <button className={`neo-btn ${isLinux ? 'green' : 'purple'}`} onClick={handleAutoDeploy} disabled={building}>
                <span className="btn-label">{building ? '正在执行自动化部署' : '启动自动化部署'}</span>
                <div className="shine"></div>
              </button>
            </div>
          </div>

          <div className="neo-card">
            <div className="neo-card-head">灾备回滚</div>
            <div className="neo-card-body">
              <select className="neo-select" value={selectedBackup} onChange={e => setSelectedBackup(e.target.value)}>
                <option value="">-- 选择历史备份 --</option>
                {backups.map((b, idx) => <option key={`${b.name}-${idx}`} value={b.name}>{b.label}</option>)}
              </select>
              <button className="neo-btn amber" onClick={handleRollback} disabled={building || !selectedBackup}>
                <span className="btn-label">执行版本回退</span>
                <div className="shine"></div>
              </button>
            </div>
          </div>

          <div className="neo-card mini">
            <div className="neo-card-body op-flex">
              <select className="neo-select mini" value={selectedScript} onChange={e => setSelectedScript(e.target.value)}>
                <option value="">运维脚本</option>
                {scripts.realNames.map(s => <option key={s} value={s}>{scripts.aliases[s] || s}</option>)}
              </select>
              <button className="neo-btn-outline" onClick={handleAutoDeploy} disabled={building || !selectedScript}>执行</button>
            </div>
          </div>

        </div>

        <div className="log-panel">
          <div className="log-header">
            <div className="win-btns"><span></span><span></span><span></span></div>
            <div className="log-title">REALTIME CONSOLE OUTPUT - {serverInfo?.host}</div>
          </div>
          <pre ref={logEndRef} className="log-content">{log || ">>> 准备就绪，等待指令输入..."}</pre>
        </div>
      </div>

      <style jsx>{`
        .app-container { min-height: calc(100vh - 162px); display: flex; flex-direction: column; padding: 8px 0 0; box-sizing: border-box; overflow: hidden; position: relative; }
        
        .bg-blur-effect { position: absolute; top: -10%; left: -10%; width: 120%; height: 120%; background: radial-gradient(circle at 20% 30%, rgba(186, 214, 255, 0.5), transparent 36%), radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.9), transparent 34%); filter: blur(90px); pointer-events: none; z-index: 0; }

        .top-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; position: relative; z-index: 1; }
        .server-badge { background: rgba(22, 119, 255, 0.08); color: var(--brand); padding: 6px 12px; border-radius: 999px; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; width: fit-content; border: 1px solid rgba(22, 119, 255, 0.12); }
        .main-title { color: var(--text-main); font-size: clamp(1.8rem, 3vw, 2.5rem); font-weight: 700; margin: 12px 0 0 0; letter-spacing: -0.05em; }
        .nav-copy { margin-top: 10px; color: var(--text-soft); line-height: 1.7; max-width: 580px; }
        .nav-status { display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.86); padding: 10px 16px; border-radius: 999px; border: 1px solid rgba(15,23,42,0.08); box-shadow: var(--shadow-sm); }
        .status-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--success); }
        .status-dot.pulsing { background: var(--brand); animation: breathe 1.5s infinite; }
        .status-text { font-size: 10px; font-weight: 700; color: var(--text-soft); letter-spacing: 0.14em; }

        .content-grid { display: flex; gap: 25px; flex: 1; min-height: 0; position: relative; z-index: 1; }
        
        .control-sidebar { flex: 0 0 350px; display: flex; flex-direction: column; gap: 15px; overflow-y: auto; }
        .neo-card { background: rgba(255, 255, 255, 0.9); border: 1px solid rgba(15,23,42,0.06); border-radius: 24px; transition: 0.2s ease; box-shadow: var(--shadow-md); }
        .neo-card:hover { transform: translateY(-1px); }
        .neo-card.active { border-color: rgba(22, 119, 255, 0.12); box-shadow: 0 18px 34px rgba(22, 119, 255, 0.08); }
        
        .neo-card-head { padding: 16px 20px; background: rgba(246,248,251,0.9); border-bottom: 1px solid rgba(15,23,42,0.06); font-size: 0.82rem; font-weight: 700; color: var(--text-main); }
        .neo-card-body { padding: 20px; }

        .neo-select { width: 100%; background: #fbfcfe; border: 1px solid rgba(15,23,42,0.08); color: var(--text-main); padding: 12px 14px; border-radius: 14px; font-size: 13px; outline: none; margin-bottom: 15px; cursor: pointer; transition: 0.2s; }
        .neo-select:focus { border-color: rgba(22,119,255,0.18); box-shadow: 0 0 0 4px rgba(22, 119, 255, 0.08); }

        .neo-upload { border: 1px dashed rgba(15,23,42,0.12); border-radius: 18px; padding: 22px; text-align: center; cursor: pointer; background: var(--bg-soft); transition: 0.2s; margin-bottom: 15px; }
        .neo-upload:hover { border-color: rgba(22,119,255,0.18); background: rgba(22, 119, 255, 0.05); }
        .upload-icon { font-size: 28px; margin-bottom: 8px; }
        .upload-name { font-size: 12px; color: var(--text-soft); font-weight: 600; }

        .neo-btn { position: relative; width: 100%; padding: 15px; border-radius: 18px; border: none; color: #fff; font-weight: 600; font-size: 14px; cursor: pointer; overflow: hidden; transition: 0.25s ease; display: flex; align-items: center; justify-content: center; }
        .neo-btn:active { transform: scale(0.97); }
        .neo-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        
        .blue { background: linear-gradient(180deg, #2990ff, var(--brand)); box-shadow: 0 10px 22px rgba(22, 119, 255, 0.16); }
        .green { background: linear-gradient(180deg, #2bcb9a, var(--success)); box-shadow: 0 10px 22px rgba(18, 185, 129, 0.16); }
        .purple { background: linear-gradient(180deg, #5ea8ff, var(--brand)); box-shadow: 0 10px 22px rgba(22, 119, 255, 0.16); }
        .amber { background: linear-gradient(180deg, #ffbb52, var(--warning)); box-shadow: 0 10px 22px rgba(245, 158, 11, 0.16); }

        .shine { position: absolute; top: -50%; left: -120%; width: 50%; height: 200%; background: linear-gradient(to right, transparent, rgba(255,255,255,0.3), transparent); transform: rotate(25deg); transition: 0.6s; pointer-events: none; }
        .neo-btn:hover .shine { left: 150%; }

        .info-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; background: var(--bg-soft); padding: 12px 14px; border-radius: 14px; border: 1px solid rgba(15,23,42,0.06); }
        .info-tag { font-size: 9px; font-weight: 900; color: var(--text-faint); letter-spacing: 0.08em; }
        .info-val { font-size: 11px; font-weight: 700; color: var(--text-soft); font-family: "JetBrains Mono", "SFMono-Regular", monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }

        .op-flex { display: flex; gap: 10px; padding: 15px; }
        .op-flex .neo-select { margin-bottom: 0; flex: 1; }
        .neo-btn-outline { height: 42px; background: #fff; border: 1px solid rgba(15,23,42,0.08); color: var(--text-soft); padding: 0 20px; border-radius: 12px; font-weight: 600; cursor: pointer; transition: 0.2s; }
        .neo-btn-outline:hover { color: var(--brand); border-color: rgba(22,119,255,0.14); background: rgba(22,119,255,0.05); }

        .log-panel { flex: 1; background: rgba(255,255,255,0.9); border-radius: 28px; border: 1px solid rgba(15,23,42,0.06); display: flex; flex-direction: column; overflow: hidden; box-shadow: var(--shadow-md); }
        .log-header { padding: 16px 22px; background: rgba(246,248,251,0.92); border-bottom: 1px solid rgba(15,23,42,0.06); display: flex; align-items: center; gap: 20px; }
        .win-btns { display: flex; gap: 8px; }
        .win-btns span { width: 12px; height: 12px; border-radius: 50%; }
        .win-btns span:nth-child(1) { background: #ff5f56; }
        .win-btns span:nth-child(2) { background: #ffbd2e; }
        .win-btns span:nth-child(3) { background: #27c93f; }
        .log-title { font-size: 11px; font-family: "JetBrains Mono", "SFMono-Regular", monospace; color: var(--text-faint); font-weight: bold; letter-spacing: 0.08em; }
        .log-content { flex: 1; margin: 0; padding: 26px; color: #223047; background: rgba(250,252,255,0.95); font-family: "JetBrains Mono", "SFMono-Regular", monospace; font-size: 13px; line-height: 1.75; overflow-y: auto; white-space: pre-wrap; }

        @keyframes breathe { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.7; } }
        .loading { height: 100vh; display: flex; align-items: center; justify-content: center; color: var(--brand); font-weight: 900; }

        @media (max-width: 1024px) {
          .content-grid {
            flex-direction: column;
          }

          .control-sidebar {
            flex: none;
          }
        }

        @media (max-width: 720px) {
          .app-container {
            min-height: auto;
          }

          .top-nav {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }

          .log-content {
            padding: 20px;
          }
        }
      `}</style>
    </div>
  );
}

export default function BuildPage() {
  return <Suspense fallback={<div>Loading...</div>}><BuildContent /></Suspense>;
}
