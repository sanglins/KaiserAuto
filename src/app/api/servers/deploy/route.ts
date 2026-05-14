import fs from 'fs';
import path from 'path';
import { SSHClient } from '@/lib/ssh-client';
import { generateK8sDeployScript, generateLinuxDeployScript } from '@/lib/script-template';

const DATA_PATH = path.join(process.cwd(), 'data/servers.json');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const serverId = searchParams.get('serverId');

  if (!serverId) return new Response('Missing serverId', { status: 400 });

  if (!fs.existsSync(DATA_PATH)) return new Response('Server data not found', { status: 404 });
  const servers = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  const server = servers.find((s: any) => s.id === serverId);

  if (!server || !server.config) return new Response('Server configuration missing', { status: 404 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (msg: string) => controller.enqueue(encoder.encode(msg));

      try {
        const mode = server.config.mode || 'k8s';
        send(`>>> [系统] 识别到部署模式: ${mode === 'linux' ? 'Linux 传统模式' : 'K8s 容器模式'}\n`);
        send(`>>> 正在初始化远程连接 [${server.name}] (${server.host})...\n`);
        
        const ssh = new SSHClient(server);
        
        // 根据模式生成脚本
        let script = "";
        if (mode === 'linux') {
          const linuxConfig = server.config.linuxConfig || {};
          script = generateLinuxDeployScript({
            ...linuxConfig,
            linuxConfig // Keep it for backward compatibility if the function expects it nested
          });
          // 确保 Linux 模式下的目录预先存在
          await ssh.exec(`mkdir -p ${linuxConfig.sourceDir} ${linuxConfig.backupDir}`);
        } else {
          script = generateK8sDeployScript(server.config);
          await ssh.exec(`mkdir -p ${server.path}`);
        }
        
        const remoteScriptPath = `/tmp/srv_deploy_${serverId}.sh`;
        send(`>>> 正在分发增强型自动化脚本...\n`);
        await ssh.writeFile(remoteScriptPath, script);
        await ssh.exec(`chmod +x ${remoteScriptPath}`);

        send(`>>> 启动自动化任务执行流...\n\n`);

        await ssh.execStream(
          `bash ${remoteScriptPath}`,
          (data) => send(data),
          (code) => {
            if (code === 0) {
              send(`\n✅ ${mode.toUpperCase()} 任务成功完成！\n`);
            } else {
              send(`\n❌ 任务执行中断，退出码: ${code}\n`);
            }
          }
        );

        await ssh.exec(`rm -f ${remoteScriptPath}`);
        
      } catch (error: any) {
        send(`\n❌ 致命错误: ${error.message}\n`);
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
