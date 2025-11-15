# Change: 使用 PM2 部署后端服务

## 为什么
当前后端服务使用简单的 `node dist/index.js` 命令启动，这种方式在生产环境中存在以下问题：
1. 进程管理不稳定 - 服务崩溃后无法自动重启
2. 无法利用多核 CPU - 无法运行多个进程实例
3. 缺乏监控和日志管理 - 无法跟踪服务状态和性能指标
4. 没有平滑重启机制 - 更新部署时会中断服务

## What Changes
- 添加 PM2 作为生产环境进程管理器
- 配置 PM2 配置文件（ecosystem.config.js）定义服务启动参数
- 更新启动脚本使用 PM2 管理服务
- 添加 PM2 监控和管理命令
- 配置自动重启、日志轮转和性能监控

## Impact
- **影响的规格：** system (系统配置)
- **影响的代码：** Backend/package.json, 新增 ecosystem.config.js
- **部署流程：** 需要在服务器上安装 PM2 (`npm install -g pm2`)