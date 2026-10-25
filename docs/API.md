# 共用协议

唯一维护来源为独立 npm 包 **@qippyxiong/trpg-protocol@0.1.0**。types.ts、errors.ts、routes.ts 分别定义结构与枚举、错误码、路径与方法；不包含业务判断。

正式依赖锁定版本0.1.0，不使用相对路径或要求相邻clone。协议0.1.0已发布到私有GitHub Packages，本机真实冷安装已验证；CI跨仓库读取授权仍待完成。

安装包后执行 npm run protocol:sync 和 npm run protocol:check。生成物随Git提交，Python运行不依赖Node；protocol.lock.json保存版本与SHA-256，不能手改。网页文案、服务端路由分发、血量和结局判断均不在协议里。
