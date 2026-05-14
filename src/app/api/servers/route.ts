import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const dataPath = path.join(process.cwd(), 'data/servers.json');

function ensureDirectory() {
  const dirPath = path.dirname(dataPath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getServers() {
  ensureDirectory();
  if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(dataPath, '[]', 'utf-8');
    return [];
  }
  const content = fs.readFileSync(dataPath, 'utf-8');
  try {
    return JSON.parse(content || '[]');
  } catch (e) {
    return [];
  }
}

function saveServers(servers: any[]) {
  ensureDirectory();
  fs.writeFileSync(dataPath, JSON.stringify(servers, null, 2));
}

export async function GET() {
  const servers = getServers();
  return NextResponse.json(servers);
}

export async function POST(request: Request) {
  const server = await request.json();
  const servers = getServers();
  
  if (server.id) {
    // 编辑逻辑
    const index = servers.findIndex((s: any) => s.id === server.id);
    if (index !== -1) {
      servers[index] = { ...servers[index], ...server };
    }
  } else {
    // 新增逻辑
    const newServer = {
      ...server,
      id: `srv-${Date.now()}`,
      config: {
        mode: 'k8s',
        imageName: '',
        targetDir: server.path || '',
        linuxConfig: {
          sourceDir: server.path || '',
          targetDir: '',
          backupDir: '',
          syncEnabled: false,
          remoteHost: '',
          remoteUser: 'root',
          remotePass: ''
        },
        k8s: {
          masterHost: '',
          masterUser: 'root',
          masterPassword: '',
          namespace: 'default',
          deployment: '',
          container: ''
        }
      }
    };
    servers.push(newServer);
  }
  
  saveServers(servers);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  
  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  
  let servers = getServers();
  servers = servers.filter((s: any) => s.id !== id);
  saveServers(servers);
  
  return NextResponse.json({ success: true });
}
