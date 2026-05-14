import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["ssh2"],
  
  // 允许的开发来源（包含您的域名）
  // 注意：Next.js 15+ 某些版本可能需要在此处或 experimental 内配置
  allowedDevOrigins: [
    '',           // 局域网 IP
    '',   // 您的域名
    'localhost',              // 本地开发
    '*.local-ip.net',         // 内网通配符
  ],
  
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
    proxyClientMaxBodySize: 500 * 1024 * 1024, // 500MB
    
    // 如果是开发环境，添加 Turbopack 配置
    ...(process.env.NODE_ENV === 'production' && {
      turbo: {
        allowedDevOrigins: ['', ''],
      },
    }),
  },
  
  // 开发环境指示器：生产环境默认关闭，开发环境按需配置
  // 如果您想彻底隐藏那个 "N" 标志，可以将 devIndicators 设为 false
  devIndicators: process.env.NODE_ENV === 'production' ? {
    autoPrerender: false,
  } : false,

};

export default nextConfig;
