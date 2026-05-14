import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const serverId = searchParams.get("serverId");

  if (!serverId) return NextResponse.json({ error: "Missing serverId" }, { status: 400 });

  try {
    const dataPath = path.join(process.cwd(), "data", "servers.json");
    if (!fs.existsSync(dataPath)) return NextResponse.json({ realPaths: ["/"], aliases: {} });

    const servers = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    const server = servers.find((s: any) => s.id === serverId);

    if (!server) return NextResponse.json({ realPaths: ["/"], aliases: {} });

    const realPaths: string[] = [];
    const aliases: any = {};

    // 1. 优先添加配置中的主路径
    if (server.config?.mode === 'linux' && server.config?.linuxConfig?.sourceDir) {
      const p = server.config.linuxConfig.sourceDir;
      realPaths.push(p);
      aliases[p] = `📌 部署源目录 (${p})`;
    } else if (server.config?.mode === 'k8s' && server.config?.k8s?.workDir) {
      const p = server.config.k8s.workDir;
      realPaths.push(p);
      aliases[p] = `📌 构建工作目录 (${p})`;
    }

    // 2. 添加资产基础路径
    if (server.path && !realPaths.includes(server.path)) {
      realPaths.push(server.path);
      aliases[server.path] = `基础路径 (${server.path})`;
    }

    // 3. 兜底路径
    if (realPaths.length === 0) {
      realPaths.push("/");
    }

    return NextResponse.json({ realPaths, aliases });
  } catch (error: any) {
    return NextResponse.json({ realPaths: ["/"], aliases: {}, error: error.message });
  }
}
