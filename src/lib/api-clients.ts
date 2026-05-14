/**
 * API Clients for GitLab, Jenkins, and Kuboard
 */

const GITLAB_URL = process.env.GITLAB_URL;
const GITLAB_TOKEN = process.env.GITLAB_PRIVATE_TOKEN?.trim();

const JENKINS_URL = process.env.JENKINS_URL;
const JENKINS_USER = process.env.JENKINS_USER?.trim();
const JENKINS_TOKEN = process.env.JENKINS_TOKEN?.trim();

const KUBOARD_URL = (process.env.KUBOARD_URL || '').trim();
const KUBOARD_USER = (process.env.KUBOARD_USER || 'admin').trim();
const KUBOARD_ACCESS_KEY = (process.env.KUBOARD_ACCESS_KEY || '').trim();
const KUBOARD_TOKEN = (process.env.KUBOARD_TOKEN || '').trim();

export const gitlabClient = {
  async getProjects() {
    const res = await fetch(`${GITLAB_URL}/projects?membership=true`, {
      headers: { 'PRIVATE-TOKEN': GITLAB_TOKEN || '' },
    });
    if (!res.ok) throw new Error('Failed to fetch GitLab projects');
    return res.json();
  },

  async getBranches(projectId: string | number) {
    const res = await fetch(`${GITLAB_URL}/projects/${projectId}/repository/branches`, {
      headers: { 'PRIVATE-TOKEN': GITLAB_TOKEN || '' },
    });
    if (!res.ok) throw new Error('Failed to fetch branches');
    return res.json();
  },

  async triggerPipeline(projectId: string | number, ref: string) {
    const res = await fetch(`${GITLAB_URL}/projects/${projectId}/pipeline?ref=${ref}`, {
      method: 'POST',
      headers: { 'PRIVATE-TOKEN': GITLAB_TOKEN || '' },
    });
    if (!res.ok) throw new Error('Failed to trigger pipeline');
    return res.json();
  }
};

export const jenkinsClient = {
  async triggerBuild(jobName: string, params?: Record<string, string>) {
    const auth = Buffer.from(`${JENKINS_USER}:${JENKINS_TOKEN}`).toString('base64');
    
    const encodedJobName = encodeURIComponent(jobName);
    const url = params 
      ? `${JENKINS_URL}/job/${encodedJobName}/buildWithParameters`
      : `${JENKINS_URL}/job/${encodedJobName}/build`;
    
    console.log(`Triggering Jenkins build for ${jobName} using API Token...`);
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
      body: params ? new URLSearchParams(params) : undefined,
    });
    
    if (!res.ok) {
      const text = await res.text();
      console.error('Jenkins Trigger Error Output:', text);
      throw new Error(`Failed to trigger Jenkins build: ${res.status} ${text}`);
    }
    return true;
  },

  async getBuildStatus(jobName: string, buildNumber: string | number) {
    const auth = Buffer.from(`${JENKINS_USER}:${JENKINS_TOKEN}`).toString('base64');
    const res = await fetch(`${JENKINS_URL}/job/${jobName}/${buildNumber}/api/json`, {
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });
    return res.json();
  },

  async getJobs() {
    const auth = Buffer.from(`${JENKINS_USER}:${JENKINS_TOKEN}`).toString('base64');
    const tree = encodeURIComponent('jobs[name,color,url]');
    const res = await fetch(`${JENKINS_URL}/api/json?tree=${tree}`, {
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`Jenkins getJobs Error: ${res.status} ${text}`);
      throw new Error(`Failed to fetch Jenkins jobs: ${res.status}`);
    }
    return res.json();
  },

  async getBuildLogs(jobName: string) {
    const auth = Buffer.from(`${JENKINS_USER}:${JENKINS_TOKEN}`).toString('base64');
    const encodedJobName = encodeURIComponent(jobName);
    const res = await fetch(`${JENKINS_URL}/job/${encodedJobName}/lastBuild/consoleText`, {
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });
    if (!res.ok) throw new Error('Failed to fetch Jenkins logs');
    return res.text();
  }
};

export const kuboardClient = {
  /**
   * 获取 Kuboard 中的部署列表
   * 注意：实际 API 路径可能随 Kuboard 版本变化，这里基于常用模式
   */
  async getDeployments(cluster: string = 'qaservk8s', namespace: string = 'default') {
    // 尝试多种可能的列表路径
    const urls = [
      `${KUBOARD_URL}/kuboard-api/cluster/${cluster}/kind/CICDApi/admin/resource/listWorkloads?namespace=${namespace}`,
      `${KUBOARD_URL}/kuboard-api/cluster/${cluster}/kind/KubernetesResource/admin/resource/list?kind=Deployment&namespace=${namespace}`,
      `${KUBOARD_URL}/kuboard-api/proxy/cluster/${cluster}/apis/apps/v1/namespaces/${namespace}/deployments`
    ];

    for (const url of urls) {
      try {
        const res = await fetch(url, {
          headers: {
            'Cookie': `KuboardUsername=${KUBOARD_USER}; KuboardAccessKey=${KUBOARD_ACCESS_KEY || KUBOARD_TOKEN}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          // Kuboard 的 listWorkloads 返回的可能是数组也可能是 items 对象
          return Array.isArray(data) ? { items: data } : data;
        }
      } catch (e) {
        console.error(`Failed to fetch from ${url}`);
      }
    }
    
    throw new Error(`Failed to fetch Kuboard deployments from all known paths`);
  },

  /**
   * 更新部署的镜像版本 (根据用户 Swagger 文档)
   */
  async updateImage(cluster: string, namespace: string, deployment: string, imageWithoutTag: string, imageTag: string) {
    const url = `${KUBOARD_URL}/kuboard-api/cluster/${cluster}/kind/CICDApi/admin/resource/updateImageTag`;
    
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `KuboardUsername=${KUBOARD_USER}; KuboardAccessKey=${KUBOARD_ACCESS_KEY || KUBOARD_TOKEN}`,
      },
      body: JSON.stringify({
        kind: "deployments",
        namespace: namespace,
        name: deployment,
        images: {
          [imageWithoutTag]: `${imageWithoutTag}:${imageTag}`
        }
      }),
    });
    
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to update Kuboard image: ${res.status} ${text}`);
    }
    return true;
  }
};
