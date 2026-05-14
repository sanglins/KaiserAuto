import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// 统一迁移至根目录 data 文件夹
const dataPath = path.join(process.cwd(), 'data/projects.json');

function ensureDirectory() {
  const dirPath = path.dirname(dataPath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getProjects() {
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

function saveProjects(projects: any[]) {
  ensureDirectory();
  fs.writeFileSync(dataPath, JSON.stringify(projects, null, 2));
}

export async function GET() {
  const projects = getProjects();
  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const project = await request.json();
  const projects = getProjects();
  
  const newProject = {
    id: `proj-${Date.now()}`,
    status: 'idle',
    lastBuild: '从未构建',
    // 默认配置模版
    config: {
      imageName: '',
      targetDir: '',
      k8s: {
        masterHost: '',
        masterUser: 'root',
        masterPassword: '',
        namespace: 'default',
        deployment: '',
        container: ''
      }
    },
    ...project
  };
  
  projects.push(newProject);
  saveProjects(projects);
  
  return NextResponse.json(newProject);
}

export async function PUT(request: Request) {
  const { id, ...updates } = await request.json();
  
  if (!id) {
    return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
  }
  
  const projects = getProjects();
  const index = projects.findIndex((p: any) => p.id === id);
  
  if (index === -1) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  
  projects[index] = { ...projects[index], ...updates };
  saveProjects(projects);
  
  return NextResponse.json(projects[index]);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  
  if (!id) {
    return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
  }
  
  let projects = getProjects();
  projects = projects.filter((p: any) => p.id !== id);
  saveProjects(projects);
  
  return NextResponse.json({ message: 'Project removed from dashboard' });
}
