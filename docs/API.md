# 共用契约

契约源码位于trpg-protocol（仅类型、错误码、路由），应用业务与鉴权仍在server。当前固定公开Release v0.1.1；包名@qippyxiong/trpg-protocol。

package.json及package-lock.json均使用真实Release URL，protocol-release.json固定版本和文件SHA-256，安装锁记录SHA-512。CI先验证再安装，不需要registry凭据。生成JSON/浏览器常量仍由npm run protocol:sync生成，npm run protocol:check检测漂移。

npm官方registry尚未发布，不与Release安装通过混同。
