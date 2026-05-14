import { SSHClient } from '@/lib/ssh-client';
import { getServerConfig } from '@/lib/server-utils';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scriptName = searchParams.get('scriptName');
  const serverId = searchParams.get('serverId'); // 新增：服务器 ID
  
  if (!scriptName || !serverId) {
    return new Response('Error: 脚本名称或服务器 ID 不能为空', { status: 400 });
  }

  const config = getServerConfig(serverId);
  if (!config) return new Response('Error: 找不到指定的服务器配置', { status: 404 });

  const ssh = new SSHClient(config);
  const scriptsDir = config.path + '/scripts';
  const scriptPath = path.join(scriptsDir, scriptName);
  const command = `cd ${config.path} && bash ${scriptPath}`;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        await ssh.execStream(
          command,
          (data) => controller.enqueue(encoder.encode(data)),
          (code) => {
            controller.enqueue(encoder.encode(`\n\n--- 任务已在 [${config.name}] 结束 (码: ${code}) ---`));
            controller.close();
          }
        );
      } catch (error: any) {
        controller.enqueue(encoder.encode(`\nError: ${error.message}`));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}
