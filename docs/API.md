# 共用协议

API 路由、事件字段和类型的唯一维护来源现在是 `trpg-protocol` npm 包：`contract.json`、`schemas/` 和 `index.d.ts`。本仓库中的协议产物由该依赖生成，不是另一份手写规范。

相邻检出 trpg-protocol 后，执行 `npm install --ignore-scripts`、`npm run protocol:sync`、`npm run protocol:check`。协议版本和 SHA-256 记录在 protocol.lock.json；提交生成物使运行时不必启动 Node。API 业务授权与兼容性仍由 trpg-server 执行，契约不替 DM 作判断。

未登录 state 仅返回公开配置；401需登录、403权限/死亡、409轮次/顺序冲突、400参数错误。浏览器保持同源 Cookie。私密内容按请求者裁剪，不得由客户端推断全量事件。
