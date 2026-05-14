import { NextResponse } from 'next/server';
import { jenkinsClient } from '@/lib/api-clients';
import fs from 'fs';
import path from 'path';

const DATA_PATH = path.join(process.cwd(), 'data/projects.json');

export async function POST(request: Request) {
  try {
    const { projectId } = await request.json();
    
    if (!fs.existsSync(DATA_PATH)) return NextResponse.json({ error: 'Data not found' }, { status: 404 });
    const projects = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
    const project = projects.find((p: any) => p.id === projectId);
    
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    
    // 触发 Jenkins 构建
    await jenkinsClient.triggerBuild(project.jenkinsJob);
    
    // 更新本地状态
    project.status = 'running';
    project.lastBuild = new Date().toLocaleString();
    fs.writeFileSync(DATA_PATH, JSON.stringify(projects, null, 2));
    
    return NextResponse.json({ message: 'Jenkins deployment triggered', project });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
