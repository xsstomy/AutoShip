module.exports = {
  apps: [
    {
      name: 'autoship-backend',
      script: 'dist/index.js',
      instances: 'max', // 使用所有 CPU 核心
      exec_mode: 'cluster', // 集群模式

      // 自动重启配置
      watch: false, // 生产环境关闭监听
      ignore_watch: ['node_modules', 'logs'],
      max_memory_restart: '1G', // 内存超过 1GB 时重启
      min_uptime: '10s', // 最少运行时间，避免频繁重启
      max_restarts: 10, // 最大重启次数
      restart_delay: 4000, // 重启间隔 4 秒

      // 环境变量
      env: {
        NODE_ENV: 'production',
        PORT: 3100,
      },

      // 日志配置
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      log_type: 'json',

      // 日志轮转
      log_type: 'json',
      rotate_interval: '1d', // 每天轮转一次
      rotate_max: 30, // 保留 30 天的日志

      // 高级配置
      kill_timeout: 5000, // 等待进程优雅关闭的时间
      listen_timeout: 8000, // 应用启动超时时间
      shutdown_with_message: true,

      // Node.js 参数
      node_args: '--max-old-space-size=1024', // V8 堆内存限制

      // 健康检查（可选）
      health_check_grace_period: 3000,
      health_check_url: 'http://localhost:3100/api/health',

      // 实例间负载均衡
      instance_var: 'INSTANCE_ID',
    },
  ],

  // 部署配置（如果需要远程部署）
  deploy: {
    production: {
      user: 'ubuntu',
      host: ['your-server.com'],
      ref: 'origin/main',
      repo: 'git@github.com:your-username/autoship.git',
      path: '/var/www/autoship/Backend',
      'post-deploy':
        'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
    },
  },
};