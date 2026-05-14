import { NextRequest, NextResponse } from "next/server";
import { SSHClient } from "@/lib/ssh-client";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  const { serverId, backupFile } = await req.json();

  if (!serverId || !backupFile) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  const dataPath = path.join(process.cwd(), "data", "servers.json");
  const servers = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const server = servers.find((s: any) => s.id === serverId);

  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  let rollbackScript = "";
  let targetHost = server.host;
  let targetPort = server.port || 22;
  let targetUser = server.username || "root";
  let targetPass = server.password;

  if (server.config?.mode === 'linux') {
    const { targetDir, backupDir, syncNodes } = server.config.linuxConfig;
    const nodes = syncNodes || [];

    rollbackScript = `#!/bin/bash
set -e
echo ">>> [Linux 回滚] 启动版本回溯..."
echo ">>> 正在从备份包还原: ${backupFile}"

mkdir -p ${targetDir}
rm -rf ${targetDir}/*
tar -xzf ${backupDir}/${backupFile} -C ${targetDir}
echo ">>> ✅ 源节点还原完成"
`;
    nodes.forEach((node: any, idx: number) => {
      const port = node.port || 22;
      rollbackScript += `
echo ">>> 同步回滚至集群节点 #${idx + 1} (${node.host}:${port})..."
sshpass -p "${node.pass}" ssh -p ${port} -o StrictHostKeyChecking=no ${node.user}@${node.host} "rm -rf ${targetDir}/* && mkdir -p ${targetDir}"
sshpass -p "${node.pass}" scp -P ${port} -r "${targetDir}"/. ${node.user}@${node.host}:${targetDir}/
`;
    });
    rollbackScript += `\necho ">>> 🎊 Linux 集群回滚全部完成！"\n`;

  } else if (server.config?.mode === 'k8s') {
    const { masterHost, masterPassword, namespace, deployment, container } = server.config.k8s || {};
    targetHost = masterHost;
    targetPass = masterPassword;
    
    // K8s 回滚指令：直接更新镜像
    rollbackScript = `#!/bin/bash
set -e
echo ">>> [K8s 回滚] 启动容器版本切换..."
echo ">>> 目标镜像: ${backupFile}"

if ! command -v kubectl >/dev/null 2>&1; then
    echo "❌ 错误: Master 节点未找到 kubectl 命令"
    exit 1
fi

echo ">>> 执行镜像更新指令..."
kubectl set image deployment/${deployment} ${container}="${backupFile}" -n ${namespace}

echo ">>> 正在等待滚动更新完成..."
kubectl rollout status deployment/${deployment} -n ${namespace}

echo ">>> 🎊 K8s 镜像版本回滚成功！"
`;
  }

  // 使用 SSE 返回实时日志
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  const runRollback = async () => {
    const ssh = new SSHClient(targetHost, targetPort, targetUser, targetPass);
    try {
      await ssh.execStream(rollbackScript, (data) => {
        writer.write(encoder.encode(data));
      });
    } catch (err: any) {
      writer.write(encoder.encode(`\n❌ 回滚流程中断: ${err.message}`));
    } finally {
      writer.close();
    }
  };

  runRollback();

  return new Response(responseStream.readable, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}
