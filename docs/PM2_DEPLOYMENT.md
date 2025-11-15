# PM2 部署指南

## 概述

本文档描述如何使用 PM2（Process Manager 2）在生产环境中部署和运行 AutoShip 后端服务。

## 为什么使用 PM2

PM2 是一个生产级别的 Node.js 进程管理器，提供以下功能：

- **自动重启**: 服务崩溃后自动重启，确保高可用性
- **负载均衡**: 支持集群模式，利用多核 CPU
- **零停机更新**: 平滑重载，无需中断服务
- **日志管理**: 自动日志轮转，防止磁盘空间耗尽
- **监控**: 实时监控进程状态和资源使用

## 前置要求

1. Node.js >= 18.0.0
2. npm 或 yarn
3. PM2 全局安装：
   ```bash
   npm install -g pm2
   ```

## 安装步骤

### 1. 安装项目依赖

```bash
cd Backend
npm install
```

### 2. 构建项目

```bash
npm run build
```

### 3. 启动服务（PM2）

```bash
# 方式一：使用 package.json 脚本
npm run pm2:start

# 方式二：直接使用 pm2 命令
pm2 start ecosystem.config.js

# 方式三：启动并设置为生产环境
npm run pm2:start:prod
```

### 4. 保存 PM2 配置（可选）

```bash
pm2 save
pm2 startup
```

`pm2 startup` 会生成一个系统启动脚本，让服务器重启后自动启动 PM2。

## 常用 PM2 命令

### 查看状态

```bash
# 查看所有进程状态
pm2 status

# 查看详细状态（包含 CPU、内存使用）
pm2 list

# 查看进程信息
pm2 show autoship-backend

# 实时监控（交互式界面）
pm2 monit
```

### 管理进程

```bash
# 停止服务
npm run pm2:stop
pm2 stop autoship-backend

# 重启服务
npm run pm2:restart
pm2 restart autoship-backend

# 平滑重载（零停机更新，推荐用于版本更新）
npm run pm2:reload
pm2 reload autoship-backend

# 完全停止并删除进程
pm2 delete autoship-backend
```

### 查看日志

```bash
# 查看日志（实时）
npm run pm2:logs

# 查看最近 100 行日志
pm2 logs autoship-backend --lines 100

# 查看错误日志
pm2 logs autoship-backend --err

# 查看输出日志
pm2 logs autoship-backend --out

# 导出日志
pm2 logs autoship-backend --lines 0 > logs.txt

# 清空日志文件
pm2 flush
```

### 集群模式

```bash
# 查看集群实例状态
pm2 list

# 在集群模式下重启所有实例
pm2 reload autoship-backend

# 扩展实例数量（手动）
pm2 scale autoship-backend 4  # 扩展到 4 个实例
```

## 零停机更新流程

推荐使用以下流程进行版本更新：

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 安装依赖（如有更新）
npm install

# 3. 重新构建
npm run build

# 4. 平滑重载（不会中断服务）
pm2 reload autoship-backend

# 5. 验证更新
pm2 status
curl http://localhost:3000/api/health
```

## 配置说明

### ecosystem.config.js

主要配置项：

- **instances**: 设置为 `'max'` 使用所有 CPU 核心，或设置为具体数字
- **exec_mode**: 设置为 `'cluster'` 启用集群模式
- **max_memory_restart**: 内存超过此值时自动重启（防止内存泄漏）
- **restart_delay**: 重启间隔时间
- **log_rotate**: 启用日志轮转
- **health_check_url**: 健康检查端点

### 环境变量

在 `ecosystem.config.js` 中配置：

```javascript
env: {
  NODE_ENV: 'production',
  PORT: 3000,
},
```

或者创建 `.env` 文件，PM2 会自动加载。

## 日志管理

PM2 会自动将日志输出到：

- **日志目录**: `Backend/logs/`
- **文件**:
  - `combined.log`: 合并日志
  - `out.log`: 标准输出
  - `error.log`: 错误输出

### 日志轮转配置

- **rotate_interval**: `'1d'` - 每天轮转一次
- **rotate_max**: `30` - 保留 30 天的日志

### 手动轮转日志

```bash
pm2 flush
```

## 监控与告警

### 查看资源使用

```bash
# CPU 使用率
pm2 show autoship-backend

# 内存使用
pm2 monit
```

### 健康检查

```bash
# 检查服务健康状态
curl http://localhost:3000/api/health
```

响应应该为：
```json
{ "status": "ok" }
```

## 故障排除

### 问题 1: 端口被占用

**症状**: 启动失败，提示 "Port 3000 already in use"

**解决方案**:
```bash
# 查找占用端口的进程
lsof -i :3000

# 停止 PM2 进程
pm2 stop autoship-backend

# 或删除所有 PM2 进程
pm2 delete all

# 重新启动
pm2 start ecosystem.config.js
```

### 问题 2: 服务频繁重启

**症状**: 进程状态显示 "restarting" 或 "errored"

**解决方案**:
```bash
# 查看错误日志
pm2 logs autoship-backend --err

# 查看详细错误信息
pm2 show autoship-backend

# 可能的原因和解决：
# 1. 代码错误 - 查看错误日志并修复
# 2. 内存不足 - 增加 max_memory_restart 或检查内存泄漏
# 3. 启动超时 - 增加 listen_timeout 值
```

### 问题 3: 日志文件过大

**解决方案**:
```bash
# 立即轮转日志
pm2 flush

# 或者删除日志文件后重启
pm2 restart autoship-backend
```

### 问题 4: 集群模式下负载不均

**症状**: 某些实例负载过高

**解决方案**:
```bash
# 重启所有实例
pm2 reload autoship-backend

# 检查 Node.js 版本（建议 >= 18）
node --version
```

### 问题 5: 服务启动慢

**症状**: 启动时间超过 8 秒（listen_timeout 默认值）

**解决方案**:
在 `ecosystem.config.js` 中增加 `listen_timeout`:
```javascript
listen_timeout: 15000, // 增加到 15 秒
```

### 问题 6: 权限错误（Linux/macOS）

**症状**: 权限被拒绝

**解决方案**:
```bash
# 解决 pm2 日志权限问题
sudo pm2 startup
# 或
pm2 unstartup
pm2 startup
```

## 性能优化建议

1. **实例数量**: 对于 CPU 密集型应用，实例数 = CPU 核心数
2. **内存限制**: 设置为实际可用内存的 80%
3. **日志轮转**: 根据日志量调整轮转周期
4. **健康检查**: 确保 `/api/health` 端点响应迅速
5. **零停机更新**: 始终使用 `reload` 而不是 `restart` 进行更新

## 常见问题 FAQ

**Q: 如何设置 PM2 自启动？**
A: 运行 `pm2 startup` 然后 `pm2 save`，系统重启后会自动启动所有进程。

**Q: 如何备份 PM2 配置？**
A: 运行 `pm2 save` 会将当前运行的进程保存到 `~/.pm2/dump.pm2`。

**Q: 如何恢复 PM2 配置？**
A: 运行 `pm2 resurrect` 或直接运行 `pm2 start ecosystem.config.js`。

**Q: PM2 集群模式是否适用于所有应用？**
A: 对于有状态的应用（如 WebSocket）需要特别注意。AutoShip 是无状态 API，适合集群模式。

**Q: 如何监控 PM2 性能？**
A: 使用 `pm2 monit` 实时监控，或集成到监控系统（如 Prometheus + Grafana）。

## 参考资源

- [PM2 官方文档](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [PM2 集群模式](https://pm2.keymetrics.io/docs/usage/cluster-mode/)
- [PM2 日志管理](https://pm2.keymetrics.io/docs/usage/log-management/)
- [PM2 部署指南](https://pm2.keymetrics.io/docs/usage/deployment/)

## 联系与支持

如有问题，请查看：
1. 错误日志: `pm2 logs autoship-backend --err`
2. 进程状态: `pm2 show autoship-backend`
3. 系统资源: `pm2 monit`