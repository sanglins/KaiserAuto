import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);
const CERT_PATH = path.join(process.cwd(), 'k8s', 'client.crt');
const KEY_PATH = path.join(process.cwd(), 'k8s', 'client.key');
const SERVER_URL = process.env.K8S_SERVER_URL || '';

// 构造通用的 kubectl 基础命令参数
const KUBECTL_BASE = `kubectl --server=${SERVER_URL} --client-certificate=${CERT_PATH} --client-key=${KEY_PATH} --insecure-skip-tls-verify=true`;

export const k8sNativeClient = {
  /**
   * 获取所有 Deployment 列表 (直接通过证书参数)
   */
  async getDeployments(namespace: string = 'default') {
    try {
      const { stdout } = await execAsync(`${KUBECTL_BASE} get deployments -n ${namespace} -o json`);
      const data = JSON.parse(stdout);
      return data;
    } catch (error: any) {
      console.error('kubectl get deployments failed:', error.stderr || error.message);
      throw new Error(`Kubectl Error: ${error.stderr || error.message}`);
    }
  },

  /**
   * 更新 Deployment 镜像 (直接通过证书参数)
   */
  async updateImage(namespace: string, deploymentName: string, containerName: string, fullImage: string) {
    try {
      const patch = JSON.stringify({
        spec: {
          template: {
            spec: {
              containers: [{ name: containerName, image: fullImage }]
            }
          }
        }
      });
      
      const { stdout } = await execAsync(
        `${KUBECTL_BASE} patch deployment ${deploymentName} -n ${namespace} -p '${patch}'`
      );
      
      console.log('kubectl patch success:', stdout);
      return { message: stdout };
    } catch (error: any) {
      console.error('kubectl patch failed:', error.stderr || error.message);
      throw new Error(`Kubectl Patch Error: ${error.stderr || error.message}`);
    }
  }
};
