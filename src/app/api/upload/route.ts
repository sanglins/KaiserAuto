import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { SSHClient } from '@/lib/ssh-client';

const DATA_PATH = path.join(process.cwd(), 'data/servers.json');

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const targetFolder = formData.get('folder') as string || '/';
    const serverId = formData.get('serverId') as string;

    if (!file || !serverId) {
      return NextResponse.json({ error: 'Missing file or serverId' }, { status: 400 });
    }

    // 1. 获取服务器资产信息
    if (!fs.existsSync(DATA_PATH)) return NextResponse.json({ error: 'Server list not found' }, { status: 404 });
    const servers = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
    const server = servers.find((s: any) => s.id === serverId);

    if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 });

    // 2. 将文件保存到中转目录
    const buffer = Buffer.from(await file.arrayBuffer());
    const tempPath = path.join(process.cwd(), 'tmp', file.name);
    if (!fs.existsSync(path.join(process.cwd(), 'tmp'))) {
      fs.mkdirSync(path.join(process.cwd(), 'tmp'));
    }
    fs.writeFileSync(tempPath, buffer);

    // 3. 通过 SSH 推送到目标服务器的自定义目录
    try {
      const uploadPromises = [];
      
      // 3.1 推送到主节点
      const mainSsh = new SSHClient(server);
      const remotePath = path.join(targetFolder, file.name);
      
      uploadPromises.push((async () => {
        await mainSsh.exec(`mkdir -p ${targetFolder}`);
        await mainSsh.upload(tempPath, remotePath);
      })());

      // 3.2 如果是 Linux 模式且开启了集群同步，则推送到其他子节点
      if (server.config?.mode === 'linux' && server.config?.linuxConfig?.syncEnabled && server.config?.linuxConfig?.syncNodes) {
        for (const node of server.config.linuxConfig.syncNodes) {
          const nodeSsh = new SSHClient({
            host: node.host,
            port: node.port || 22,
            username: node.user,
            password: node.pass
          });
          uploadPromises.push((async () => {
            await nodeSsh.exec(`mkdir -p ${targetFolder}`);
            await nodeSsh.upload(tempPath, remotePath);
          })());
        }
      }

      await Promise.all(uploadPromises);
      
      // 清理中转文件
      fs.unlinkSync(tempPath);
      
      return NextResponse.json({ message: 'File distributed successfully to all nodes', path: remotePath });
    } catch (sshError: any) {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      return NextResponse.json({ error: `Distribution failed: ${sshError.message}` }, { status: 500 });
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
