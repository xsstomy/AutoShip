# Change: 配置服务器端口从环境变量读取并更改默认值为3100

## Why
当前服务器启动端口硬编码为3000，虽然.env.example中已定义了PORT环境变量，但代码并未实际使用。这导致：
1. 无法通过环境变量灵活配置端口
2. 部署时需要修改代码才能改变端口
3. 不符合配置管理的最佳实践

需要修改为优先从环境变量读取，并更新默认值为3100。

## What Changes
- 修改 `Backend/src/index.ts` 以读取 `process.env.PORT`
- 将服务器默认端口从 3000 更改为 3100
- 更新 `.env.example` 中的默认端口配置
- 保留环境变量配置能力，支持生产环境灵活配置

## Impact
- Affected specs: configuration (服务器配置管理)
- Affected code:
  - Backend/src/index.ts (端口读取逻辑)
  - Backend/.env.example (默认配置值)
