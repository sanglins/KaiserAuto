import fs from 'fs';
import path from 'path';

const SERVERS_FILE = path.join(process.cwd(), 'data/servers.json');

export function getServerConfig(id: string) {
  if (!fs.existsSync(SERVERS_FILE)) return null;
  const servers = JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf8'));
  return servers.find((s: any) => s.id === id) || null;
}
