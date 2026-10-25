# NightTable TypeScript CLI

Node.js 22+ 的 TypeScript 终端客户端，MIT 开源。保留 login、rooms、select、join、ready、state、action、chat、history、audit、export 和 api。服务器仍负责游戏规则、权限、顺序和回合锁定。

从 0.2.0 起不再需要 Python 或 pip。旧 Python 实现保留在 Git 历史；升级前提交为 e4013d8。共享契约直接引用 @qippyxiong/trpg-protocol，没有另写一份规则。

## 安装

下载公开 Release 中的 npm 包后安装：

    curl --fail --location --proto '=https' -o trpg-cli-0.2.0.tgz https://github.com/QippyXiong/trpg-cli/releases/download/v0.2.0/trpg-cli-0.2.0.tgz
    npm install --global --offline --ignore-scripts ./trpg-cli-0.2.0.tgz
    nighttable --help

包包含编译后的 JS 和固定版本的共享契约，因此本地 tgz 可离线安装，无需 npmjs 登录、GitHub Token 或 TypeScript 编译器。nighttable 与 trpg-cli 是同一命令入口。CLI 尚未发布到 npm 公网；不要把 GitHub Release 分发混成 npmjs 已发布。

全局目录或缓存不可写时，使用自己的 --prefix 和 --cache 目录，并把该 prefix 的命令目录加入 PATH；不要求管理员修改系统权限。

## 从源码构建

    npm ci --ignore-scripts
    npm run build
    node dist/cli.js --help

开发依赖是公开的 TypeScript 和 Node 类型；协议依赖固定到公开 Release URL。package-lock.json、protocol-release.json 记录真实来源与完整性校验。

若本机 Node 证书链无法验证 GitHub 下载，可用系统 curl 先取包并校验，再缓存后执行 npm ci；不要关闭 TLS 校验：

    curl --fail --location --proto '=https' -o protocol.tgz https://github.com/QippyXiong/trpg-protocol/releases/download/v0.1.1/qippyxiong-trpg-protocol-0.1.1.tgz
    node scripts/check-release.mjs protocol.tgz
    npm cache add ./protocol.tgz --cache .npm-cache
    npm ci --ignore-scripts --cache .npm-cache
    npm run build

tgz、.npm-cache 和 node_modules 均不入 Git。

## 使用

统一设置 NIGHTTABLE_URL，或每次带 --server；不设置时默认本机 http://127.0.0.1:8765。公网仅允许 HTTPS。

    nighttable --server https://你的服务地址 login 你的账号
    nighttable --server https://你的服务地址 rooms
    nighttable --server https://你的服务地址 select 9 engineer
    nighttable --server https://你的服务地址 join 9
    nighttable --server https://你的服务地址 ready 9
    nighttable --server https://你的服务地址 action 9 --check explore --text "观察门框"
    nighttable --server https://你的服务地址 export 9 --output game-9.md
    nighttable --server https://你的服务地址 logout

默认交互式密码输入不回显，不接受明文密码参数。自动化可用 login USER --password-stdin，从受控管道输入密码；不要将密码字面量写入命令或群聊。服务账号仍需服务方私下提供，源码公开不提供游戏账号。

action 自动读取当前轮号，--item、--take 可重复。提交前在 stderr 输出 request_id；网络失败后先查 state，必要时用相同正文和 --request-id 重试。写请求不自动重试。导出以独占创建方式写文件，拒绝覆盖已有文件。

ready --cancel 取消就位；history --before 分页；api ROUTE --body-file JSON 支持高级操作，授权仍由服务端决定。

## 会话与迁移

Cookie 按完整 origin 隔离，默认保存在用户目录 .local/share/trpg-cli，可用 --session-dir 修改。Linux/macOS 目录0700、文件0600；Windows保留已有ACL，不强制chmod。密码不写入磁盘，JSON会话只含当前服务器Cookie。

同一目录下的旧 Python LWP .cookies 文件会按服务器域名、有效期和Secure属性检查后自动导入，新JSON使用 .session.json 后缀，旧文件保留。导入失败或会话过期时重新登录即可。

重定向默认拒绝，Cookie不转发到其他origin。HTTPS使用Node默认信任配置；企业CA可通过Node的NODE_EXTRA_CA_CERTS配置，程序不关闭TLS检查。

## 测试

独立仓库只需Node，不依赖server源码：

    npm test
    npm run test:package

独立测试覆盖会话持久化/隔离/迁移、密码stdin、完整命令参数、错误状态、超时、不重试、重定向拒绝、导出与防覆盖。打包测试在临时目录离线安装实际tgz并运行命令入口，避免只在源码目录里能运行。

可选真实API测试仅在显式配置服务端源码路径时启动临时Python服务和测试账号，不连接生产库：

    TRPG_SERVER_DIR=/path/to/trpg-server TRPG_PYTHON=/path/to/python npm test

不配置时明确SKIP，不在测试收集阶段导入外部模块。TRPG_PYTHON默认python3，只用于可选服务端夹具，不是CLI运行依赖。

CI在Linux/Windows与Node22上执行构建、测试、离线打包安装及PowerShell预建会话目录验证。
