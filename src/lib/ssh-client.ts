import { Client } from 'ssh2';

export class SSHClient {
  private client: Client;
  private config: any;

  constructor(hostOrConfig: any, port?: number, username?: string, password?: string) {
    this.client = new Client();
    
    if (typeof hostOrConfig === 'object' && hostOrConfig !== null) {
      this.config = {
        host: String(hostOrConfig.host || '').trim(),
        port: Number(hostOrConfig.port || 22),
        username: String(hostOrConfig.username || 'root').trim(),
        password: hostOrConfig.password || undefined,
      };
    } else {
      this.config = {
        host: String(hostOrConfig || '').trim(),
        port: Number(port || 22),
        username: String(username || 'root').trim(),
        password: password || undefined,
      };
    }
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.config.host || this.config.host === "[object Object]") {
        return reject(new Error("Invalid SSH Host: Parameters passed incorrectly."));
      }
      this.client
        .on('ready', () => resolve())
        .on('error', (err: Error) => reject(err))
        .connect({
          host: this.config.host,
          port: this.config.port,
          username: this.config.username,
          password: this.config.password,
          readyTimeout: 10000,
        });
    });
  }

  async exec(command: string, onData?: (data: string) => void): Promise<{ stdout: string; stderr: string }> {
    await this.connect();
    return new Promise((resolve, reject) => {
      this.client.exec(command, (err, stream) => {
        if (err) return reject(err);
        let stdout = '';
        let stderr = '';
        stream
          .on('close', (code: number) => {
            this.client.end();
            resolve({ stdout, stderr });
          })
          .on('data', (data: Buffer) => {
            const str = data.toString();
            stdout += str;
            if (onData) onData(str);
          })
          .stderr.on('data', (data: Buffer) => {
            const str = data.toString();
            stderr += str;
            if (onData) onData(str);
          });
      });
    });
  }

  // 新增：专门用于流式日志输出的执行方法
  async execStream(command: string, onData: (data: string) => void, onClose?: (code: number) => void): Promise<void> {
    await this.connect();
    return new Promise((resolve, reject) => {
      this.client.exec(command, (err, stream) => {
        if (err) {
          this.client.end();
          return reject(err);
        }
        stream
          .on('close', (code: number) => {
            this.client.end();
            if (onClose) onClose(code);
            resolve();
          })
          .on('data', (data: Buffer) => onData(data.toString()))
          .stderr.on('data', (data: Buffer) => onData(data.toString()));
      });
    });
  }

  async writeFile(remotePath: string, content: string): Promise<void> {
    await this.connect();
    return new Promise((resolve, reject) => {
      this.client.sftp((err, sftp) => {
        if (err) return reject(err);
        const stream = sftp.createWriteStream(remotePath);
        stream.on('close', () => {
          this.client.end();
          resolve();
        });
        stream.on('error', (err) => {
          this.client.end();
          reject(err);
        });
        stream.end(content);
      });
    });
  }

  async readdir(dirPath: string): Promise<string[]> {
    await this.connect();
    return new Promise((resolve, reject) => {
      this.client.sftp((err, sftp) => {
        if (err) return reject(err);
        sftp.readdir(dirPath, (err, list) => {
          this.client.end();
          if (err) reject(err);
          else resolve(list.map(item => item.filename));
        });
      });
    });
  }

  async upload(localPath: string, remotePath: string): Promise<void> {
    await this.connect();
    return new Promise((resolve, reject) => {
      this.client.sftp((err, sftp) => {
        if (err) return reject(err);
        sftp.fastPut(localPath, remotePath, (err) => {
          this.client.end();
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }
}
