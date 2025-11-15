## MODIFIED Requirements
### Requirement: 进程管理和监控
系统 SHALL 使用 PM2 进程管理器进行生产环境部署，确保服务稳定性和可观测性。

#### Scenario: PM2 进程管理
- **WHEN** 在生产环境中启动后端服务
- **THEN** 系统必须使用 PM2 作为进程管理器
- **AND** 配置自动重启策略确保服务 99.9% 可用性
- **AND** 支持多实例部署以利用多核 CPU

#### Scenario: 日志管理
- **WHEN** PM2 管理应用运行时
- **THEN** 系统必须将日志输出到指定目录
- **AND** 启用日志轮转防止磁盘空间耗尽
- **AND** 支持实时日志查看和管理命令

#### Scenario: 零停机更新
- **WHEN** 需要更新服务版本
- **THEN** 系统必须支持平滑重启（graceful reload）
- **AND** 在重启期间保持服务响应
- **AND** 自动验证新版本健康状态

#### Scenario: 服务监控
- **WHEN** PM2 进程运行时
- **THEN** 系统必须提供进程状态监控
- **AND** 在服务异常时自动重启
- **AND** 记录重启事件和原因

#### Scenario: 资源管理
- **WHEN** 配置 PM2 运行参数
- **THEN** 系统必须设置合理的内存限制
- **AND** 配置自动垃圾回收参数
- **AND** 优化 Node.js 运行时参数