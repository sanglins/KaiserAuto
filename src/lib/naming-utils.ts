import fs from 'fs';
import path from 'path';

const MAP_FILE = path.join(process.cwd(), 'data/naming-maps.json');

interface NamingMap {
  [serverId: string]: {
    folders: { [realName: string]: string };
    scripts: { [realName: string]: string };
  };
}

function getMap(): NamingMap {
  if (!fs.existsSync(MAP_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
  } catch { return {}; }
}

export function saveAlias(serverId: string, type: 'folders' | 'scripts', realName: string, alias: string) {
  const map = getMap();
  if (!map[serverId]) map[serverId] = { folders: {}, scripts: {} };
  map[serverId][type][realName] = alias;
  fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 2));
}

export function getAliases(serverId: string) {
  const map = getMap();
  return map[serverId] || { folders: {}, scripts: {} };
}
