"use client";

import { useEffect, useState, useRef } from "react";

interface Task {
  id: string;
  name: string;
  imageName: string;
  targetDir: string;
  k8sHost: string;
  k8sUser: string;
  k8sPassword: string;
  k8sNamespace: string;
  k8sDeployment: string;
  k8sContainer: string;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [logs, setLogs] = useState("");
  const [showLogs, setShowLogs] = useState(false);
  const logEndRef = useRef<HTMLPreElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    imageName: "",
    targetDir: "",
    k8sHost: "",
    k8sUser: "",
    k8sPassword: "",
    k8sNamespace: "default",
    k8sDeployment: "",
    k8sContainer: "",
  });

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollTop = logEndRef.current.scrollHeight;
    }
  }, [logs]);

  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      setTasks(data);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingTask(null);
    setFormData({
      name: "",
      imageName: "",
      targetDir: "",
      k8sHost: "",
      k8sUser: "",
      k8sPassword: "",
      k8sNamespace: "default",
      k8sDeployment: "",
      k8sContainer: "",
    });
    setShowModal(true);
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setFormData({ ...task });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除该任务吗？")) return;
    try {
      await fetch(`/api/tasks?id=${id}`, { method: "DELETE" });
      fetchTasks();
    } catch (error) {
      alert("删除失败");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingTask ? "PUT" : "POST";
    try {
      const res = await fetch("/api/tasks", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingTask ? { ...formData, id: editingTask.id } : formData),
      });
      if (res.ok) {
        setShowModal(false);
        fetchTasks();
      }
    } catch (error) {
      alert("保存失败");
    }
  };

  const handleRun = async (taskId: string) => {
    setRunningId(taskId);
    setLogs("");
    setShowLogs(true);
    try {
      const response = await fetch("/api/tasks/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      while (reader) {
        const { value, done } = await reader.read();
        if (done) break;
        setLogs((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (error) {
      setLogs((prev) => prev + "\n❌ 运行出错: " + error);
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="tasks-container fade-in">
      <div className="header-section">
        <div>
          <h1 className="page-title">脚本任务管理</h1>
          <p className="page-subtitle">配置并运行自动化部署脚本</p>
        </div>
        <button className="btn-add" onClick={handleOpenAdd}>
          <span>+</span> 新建任务
        </button>
      </div>

      <div className="task-grid">
        {loading ? (
          <div className="loading-state">加载中...</div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">暂无任务，点击右上方新建</div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="task-card glass-panel shimmer">
              <div className="task-card-header">
                <h3 className="task-name">{task.name}</h3>
                <div className="task-actions">
                  <button onClick={() => handleEdit(task)} title="编辑">✏️</button>
                  <button onClick={() => handleDelete(task.id)} title="删除">🗑️</button>
                </div>
              </div>
              <div className="task-info">
                <div className="info-item">
                  <span className="info-label">镜像:</span>
                  <span className="info-value">{task.imageName}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">K8s:</span>
                  <span className="info-value">{task.k8sDeployment} ({task.k8sNamespace})</span>
                </div>
              </div>
              <button 
                className="btn-run" 
                onClick={() => handleRun(task.id)}
                disabled={runningId !== null}
              >
                {runningId === task.id ? "发布中..." : "立即发布"}
              </button>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingTask ? "编辑任务" : "新建任务"}</h2>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="task-form">
              <div className="form-section">
                <h3>基本配置</h3>
                <div className="form-group">
                  <label>任务名称</label>
                  <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="例如: 前端生产环境部署" />
                </div>
                <div className="form-group">
                  <label>镜像名称 (IMAGE_NAME)</label>
                  <input required value={formData.imageName} onChange={e => setFormData({...formData, imageName: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>项目目录 (TARGET_DIR)</label>
                  <input required value={formData.targetDir} onChange={e => setFormData({...formData, targetDir: e.target.value})} />
                </div>
              </div>

              <div className="form-section">
                <h3>K8s 配置</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Master Host</label>
                    <input required value={formData.k8sHost} onChange={e => setFormData({...formData, k8sHost: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Master User</label>
                    <input required value={formData.k8sUser} onChange={e => setFormData({...formData, k8sUser: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Master Password</label>
                  <input type="password" required value={formData.k8sPassword} onChange={e => setFormData({...formData, k8sPassword: e.target.value})} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Namespace</label>
                    <input required value={formData.k8sNamespace} onChange={e => setFormData({...formData, k8sNamespace: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Deployment</label>
                    <input required value={formData.k8sDeployment} onChange={e => setFormData({...formData, k8sDeployment: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Container</label>
                  <input required value={formData.k8sContainer} onChange={e => setFormData({...formData, k8sContainer: e.target.value})} />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>取消</button>
                <button type="submit" className="btn-save">保存任务</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLogs && (
        <div className="modal-overlay" onClick={() => setShowLogs(false)}>
          <div className="modal-content glass-panel log-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>任务执行日志</h2>
              <button onClick={() => setShowLogs(false)}>✕</button>
            </div>
            <pre ref={logEndRef} className="log-viewer">
              {logs || "等待输出..."}
            </pre>
          </div>
        </div>
      )}

      <style jsx>{`
        .tasks-container {
          padding: 20px 0;
        }
        .header-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 40px;
        }
        .page-title {
          font-size: 2.5rem;
          font-weight: 900;
          background: linear-gradient(to bottom, #fff, #94a3b8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0;
        }
        .page-subtitle {
          color: var(--text-dim);
          margin: 5px 0 0;
        }
        .btn-add {
          background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
          border: none;
          color: white;
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
        }
        .btn-add:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4);
        }
        .task-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 25px;
        }
        .task-card {
          padding: 25px;
          display: flex;
          flex-direction: column;
          gap: 15px;
          transition: all 0.3s;
        }
        .task-card:hover {
          transform: translateY(-5px);
          border-color: rgba(59, 130, 246, 0.3);
        }
        .task-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .task-name {
          margin: 0;
          font-size: 1.25rem;
          color: #fff;
        }
        .task-actions {
          display: flex;
          gap: 10px;
        }
        .task-actions button {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          opacity: 0.6;
          transition: opacity 0.2s;
        }
        .task-actions button:hover {
          opacity: 1;
        }
        .task-info {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .info-item {
          display: flex;
          gap: 10px;
          font-size: 13px;
        }
        .info-label {
          color: var(--text-dim);
          min-width: 60px;
        }
        .info-value {
          color: #fff;
          word-break: break-all;
        }
        .btn-run {
          margin-top: 10px;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.2);
          color: var(--accent-blue);
          padding: 12px;
          border-radius: 10px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-run:hover:not(:disabled) {
          background: var(--accent-blue);
          color: #fff;
        }
        .btn-run:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
        .modal-content {
          width: 100%;
          max-width: 650px;
          max-height: 90vh;
          overflow-y: auto;
          background: #1a1a1a;
          border: 1px solid rgba(255,255,255,0.1);
          padding: 0;
        }
        .modal-header {
          padding: 20px 25px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .modal-header h2 { margin: 0; font-size: 1.5rem; }
        .modal-header button { background: none; border: none; color: #fff; font-size: 20px; cursor: pointer; }

        .task-form {
          padding: 25px;
          display: flex;
          flex-direction: column;
          gap: 25px;
        }
        .form-section h3 {
          margin: 0 0 15px;
          font-size: 1rem;
          color: var(--accent-blue);
          border-bottom: 1px solid rgba(59, 130, 246, 0.2);
          padding-bottom: 5px;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 15px;
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        label { font-size: 13px; color: var(--text-dim); }
        input {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 10px 12px;
          color: #fff;
          outline: none;
          transition: all 0.2s;
        }
        input:focus {
          border-color: var(--accent-blue);
          background: rgba(255,255,255,0.1);
        }
        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 15px;
          margin-top: 10px;
        }
        .btn-cancel {
          background: none;
          border: 1px solid rgba(255,255,255,0.1);
          color: #fff;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
        }
        .btn-save {
          background: var(--accent-blue);
          border: none;
          color: #fff;
          padding: 10px 25px;
          border-radius: 8px;
          font-weight: 700;
          cursor: pointer;
        }

        .log-modal {
          max-width: 900px;
          height: 80vh;
          display: flex;
          flex-direction: column;
        }
        .log-viewer {
          flex: 1;
          margin: 0;
          padding: 20px;
          background: #000;
          color: #10b981;
          font-family: 'Fira Code', monospace;
          font-size: 13px;
          overflow-y: auto;
          white-space: pre-wrap;
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
}
