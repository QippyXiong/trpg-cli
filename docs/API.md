# 共用协议

唯一维护来源为独立 npm 包 **@xiong/trpg-protocol@0.1.0**。types.ts、errors.ts、routes.ts 分别定义结构与枚举、错误码、路径与方法；不包含业务判断。

正式依赖锁定版本0.1.0，不使用相对路径或要求相邻clone。发布目标尚待确认：发布后按实际registry安装，或由所有者指定Git URL和版本标签。当前开发环境用已打包tgz安装验证，不等同于已发布。

安装包后执行 npm run protocol:sync 和 npm run protocol:check。生成物随Git提交，Python运行不依赖Node；protocol.lock.json保存版本与SHA-256，不能手改。网页文案、服务端路由分发、血量和结局判断均不在协议里。
