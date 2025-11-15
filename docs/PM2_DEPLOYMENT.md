````markdown
# PM2 部署指南（AutoShip Backend）

## 概述

本文档介绍如何在生产环境使用 PM2 部署和管理 AutoShip 后端服务。

默认项目路径示例：

```bash
/www/server/nodejs/AutoShip/Backend
````

> 若目录不同，请替换为你的实际路径。

---

## 一、为什么使用 PM2

PM2 是一个生产级别的 Node.js 进程管理器，提供：

* 自动重启：进程崩溃后自动拉起
* 集群模式：利用多核 CPU 提升并发能力
* 零停机更新：通过 reload 实现平滑升级
* 日志管理：配合 pm2-logrotate 进行日志轮转
* 监控能力：实时查看 CPU、内存、重启次数等

---

## 二、前置条件

1. 已安装 Node.js（推荐版本 ≥ 18）：

   ```bash
   node -v
   ```

2. 全局安装 PM2：

   ```bash
   npm install -g pm2
   ```

3. 代码已部署到服务器，例如：

   ```bash
   cd /www/server/nodejs/AutoShip/Backend
   ```

---

## 三、项目内 npm scripts 说明

在 `package.json` 中推荐配置如下脚本（可直接复制覆盖 `scripts` 部分）：

```jsonc
"scripts": {
  "dev": "npx tsx src/index.ts",
  "build": "npx tsc",
  "start": "node dist/index.js",

  "pm2:start": "pm2 start ecosystem.config.js",
  "pm2:start:prod": "pm2 start ecosystem.config.js --env production",
  "pm2:stop": "pm2 stop autoship-backend",
  "pm2:restart": "pm2 restart autoship-backend --update-env",
  "pm2:reload": "pm2 reload autoship-backend",
  "pm2:delete": "pm2 delete autoship-backend",
  "pm2:logs": "pm2 logs autoship-backend",
  "pm2:monitor": "pm2 monit",
  "pm2:status": "pm2 status",

  "deploy": "git pull && npm ci && npm run build && pm2 reload ecosystem.config.js --env production --update-env"
}
```

说明：

* `deploy`：后续上线只需执行这一条命令。
* `pm2:start:prod`：首次启动使用（生产环境）。

---

## 四、首次部署流程（初始化）

首次在服务器部署 AutoShip 后端，建议按以下步骤执行。

### 1. 进入项目目录

```bash
cd /www/server/nodejs/AutoShip/Backend
```

### 2. 安装依赖

若仓库中已有 `package-lock.json`，推荐使用：

```bash
npm ci
```

若没有 `package-lock.json`，先在本地或服务器执行：

```bash
npm install
```

并将生成的 `package-lock.json` 提交至仓库，以便后续使用 `npm ci`。

### 3. 构建项目（TypeScript 编译）

```bash
npm run build
```

构建成功后会生成 `dist/` 目录。

### 4. 使用 PM2 启动服务（生产）

```bash
npm run pm2:start:prod
```

等价于：

```bash
pm2 start ecosystem.config.js --env production
```

如需保存当前 PM2 进程配置并设置为开机自启，可执行：

```bash
pm2 save
pm2 startup
# 按终端提示执行最后一条命令
```

---

## 五、后续更新上线流程（推荐）

完成首次部署后，每次更新代码上线只需执行：

```bash
cd /www/server/nodejs/AutoShip/Backend
npm run deploy
```

`npm run deploy` 将自动执行：

1. `git pull`：拉取最新代码
2. `npm ci`：依据 `package-lock.json` 安装依赖（严格锁版本）
3. `npm run build`：重新构建 TypeScript
4. `pm2 reload ecosystem.config.js --env production --update-env`：平滑重载，零停机更新，并刷新环境变量

无需再手动执行 `npm ci` / `npm run build` / `pm2 restart`。

---

## 六、ecosystem.config.js 核心配置示例

推荐的 `ecosystem.config.js` 基本结构如下（可根据需要调整端口等）：

```js
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'autoship-backend',
      script: 'dist/index.js',

      // 进程模型
      instances: 'max',        // 使用所有 CPU 核心
      exec_mode: 'cluster',    // 集群模式

      // 自动重启 & 稳定性
      watch: false,            // 生产环境关闭文件监听
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,

      // 环境变量
      env: {
        NODE_ENV: 'production',
        PORT: 3100
      },

      // 日志配置
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Node 参数
      node_args: '--max-old-space-size=1024',

      // 每个实例可通过 process.env.INSTANCE_ID 区分
      instance_var: 'INSTANCE_ID'
    }
  ]
};
```

注意：

* 日志目录需提前创建：

  ```bash
  mkdir -p /www/server/nodejs/AutoShip/Backend/logs
  ```
* 日志轮转推荐由 `pm2-logrotate` 模块统一管理（见下文）。

---

## 七、PM2 常用命令

### 查看状态与监控

```bash
# 查看简要状态
npm run pm2:status
# 或
pm2 status

# 查看进程列表
pm2 list

# 查看指定进程详情
pm2 show autoship-backend

# 实时监控（交互模式）
npm run pm2:monitor
# 或
pm2 monit
```

### 管理进程

```bash
# 停止服务
npm run pm2:stop
# 或
pm2 stop autoship-backend

# 重启服务（可能有短暂停机）
npm run pm2:restart
# 或
pm2 restart autoship-backend --update-env

# 平滑重载（零停机更新，推荐）
npm run pm2:reload
# 或
pm2 reload autoship-backend

# 删除并停止进程
npm run pm2:delete
# 或
pm2 delete autoship-backend
```

### 开机自启与状态保存

```bash
# 保存当前 PM2 进程列表
pm2 save

# 配置系统开机自启（按提示执行最后一条命令）
pm2 startup
```

---

## 八、日志查看与管理

确保日志目录存在：

```bash
mkdir -p /www/server/nodejs/AutoShip/Backend/logs
```

常用日志命令：

```bash
# 实时查看日志
npm run pm2:logs

# 查看最近 100 行日志
pm2 logs autoship-backend --lines 100

# 仅查看错误日志
pm2 logs autoship-backend --err

# 仅查看标准输出日志
pm2 logs autoship-backend --out
```

导出日志到文件：

```bash
pm2 logs autoship-backend --lines 0 > autoship-backend.log
```

清空日志内容（慎用）：

```bash
pm2 flush
```

---

## 九、日志轮转（pm2-logrotate）

若已安装并启用 `pm2-logrotate` 模块，可通过以下命令调整策略：

```bash
# 单个日志文件最大 10M（超过自动轮转）
pm2 set pm2-logrotate:max_size 10M

# 最多保留 30 个历史日志文件
pm2 set pm2-logrotate:retain 30

# 开启压缩
pm2 set pm2-logrotate:compress true
```

检查模块状态：

```bash
pm2 ls
# 在 Module 区域应能看到 pm2-logrotate
```

---

## 十、健康检查

后端建议提供健康检查接口，例如：

```bash
curl http://localhost:3100/api/health
```

预期返回内容示例：

```json
{ "status": "ok" }
```

该接口可用于：

* 部署后自检
* 监控系统或 Nginx upstream 的存活检查

---

## 十一、常见问题与排查

### 问题 1：服务未启动或频繁重启

现象：

* `pm2 list` 状态为 `errored` 或频繁重启（重启次数快速增加）
* 访问接口失败

排查步骤：

```bash
pm2 logs autoship-backend --lines 100
pm2 show autoship-backend
```

常见原因：

1. 代码异常或配置错误：查看错误堆栈并修复后，重新执行 `npm run deploy`。
2. 构建失败：单独执行 `npm run build`，检查 TypeScript 报错。
3. 环境变量缺失：确认 `ecosystem.config.js` 中 `env` 配置，或 `.env` 文件是否正确加载。

---

### 问题 2：端口被占用（EADDRINUSE）

现象：

* 日志中报错 `EADDRINUSE: address already in use :::3100`

处理方式：

```bash
# 查找占用端口的进程
lsof -i :3100

# 停止 PM2 中的进程
pm2 stop autoship-backend
pm2 delete autoship-backend

# 重新部署
npm run deploy
```

---

### 问题 3：日志文件过大

可临时清空：

```bash
pm2 flush
```

长期建议：

* 使用 `pm2-logrotate`，设置合理的 `max_size` 和 `retain`。

---

## 十二、性能与稳定性建议

1. 实例数量：`instances: 'max'` 一般即可，也可手动设置为 CPU 核心数。
2. 内存限制：`max_memory_restart: '1G'` 可按机器实际内存调整。
3. 上线方式：尽量使用 `pm2 reload`（零停机），避免频繁 `restart`。
4. 日志管理：使用 `pm2-logrotate` 控制日志大小和数量。
5. 健康检查：保持 `/api/health` 实现简单、快速返回，以便监控与探活。

---

## 十三、快捷记忆

* 首次部署（初始化）：

  ```bash
  cd /www/server/nodejs/AutoShip/Backend
  npm ci
  npm run build
  npm run pm2:start:prod
  pm2 save
  pm2 startup
  ```

* 后续更新上线（每次发版只需一条）：

  ```bash
  cd /www/server/nodejs/AutoShip/Backend
  npm run deploy
  ```

```
```
