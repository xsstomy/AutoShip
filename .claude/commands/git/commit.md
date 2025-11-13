---
name: Git: Commit
description: 提交所有变更并生成符合 Angular/Conventional Commits 规范的中文提交信息
category: Git
tags: [git, commit]
---

**用法**
```
git:commit <type>(<scope>): <subject> --body "<正文>" --footer "<footer>"
```

**参数说明**
- `<type>`: 提交类型，支持以下类型：
  - `feat`: 新功能
  - `fix`: 修复
  - `docs`: 文档更新
  - `style`: 代码格式（不影响代码运行）
  - `refactor`: 重构
  - `test`: 测试
  - `chore`: 构建过程或辅助工具的变动
- `<scope>`: 可选的影响范围，如模块或文件名
- `<subject>`: 提交简短描述，限制在 50 字符以内
- `--body`: 可选的详细描述，解释变更的原因和具体内容
- `--footer`: 可选的附加信息，如关联的 issue 编号

**示例**
```
git:commit feat(导出): 修复路径拼接导致文件未生成 --body "原因: 文件路径拼接错误\n解决: 使用正确的路径拼接方法" --footer "Closes #123"
git:commit fix: 修复登录验证失败问题
git:commit docs(README): 更新安装说明 --body "添加了详细的安装步骤和依赖说明"
```

**执行逻辑**
1. 解析命令参数，提取 type、scope、subject、body 和 footer
2. 生成符合规范的提交信息头部：`<type>(<scope>): <subject>`
3. 执行 `git add .` 添加所有变更
4. 执行 `git commit` 提交变更，使用完整的提交信息格式

**注意**
- 如果没有 `--body` 或 `--footer`，则只使用头部信息
- 如果没有 `<scope>`，则头部格式为 `<type>: <subject>`
- 提交信息支持中文，但推荐使用简洁明了的描述
