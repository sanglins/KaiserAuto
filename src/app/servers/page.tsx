"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";

type SyncNode = {
  host: string;
  port: number | string;
  user: string;
  pass: string;
};

type LinuxConfig = {
  sourceDir?: string;
  targetDir?: string;
  backupDir?: string;
  syncNodes?: SyncNode[];
  syncEnabled?: boolean;
};

type K8sDeployment = {
  name: string;
  namespace: string;
  container: string;
};

type K8sConfig = {
  workDir?: string;
  masterHost?: string;
  masterPassword?: string;
  deployments?: K8sDeployment[];
  deployment?: string;
  namespace?: string;
  container?: string;
  pushRegistry?: boolean;
};

type ServerConfig = {
  mode?: "linux" | "k8s";
  linuxConfig?: LinuxConfig;
  k8s?: K8sConfig;
  imageName?: string;
};

type ServerAsset = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  path: string;
  project?: string;
  config?: ServerConfig;
};

type ProjectRenameState = {
  oldName: string;
  newName: string;
};

const initialForm = {
  id: "",
  name: "",
  host: "",
  port: 22,
  username: "root",
  password: "",
  path: "/root/cicd-workspace",
  project: "默认项目",
};

function getRoleFromCookie() {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split("; ");
  const roleCookie = cookies.find((row) => row.startsWith("user_role="));
  return roleCookie ? roleCookie.split("=")[1] : null;
}

export default function ServersPage() {
  const [servers, setServers] = useState<ServerAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(initialForm);
  const [editingConfig, setEditingConfig] = useState<ServerAsset | null>(null);
  const [editingProject, setEditingProject] = useState<ProjectRenameState | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [runningServerId, setRunningServerId] = useState<string | null>(null);
  const [logs, setLogs] = useState("");
  const [showLogs, setShowLogs] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const deferredSearchTerm = useDeferredValue(searchTerm);

  useEffect(() => {
    setIsAdmin(getRoleFromCookie() === "admin");
  }, []);

  const refreshServers = async (preferredProject?: string | null) => {
    try {
      const res = await fetch("/api/servers");
      const data: ServerAsset[] = await res.json();
      setServers(data);

      const projects = Array.from(new Set(data.map((item) => item.project || "默认项目")));
      const nextProject = preferredProject ?? activeProject;

      if (!projects.length) {
        setActiveProject(null);
      } else if (nextProject && projects.includes(nextProject)) {
        setActiveProject(nextProject);
      } else {
        setActiveProject(projects[0]);
      }
    } catch (error) {
      console.error("Failed to fetch servers:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    const loadInitialServers = async () => {
      try {
        const res = await fetch("/api/servers");
        const data: ServerAsset[] = await res.json();
        if (!active) return;

        setServers(data);
        const projects = Array.from(new Set(data.map((item) => item.project || "默认项目")));
        setActiveProject(projects[0] || null);
      } catch (error) {
        console.error("Failed to fetch servers:", error);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadInitialServers();

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        await refreshServers(formData.project);
        setShowModal(false);
        setFormData(initialForm);
      }
    } catch {}
  };

  const handleUpdateConfig = async () => {
    if (!editingConfig) return;
    try {
      const res = await fetch("/api/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingConfig),
      });

      if (res.ok) {
        await refreshServers(editingConfig.project || activeProject);
        setEditingConfig(null);
      }
    } catch {}
  };

  const handleRenameProject = async () => {
    if (!editingProject || !editingProject.newName.trim()) return;
    const targetName = editingProject.newName.trim();
    const affectedServers = servers.filter(
      (server) => (server.project || "默认项目") === editingProject.oldName,
    );

    try {
      for (const server of affectedServers) {
        await fetch("/api/servers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...server, project: targetName }),
        });
      }

      await refreshServers(targetName);
      setEditingProject(null);
    } catch (error) {
      console.error("Failed to rename project:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定移除该服务器资产吗？")) return;
    await fetch(`/api/servers?id=${id}`, { method: "DELETE" });
    await refreshServers(activeProject);
  };

  const handleEditAsset = (server: ServerAsset) => {
    setFormData({
      id: server.id,
      name: server.name,
      host: server.host,
      port: server.port,
      username: server.username,
      password: server.password,
      path: server.path,
      project: server.project || "默认项目",
    });
    setShowModal(true);
  };

  const openAddInProject = (projectName: string) => {
    setFormData({ ...initialForm, project: projectName });
    setShowModal(true);
  };

  const addK8sDeployment = () => {
    if (!editingConfig) return;
    const config = editingConfig.config || {};
    const k8s = config.k8s || {};
    const deployments = k8s.deployments || [];

    setEditingConfig({
      ...editingConfig,
      config: {
        ...config,
        k8s: {
          ...k8s,
          deployments: [...deployments, { name: "", namespace: "default", container: "" }],
        },
      },
    });
  };

  const removeK8sDeployment = (index: number) => {
    if (!editingConfig?.config?.k8s?.deployments) return;
    const deployments = [...editingConfig.config.k8s.deployments];
    deployments.splice(index, 1);

    setEditingConfig({
      ...editingConfig,
      config: {
        ...editingConfig.config,
        k8s: {
          ...editingConfig.config.k8s,
          deployments,
        },
      },
    });
  };

  const updateK8sDeployment = (index: number, field: keyof K8sDeployment, value: string) => {
    if (!editingConfig?.config?.k8s?.deployments) return;
    const deployments = [...editingConfig.config.k8s.deployments];
    deployments[index] = { ...deployments[index], [field]: value };

    setEditingConfig({
      ...editingConfig,
      config: {
        ...editingConfig.config,
        k8s: {
          ...editingConfig.config.k8s,
          deployments,
        },
      },
    });
  };

  const handleQuickDeploy = async (serverId: string) => {
    setRunningServerId(serverId);
    setLogs(`>>> [指令] 启动快速发布流程: ${serverId}\n`);
    setShowLogs(true);
    try {
      const response = await fetch(`/api/servers/deploy?serverId=${serverId}`);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      while (reader) {
        const { value, done } = await reader.read();
        if (done) break;
        setLogs((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (error: any) {
      setLogs((prev) => prev + `\n❌ 发布异常: ${error.message}`);
    } finally {
      setRunningServerId(null);
    }
  };

  const addSyncNode = () => {
    if (!editingConfig) return;
    const config = editingConfig.config || {};
    const linuxConfig = config.linuxConfig || {};
    const syncNodes = linuxConfig.syncNodes || [];

    setEditingConfig({
      ...editingConfig,
      config: {
        ...config,
        linuxConfig: {
          ...linuxConfig,
          syncNodes: [...syncNodes, { host: "", port: 22, user: "root", pass: "" }],
        },
      },
    });
  };

  const removeSyncNode = (index: number) => {
    if (!editingConfig?.config?.linuxConfig?.syncNodes) return;
    const syncNodes = [...editingConfig.config.linuxConfig.syncNodes];
    syncNodes.splice(index, 1);

    setEditingConfig({
      ...editingConfig,
      config: {
        ...editingConfig.config,
        linuxConfig: {
          ...editingConfig.config.linuxConfig,
          syncNodes,
        },
      },
    });
  };

  const updateSyncNode = (index: number, field: keyof SyncNode, value: SyncNode[keyof SyncNode]) => {
    if (!editingConfig?.config?.linuxConfig?.syncNodes) return;
    const syncNodes = [...editingConfig.config.linuxConfig.syncNodes];
    syncNodes[index] = { ...syncNodes[index], [field]: value };

    setEditingConfig({
      ...editingConfig,
      config: {
        ...editingConfig.config,
        linuxConfig: {
          ...editingConfig.config.linuxConfig,
          syncNodes,
        },
      },
    });
  };

  const projects = Array.from(new Set(servers.map((server) => server.project || "默认项目")));
  const currentProject = activeProject || projects[0] || null;
  const currentServers = servers.filter(
    (server) => (server.project || "默认项目") === currentProject,
  );
  const visibleServers = currentServers.filter((server) => {
    const keyword = deferredSearchTerm.toLowerCase();
    return (
      server.name.toLowerCase().includes(keyword) ||
      server.host.toLowerCase().includes(keyword) ||
      server.username.toLowerCase().includes(keyword)
    );
  });

  return (
    <div className="fade-in page-shell servers-page">
      <div className="page-hero">
        <div>
          <span className="page-kicker">Server Workspace</span>
          <h1 className="page-title">自动化发布</h1>
          <p className="page-copy">
            自动化发布入口与部署配置。
          </p>
        </div>

        <div className="hero-actions">
          <div className="search-shell search-wrapper">
            <span className="search-icon">⌕</span>
            <input
              type="text"
              className="search-field"
              placeholder="搜索节点名称、IP 或账号"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {isAdmin && (
            <button
              className="btn btn-primary create-btn"
              onClick={() => {
                setFormData(initialForm);
                setShowModal(true);
              }}
            >
              新增节点
            </button>
          )}
        </div>
      </div>

      {servers.length === 0 && !loading ? (
        <div className="glass-panel empty-state">
          <div className="empty-orb">SRV</div>
          <h3>尚未托管任何服务器节点</h3>
          <p>先创建一个节点或项目分组，后续就可以在这里统一完成配置和发布。</p>
        </div>
      ) : (
        <div className="workspace-grid">
          <div className="project-strip glass-panel">
            <div className="project-strip-head">
              <strong>项目分组</strong>
              {isAdmin && (
                <button
                  className="btn btn-secondary strip-btn"
                  onClick={() => {
                    setFormData({ ...initialForm, project: "新项目组" });
                    setShowModal(true);
                  }}
                >
                  新增项目
                </button>
              )}
            </div>

            <div className="project-tabs">
              {projects.map((project) => (
                <button
                  key={project}
                  className={`project-tab ${currentProject === project ? "active" : ""}`}
                  onClick={() => setActiveProject(project)}
                >
                  <span className="tab-name">{project}</span>
                  <span className="tab-count">
                    {servers.filter((server) => (server.project || "默认项目") === project).length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="cluster-card glass-panel">
            <div className="cluster-head">
              <div>
                <h2>{currentProject || "自动化发布"}</h2>
                <p>{visibleServers.length} 个节点</p>
              </div>

              {isAdmin && currentProject && (
                <div className="cluster-actions">
                  <button
                    className="icon-btn"
                    onClick={() => setEditingProject({ oldName: currentProject, newName: currentProject })}
                    title="重命名项目"
                  >
                    ✎
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => openAddInProject(currentProject)}
                    title="新增节点"
                  >
                    +
                  </button>
                </div>
              )}
            </div>

            <div className="table-shell">
              <div className="table-scroll">
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th>服务器名称</th>
                      <th>地址信息</th>
                      <th>模式</th>
                      <th>状态</th>
                      <th className="align-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleServers.map((server) => (
                      <tr key={server.id} className="premium-row">
                        <td>
                          <div className="node-info">
                            <span className="online-status"></span>
                            <div>
                              <div className="main-name">{server.name}</div>
                              <div className="sub-detail">{server.id.slice(0, 8)}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="mono-ip">{server.host}:{server.port}</div>
                          <div className="sub-detail">{server.username}</div>
                        </td>
                        <td>
                          <span className={`mode-badge ${server.config?.mode || "linux"}`}>
                            {server.config?.mode === "k8s" ? "K8s Cluster" : "SSH Node"}
                          </span>
                        </td>
                        <td>
                          <span className={`conf-status ${server.config ? "done" : "wait"}`}>
                            {server.config ? "已就绪" : "待配置"}
                          </span>
                        </td>
                        <td className="align-right">
                          <div className="btn-flex-group">
                            <button 
                              onClick={() => handleQuickDeploy(server.id)} 
                              className="deploy-btn-mini"
                              disabled={runningServerId !== null}
                            >
                              {runningServerId === server.id ? "部署中..." : "立即发布"}
                            </button>
                            <Link href={`/build?serverId=${server.id}`} className="build-link-icon" title="上传产物/回滚">
                              ⚙️
                            </Link>
                            {isAdmin && (
                              <div className="admin-action-block">
                                <button onClick={() => setEditingConfig(JSON.parse(JSON.stringify(server)))} title="配置">
                                  配
                                </button>
                                <button onClick={() => handleEditAsset(server)} title="编辑">
                                  改
                                </button>
                                <button onClick={() => handleDelete(server.id)} title="删除">
                                  删
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!visibleServers.length && (
                      <tr>
                        <td colSpan={5} className="table-empty">
                          {loading ? "正在加载节点..." : "当前项目下暂无匹配节点"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingProject && (
        <div className="modal-overlay" onClick={() => setEditingProject(null)}>
          <div className="glass-panel premium-modal mini" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>重命名项目</h3>
            </div>
            <div className="modal-body">
              <div className="field-group">
                <label>新的项目名称</label>
                <input
                  value={editingProject.newName}
                  onChange={(e) =>
                    setEditingProject({ ...editingProject, newName: e.target.value })
                  }
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-secondary" onClick={() => setEditingProject(null)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleRenameProject}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {editingConfig && (
        <div className="modal-overlay" onClick={() => setEditingConfig(null)}>
          <div className="glass-panel premium-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head modal-head-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="modal-kicker">Pipeline Config</span>
                <h3 style={{ 
                  whiteSpace: 'nowrap', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis',
                  margin: 0
                }}>
                  流水线配置 · {editingConfig.name}
                </h3>
              </div>
              <div className="mode-switcher" style={{ flexShrink: 0, zIndex: 10 }}>
                <button
                  className={editingConfig.config?.mode === "k8s" ? "active" : ""}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingConfig({
                      ...editingConfig,
                      config: { ...(editingConfig.config || {}), mode: "k8s" },
                    });
                  }}
                >
                  K8s
                </button>
                <button
                  className={editingConfig.config?.mode !== "k8s" ? "active" : ""}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingConfig({
                      ...editingConfig,
                      config: { ...(editingConfig.config || {}), mode: "linux" },
                    });
                  }}
                >
                  Linux
                </button>
              </div>
            </div>

            <div className="modal-body scrollable">
              <div className="field-group full">
                <label>所属项目组</label>
                <input
                  value={editingConfig.project || "默认项目"}
                  onChange={(e) => setEditingConfig({ ...editingConfig, project: e.target.value })}
                />
              </div>

              {editingConfig.config?.mode === "linux" ? (
                <div className="form-sections">
                  <div className="sec-title">Linux 部署配置</div>
                  <div className="form-grid">
                    <div className="field-group">
                      <label>源目录</label>
                      <input
                        value={editingConfig.config?.linuxConfig?.sourceDir || ""}
                        onChange={(e) =>
                          setEditingConfig({
                            ...editingConfig,
                            config: {
                              ...(editingConfig.config || {}),
                              linuxConfig: {
                                ...(editingConfig.config?.linuxConfig || {}),
                                sourceDir: e.target.value,
                              },
                            },
                          })
                        }
                      />
                    </div>
                    <div className="field-group">
                      <label>目标目录</label>
                      <input
                        value={editingConfig.config?.linuxConfig?.targetDir || ""}
                        onChange={(e) =>
                          setEditingConfig({
                            ...editingConfig,
                            config: {
                              ...(editingConfig.config || {}),
                              linuxConfig: {
                                ...(editingConfig.config?.linuxConfig || {}),
                                targetDir: e.target.value,
                              },
                            },
                          })
                        }
                      />
                    </div>
                    <div className="field-group">
                      <label>备份目录</label>
                      <input
                        value={editingConfig.config?.linuxConfig?.backupDir || ""}
                        onChange={(e) =>
                          setEditingConfig({
                            ...editingConfig,
                            config: {
                              ...(editingConfig.config || {}),
                              linuxConfig: {
                                ...(editingConfig.config?.linuxConfig || {}),
                                backupDir: e.target.value,
                              },
                            },
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="sec-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span>集群分发节点</span>
                      <label className="premium-checkbox" style={{ fontSize: '0.8rem', marginTop: '2px' }}>
                        <input
                          type="checkbox"
                          checked={editingConfig.config?.linuxConfig?.syncEnabled || false}
                          onChange={(e) =>
                            setEditingConfig({
                              ...editingConfig,
                              config: {
                                ...(editingConfig.config || {}),
                                linuxConfig: {
                                  ...(editingConfig.config?.linuxConfig || {}),
                                  syncEnabled: e.target.checked,
                                },
                              },
                            })
                          }
                        />
                        <span className="checkmark"></span>
                        <span>开启自动同步</span>
                      </label>
                    </div>
                    <button className="add-node-btn" onClick={addSyncNode}>
                      添加节点
                    </button>
                  </div>

                  <div className="sync-node-list">
                    {(editingConfig.config?.linuxConfig?.syncNodes || []).map((node, idx) => (
                      <div key={idx} className="sync-node-card">
                        <div className="sync-grid-mini">
                          <input
                            placeholder="Host"
                            value={node.host}
                            onChange={(e) => updateSyncNode(idx, "host", e.target.value)}
                          />
                          <input
                            placeholder="Port"
                            value={node.port}
                            onChange={(e) => updateSyncNode(idx, "port", e.target.value)}
                          />
                          <input
                            placeholder="User"
                            value={node.user}
                            onChange={(e) => updateSyncNode(idx, "user", e.target.value)}
                          />
                          <input
                            type="password"
                            placeholder="Password"
                            value={node.pass}
                            onChange={(e) => updateSyncNode(idx, "pass", e.target.value)}
                          />
                          <button className="remove-row" onClick={() => removeSyncNode(idx)}>
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="form-sections">
                  <div className="sec-title">K8s 部署配置</div>
                  <div className="form-grid">
                    <div className="field-group full">
                      <label>镜像完整名称</label>
                      <input
                        value={editingConfig.config?.imageName || ""}
                        onChange={(e) =>
                          setEditingConfig({
                            ...editingConfig,
                            config: { ...(editingConfig.config || {}), imageName: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="field-group">
                      <label>构建工作空间</label>
                      <input
                        value={editingConfig.config?.k8s?.workDir || ""}
                        onChange={(e) =>
                          setEditingConfig({
                            ...editingConfig,
                            config: {
                              ...(editingConfig.config || {}),
                              k8s: { ...(editingConfig.config?.k8s || {}), workDir: e.target.value },
                            },
                          })
                        }
                      />
                    </div>
                    <div className="field-group">
                      <label>K8s Master IP</label>
                      <input
                        value={editingConfig.config?.k8s?.masterHost || ""}
                        onChange={(e) =>
                          setEditingConfig({
                            ...editingConfig,
                            config: {
                              ...(editingConfig.config || {}),
                              k8s: { ...(editingConfig.config?.k8s || {}), masterHost: e.target.value },
                            },
                          })
                        }
                      />
                    </div>
                    <div className="field-group">
                      <label>Master 密码</label>
                      <input
                        type="password"
                        value={editingConfig.config?.k8s?.masterPassword || ""}
                        onChange={(e) =>
                          setEditingConfig({
                            ...editingConfig,
                            config: {
                              ...(editingConfig.config || {}),
                              k8s: {
                                ...(editingConfig.config?.k8s || {}),
                                masterPassword: e.target.value,
                              },
                            },
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="sec-header">
                    <span>目标部署 (Deployments)</span>
                    <button className="add-node-btn" onClick={addK8sDeployment}>
                      添加 Deployment
                    </button>
                  </div>

                  <div className="sync-node-list">
                    {(!editingConfig.config?.k8s?.deployments || editingConfig.config?.k8s?.deployments.length === 0) && (
                      <div className="sync-node-card">
                        <div className="sync-grid-mini" style={{ gridTemplateColumns: '1fr 1fr 1fr 40px' }}>
                          <input
                            placeholder="Deployment Name"
                            value={editingConfig.config?.k8s?.deployment || ""}
                            onChange={(e) => setEditingConfig({
                              ...editingConfig,
                              config: {
                                ...editingConfig.config,
                                k8s: { ...editingConfig.config?.k8s, deployment: e.target.value }
                              }
                            })}
                          />
                          <input
                            placeholder="Namespace"
                            value={editingConfig.config?.k8s?.namespace || ""}
                            onChange={(e) => setEditingConfig({
                              ...editingConfig,
                              config: {
                                ...editingConfig.config,
                                k8s: { ...editingConfig.config?.k8s, namespace: e.target.value }
                              }
                            })}
                          />
                          <input
                            placeholder="Container"
                            value={editingConfig.config?.k8s?.container || ""}
                            onChange={(e) => setEditingConfig({
                              ...editingConfig,
                              config: {
                                ...editingConfig.config,
                                k8s: { ...editingConfig.config?.k8s, container: e.target.value }
                              }
                            })}
                          />
                          <button className="remove-row" disabled>×</button>
                        </div>
                      </div>
                    )}
                    {(editingConfig.config?.k8s?.deployments || []).map((dep, idx) => (
                      <div key={idx} className="sync-node-card">
                        <div className="sync-grid-mini" style={{ gridTemplateColumns: '1fr 1fr 1fr 40px' }}>
                          <input
                            placeholder="Deployment Name"
                            value={dep.name}
                            onChange={(e) => updateK8sDeployment(idx, "name", e.target.value)}
                          />
                          <input
                            placeholder="Namespace"
                            value={dep.namespace}
                            onChange={(e) => updateK8sDeployment(idx, "namespace", e.target.value)}
                          />
                          <input
                            placeholder="Container"
                            value={dep.container}
                            onChange={(e) => updateK8sDeployment(idx, "container", e.target.value)}
                          />
                          <button className="remove-row" onClick={() => removeK8sDeployment(idx)}>
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="check-row-premium">
                    <label className="premium-checkbox">
                      <input
                        type="checkbox"
                        checked={editingConfig.config?.k8s?.pushRegistry || false}
                        onChange={(e) =>
                          setEditingConfig({
                            ...editingConfig,
                            config: {
                              ...(editingConfig.config || {}),
                              k8s: {
                                ...(editingConfig.config?.k8s || {}),
                                pushRegistry: e.target.checked,
                              },
                            },
                          })
                        }
                      />
                      <span className="checkmark"></span>
                      <span>推送到远程镜像仓</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-foot">
              <button className="btn btn-secondary" onClick={() => setEditingConfig(null)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleUpdateConfig}>
                保存配置
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogs && (
        <div className="modal-overlay" onClick={() => setShowLogs(false)}>
          <div className="glass-panel premium-modal log-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-kicker">Deployment Console</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>实时发布日志</h3>
                <button className="icon-btn" onClick={() => setShowLogs(false)}>✕</button>
              </div>
            </div>
            <div className="log-viewer-shell">
              <pre className="log-viewer-content">{logs || "正在初始化日志流..."}</pre>
            </div>
            <div className="modal-foot">
              <button className="btn btn-primary" onClick={() => setShowLogs(false)}>完成</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="glass-panel premium-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{formData.id ? "编辑资产节点" : "新增资产节点"}</h3>
            </div>

            <div className="modal-body">
              <div className="form-grid">
                <div className="field-group">
                  <label>所属项目分组</label>
                  <input
                    value={formData.project}
                    onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                  />
                </div>
                <div className="field-group">
                  <label>节点显示名称</label>
                  <input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="field-group">
                  <label>IP 地址</label>
                  <input
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  />
                </div>
                <div className="field-group">
                  <label>SSH 端口</label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) =>
                      setFormData({ ...formData, port: Number.parseInt(e.target.value || "22", 10) })
                    }
                  />
                </div>
                <div className="field-group">
                  <label>SSH 用户名</label>
                  <input
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>
                <div className="field-group">
                  <label>SSH 密码</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="modal-foot">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleSubmit}>
                确认保存
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .servers-page {
          padding: 24px 0 0;
        }

        .search-wrapper {
          min-width: 320px;
        }

        .create-btn {
          min-width: 112px;
        }

        .workspace-grid {
          display: grid;
          gap: 18px;
        }

        .project-strip {
          padding: 16px;
        }

        .project-strip-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }

        .project-strip-head strong {
          font-size: 0.92rem;
          font-weight: 700;
        }

        .strip-btn {
          min-height: 38px;
          padding: 0 14px;
        }

        .project-tabs {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding-bottom: 2px;
        }

        .project-tab {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-height: 42px;
          padding: 0 14px;
          border-radius: 14px;
          border: 1px solid rgba(15, 23, 42, 0.07);
          background: rgba(255, 255, 255, 0.86);
          color: var(--text-soft);
          font-weight: 600;
          box-shadow: var(--shadow-sm);
        }

        .project-tab.active {
          color: var(--brand);
          border-color: rgba(22, 119, 255, 0.14);
          background: rgba(22, 119, 255, 0.08);
          box-shadow: 0 10px 24px rgba(22, 119, 255, 0.1);
        }

        .tab-name {
          white-space: nowrap;
        }

        .tab-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 24px;
          height: 24px;
          padding: 0 7px;
          border-radius: 999px;
          background: rgba(100, 116, 139, 0.08);
          color: var(--text-faint);
          font-size: 0.72rem;
          font-weight: 700;
        }

        .project-tab.active .tab-count {
          background: var(--brand);
          color: #fff;
        }

        .cluster-card {
          padding: 18px;
        }

        .cluster-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
        }

        .cluster-head h2 {
          font-size: 1.45rem;
          font-weight: 700;
          letter-spacing: -0.04em;
        }

        .cluster-head p {
          margin-top: 6px;
          color: var(--text-soft);
          font-size: 0.92rem;
        }

        .cluster-actions {
          display: flex;
          gap: 8px;
        }

        .icon-btn {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.07);
          background: #fff;
          color: var(--text-faint);
          box-shadow: var(--shadow-sm);
        }

        .icon-btn:hover {
          color: var(--brand);
          border-color: rgba(22, 119, 255, 0.14);
          background: rgba(22, 119, 255, 0.05);
        }

        .table-shell {
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.84);
          border: 1px solid rgba(15, 23, 42, 0.06);
          overflow: hidden;
        }

        .table-scroll {
          overflow-x: auto;
        }

        .premium-table {
          width: 100%;
          min-width: 860px;
          border-collapse: collapse;
        }

        .premium-table th {
          padding: 15px 18px;
          text-align: left;
          color: var(--text-faint);
          font-size: 0.72rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          font-weight: 700;
          background: rgba(246, 248, 251, 0.96);
        }

        .premium-row td {
          padding: 16px 18px;
          border-top: 1px solid rgba(15, 23, 42, 0.06);
          background: rgba(255, 255, 255, 0.78);
        }

        .premium-row:hover td {
          background: rgba(247, 250, 254, 0.98);
        }

        .node-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .online-status {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: var(--success);
          position: relative;
        }

        .online-status::after {
          content: "";
          position: absolute;
          inset: -4px;
          border-radius: 999px;
          border: 1px solid rgba(18, 185, 129, 0.26);
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 0.45;
          }
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }

        .main-name {
          font-size: 0.96rem;
          font-weight: 600;
        }

        .sub-detail {
          margin-top: 4px;
          color: var(--text-faint);
          font-size: 0.74rem;
          font-family: "JetBrains Mono", monospace;
        }

        .mono-ip {
          color: var(--text-soft);
          font-family: "JetBrains Mono", monospace;
          font-size: 0.86rem;
        }

        .mode-badge,
        .conf-status {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 0 11px;
          border-radius: 999px;
          font-size: 0.74rem;
          font-weight: 600;
        }

        .mode-badge.linux {
          background: rgba(22, 119, 255, 0.08);
          color: var(--brand);
        }

        .mode-badge.k8s {
          background: rgba(18, 185, 129, 0.1);
          color: #0f8f66;
        }

        .conf-status.done {
          background: rgba(18, 185, 129, 0.1);
          color: #0f8f66;
        }

        .conf-status.wait {
          background: rgba(100, 116, 139, 0.08);
          color: var(--text-soft);
        }

        .align-right {
          text-align: right;
        }

        .btn-flex-group {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 10px;
        }

        .deploy-btn-mini {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 36px;
          padding: 0 15px;
          border-radius: 12px;
          background: linear-gradient(135deg, #2563eb, #7c3aed);
          color: #fff;
          font-size: 0.78rem;
          font-weight: 700;
          box-shadow: 0 10px 20px rgba(37, 99, 235, 0.2);
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .deploy-btn-mini:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 24px rgba(37, 99, 235, 0.3);
        }

        .deploy-btn-mini:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          background: #64748b;
        }

        .build-link-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: rgba(15, 23, 42, 0.04);
          text-decoration: none;
          font-size: 14px;
          transition: all 0.2s;
        }

        .build-link-icon:hover {
          background: rgba(15, 23, 42, 0.08);
          transform: scale(1.05);
        }

        .log-modal {
          max-width: 950px;
          display: flex;
          flex-direction: column;
        }

        .log-viewer-shell {
          flex: 1;
          background: #0f172a;
          border-radius: 16px;
          padding: 20px;
          overflow: hidden;
          margin-top: 10px;
        }

        .log-viewer-content {
          height: 50vh;
          overflow-y: auto;
          color: #38bdf8;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 13px;
          line-height: 1.6;
          margin: 0;
          white-space: pre-wrap;
        }

        .admin-action-block {
          display: flex;
          gap: 6px;
        }

        .admin-action-block button {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          border: 1px solid rgba(15, 23, 42, 0.07);
          background: #fff;
          color: var(--text-faint);
          font-size: 0.76rem;
          font-weight: 600;
          box-shadow: var(--shadow-sm);
        }

        .admin-action-block button:hover {
          color: var(--brand);
          border-color: rgba(22, 119, 255, 0.14);
          background: rgba(22, 119, 255, 0.05);
        }

        .table-empty {
          padding: 42px 18px;
          text-align: center;
          color: var(--text-faint);
        }

        .premium-modal {
          width: min(100%, 720px);
          padding: 24px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.98);
          box-shadow: 0 20px 50px rgba(0,0,0,0.15);
        }

        :global(.modal-overlay) {
          align-items: flex-start !important;
          padding-top: 10vh !important;
        }

        .premium-modal.mini {
          width: min(100%, 420px);
        }

        .modal-head {
          margin-bottom: 22px;
        }

        .modal-head h3 {
          font-size: 1.2rem;
          font-weight: 700;
          letter-spacing: -0.03em;
        }

        .modal-head-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .modal-kicker {
          display: inline-block;
          margin-bottom: 8px;
          color: var(--brand);
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .modal-body.scrollable {
          max-height: 60vh;
          overflow-y: auto;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }

        .field-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 14px;
        }

        .field-group.full {
          grid-column: span 2;
        }

        .field-group label {
          color: var(--text-faint);
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .field-group input {
          min-height: 48px;
          padding: 0 14px;
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: #fbfcfe;
          color: var(--text-main);
          outline: none;
        }

        .field-group input:focus {
          border-color: rgba(22, 119, 255, 0.18);
          box-shadow: 0 0 0 4px rgba(22, 119, 255, 0.08);
        }

        .modal-foot {
          display: flex;
          gap: 12px;
          margin-top: 28px;
        }

        .modal-foot :global(.btn) {
          flex: 1;
        }

        .mode-switcher {
          display: flex;
          gap: 4px;
          padding: 4px;
          border-radius: 12px;
          background: var(--bg-soft);
        }

        .mode-switcher button {
          min-height: 36px;
          padding: 0 15px;
          border: none;
          border-radius: 10px;
          background: transparent;
          color: var(--text-faint);
          font-weight: 600;
        }

        .mode-switcher button.active {
          background: #fff;
          color: var(--brand);
          box-shadow: var(--shadow-sm);
        }

        .sec-title {
          color: var(--text-main);
          font-size: 0.92rem;
          font-weight: 700;
          margin-bottom: 12px;
        }

        .sec-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin: 22px 0 12px;
        }

        .sec-header span {
          color: var(--text-soft);
          font-size: 0.88rem;
        }

        .add-node-btn {
          min-height: 36px;
          padding: 0 12px;
          border-radius: 10px;
          border: 1px solid rgba(22, 119, 255, 0.12);
          background: rgba(22, 119, 255, 0.08);
          color: var(--brand);
          font-weight: 600;
        }

        .sync-node-list {
          display: grid;
          gap: 10px;
        }

        .sync-node-card {
          padding: 12px;
          border-radius: 14px;
          background: var(--bg-soft);
          border: 1px solid rgba(15, 23, 42, 0.06);
        }

        .sync-grid-mini {
          display: grid;
          grid-template-columns: 1.5fr 0.7fr 1fr 1fr 40px;
          gap: 10px;
        }

        .sync-grid-mini input {
          min-height: 38px;
          padding: 0 10px;
          border-radius: 10px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: #fff;
          color: var(--text-main);
        }

        .remove-row {
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 10px;
          background: #fff;
          color: var(--text-faint);
        }

        .check-row-premium {
          margin-top: 12px;
        }

        .premium-checkbox {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--text-soft);
        }

        .premium-checkbox input {
          display: none;
        }

        .checkmark {
          width: 18px;
          height: 18px;
          border-radius: 6px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: #fff;
          position: relative;
        }

        .premium-checkbox input:checked + .checkmark {
          background: var(--brand);
          border-color: var(--brand);
        }

        .premium-checkbox input:checked + .checkmark::after {
          content: "✓";
          position: absolute;
          left: 4px;
          top: -1px;
          color: #fff;
          font-size: 12px;
        }

        @media (max-width: 1024px) {
          .search-wrapper {
            min-width: 260px;
          }

          .sync-grid-mini {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 720px) {
          .servers-page {
            padding-top: 18px;
          }

          .search-wrapper {
            min-width: 0;
            width: 100%;
          }

          .cluster-head,
          .modal-head-row,
          .sec-header,
          .modal-foot {
            flex-direction: column;
            align-items: flex-start;
          }

          .cluster-actions,
          .modal-foot {
            width: 100%;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .field-group.full {
            grid-column: auto;
          }
        }
      `}</style>
    </div>
  );
}
