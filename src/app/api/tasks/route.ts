import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const TASKS_FILE = path.join(process.cwd(), 'data/tasks.json');

function getTasks() {
  if (!fs.existsSync(TASKS_FILE)) return [];
  const content = fs.readFileSync(TASKS_FILE, 'utf-8');
  return JSON.parse(content || '[]');
}

function saveTasks(tasks: any[]) {
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

export async function GET() {
  return NextResponse.json(getTasks());
}

export async function POST(request: Request) {
  const tasks = getTasks();
  const newTask = await request.json();
  newTask.id = Date.now().toString();
  tasks.push(newTask);
  saveTasks(tasks);
  return NextResponse.json(newTask);
}

export async function PUT(request: Request) {
  const tasks = getTasks();
  const updatedTask = await request.json();
  const index = tasks.findIndex((t: any) => t.id === updatedTask.id);
  if (index === -1) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  tasks[index] = updatedTask;
  saveTasks(tasks);
  return NextResponse.json(updatedTask);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  let tasks = getTasks();
  tasks = tasks.filter((t: any) => t.id !== id);
  saveTasks(tasks);
  return NextResponse.json({ success: true });
}
