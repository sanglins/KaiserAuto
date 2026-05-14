import { NextRequest, NextResponse } from "next/server";
import { SSHClient } from "@/lib/ssh-client";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const serverId = searchParams.get("serverId");

  if (!serverId) return NextResponse.json({ error: "Missing serverId" }, { status: 400 });

  try {
    const dataPath = path.join(process.cwd(), "data", "servers.json");
    if (!fs.existsSync(dataPath)) return NextResponse.json({ backups: [] });
    
    const servers = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    const server = servers.find((s: any) => s.id === serverId);

    if (!server) return NextResponse.json({ backups: [], error: "服务器不存在" });

    // --- Linux 模式逻辑 ---
    if (server.config?.mode === 'linux') {
      const { backupDir } = server.config.linuxConfig || {};
      if (!backupDir) return NextResponse.json({ backups: [] });

      const ssh = new SSHClient(server);
      await ssh.exec(`mkdir -p ${backupDir}`);

      const cmd = `find ${backupDir} -maxdepth 1 -name "*.tar.gz" -printf "%T@ %p\\n" 2>/dev/null | sort -rn | cut -d' ' -f2-`;
      const fallbackCmd = `ls -1t ${backupDir}/*.tar.gz 2>/dev/null || true`;
      
      let result = await ssh.exec(cmd);
      let output = result.stdout;
      if (!output.trim()) {
        result = await ssh.exec(fallbackCmd);
        output = result.stdout;
      }

      const files = output.split("\n")
        .filter(line => line.trim() !== "" && line.includes('.tar.gz'))
        .map(fullPath => {
          const name = fullPath.split("/").pop() || "";
          const match = name.match(/backup_(\d{8})_(\d{6})/);
          let label = name;
          if (match) {
            const [_, date, time] = match;
            label = `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)} ${time.slice(0,2)}:${time.slice(2,4)}:${time.slice(4,6)}`;
          }
          return { name, label };
        });

      return NextResponse.json({ backups: files });
    } 

    // --- K8s 模式逻辑 ---
    if (server.config?.mode === 'k8s') {
      const { masterHost, masterPassword, namespace, deployment } = server.config.k8s || {};
      if (!masterHost || !deployment) return NextResponse.json({ backups: [] });

      const ssh = new SSHClient(masterHost, 22, "root", masterPassword);
      
      // 使用 kubectl get rs 命令获取所有关联的 ReplicaSets 及其镜像和创建时间
      // 这里的逻辑是查找所有包含该 deployment 名称的 rs
      const cmd = `kubectl get rs -n ${namespace} -o jsonpath='{range .items[?(@.metadata.ownerReferences[0].name=="${deployment}")]}{.metadata.creationTimestamp}{" "}{.spec.template.spec.containers[0].image}{"\\n"}{end}' | sort -r`;
      
      const result = await ssh.exec(cmd);
      const lines = result.stdout.split("\n").filter(l => l.trim() !== "");
      
      const versions = lines.map(line => {
        const parts = line.trim().split(" ");
        if (parts.length < 2) return null;
        const [timeStr, image] = parts;
        const date = new Date(timeStr);
        const label = `🕒 ${date.toLocaleString("zh-CN")} ➔ ${image.split('/').pop()}`;
        return { name: image, label };
      }).filter((v): v is { name: string; label: string } => v !== null);

      // 按镜像名去重，保留最新的记录
      const uniqueVersions = Array.from(new Map(versions.map(v => [v.name, v])).values());

      return NextResponse.json({ backups: uniqueVersions });
    }

    return NextResponse.json({ backups: [] });
  } catch (error: any) {
    console.error("Fetch Backups API Error:", error);
    return NextResponse.json({ backups: [], error: error.message });
  }
}
