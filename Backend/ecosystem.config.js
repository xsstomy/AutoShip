// ecosystem.config.js
module.exports = {
    apps: [
        {
            name: "autoship-backend",
            script: "dist/index.js",

            // 进程模型
            instances: 1,
            exec_mode: "cluster",

            // 自动重启 & 稳定性
            watch: false,
            max_memory_restart: "1G",
            min_uptime: "10s",
            max_restarts: 10,
            restart_delay: 4000,

            // 环境变量
            env: {
                NODE_ENV: "production",
                PORT: 3100,
            },

            // 日志
            out_file: "./logs/out.log",
            error_file: "./logs/error.log",
            log_date_format: "YYYY-MM-DD HH:mm:ss Z",
            merge_logs: true,

            // 进程关闭&启动
            kill_timeout: 5000,
            listen_timeout: 8000,

            // Node 参数
            node_args: "--max-old-space-size=1024",

            // 实例间变量
            instance_var: "INSTANCE_ID",
        },
    ],

    // 如果暂时不用 pm2 deploy，可以先留着 / 暂时忽略
    // 用 pm2 deploy 时，再把 user/host/repo/path 改成真实值
    deploy: {
        production: {
            user: "ubuntu",
            host: ["your-server.com"],
            ref: "origin/main",
            repo: "git@github.com:your-username/autoship.git",
            path: "/var/www/autoship/Backend",
            "post-deploy":
                "npm ci && npm run build && pm2 reload ecosystem.config.js --env production",
        },
    },
};
