# TypeScript CLI 与共用契约

CLI直接从@qippyxiong/trpg-protocol导入类型、API路径和版本，不保留Python协议快照。契约固定为公开Release v0.1.1；protocol-release.json与package-lock.json记录来源和校验值。

npm run protocol:check核对实际依赖与protocol.lock.json；升级时用npm run protocol:sync更新锁。业务与授权始终由server处理。

CLI的npm分发包捆绑这一份协议依赖，用户安装已打包CLI不需要再次访问GitHub Packages。没有发布到npm官方registry；公开tgz分发不代表npmjs已发布。
