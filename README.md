# NightTable CLI

夜航终端客户端，Python 3.9+，运行时零第三方依赖。通过 HTTP API 连接 trpg-server，不接触数据库或复制结算规则。

## 使用

在仓库目录直接运行：

```sh
python3 -m nighttable_cli --server http://127.0.0.1:8765 login player
python3 -m nighttable_cli rooms
python3 -m nighttable_cli select 1 engineer
python3 -m nighttable_cli join 1
python3 -m nighttable_cli ready 1
python3 -m nighttable_cli state 1
python3 -m nighttable_cli action 1 --check explore --text '我先观察门边的痕迹'
python3 -m nighttable_cli export 1 --format md --output game-1.md
python3 -m nighttable_cli logout
```

也可 `pip install .` 后用 `nighttable` 命令。统一设置 `NIGHTTABLE_URL`，或每次带 `--server`。公网仅允许 HTTPS，本机回环允许 HTTP。密码交互输入，不接受命令行明文密码参数。会话按服务器地址分开保存在 `~/.local/share/trpg-cli`，目录0700、Cookie文件0600；不会每轮重新登录。

`ready --cancel` 取消就位；`chat` 发桌边消息；`history` 支持 `--before` 分页；`audit` 查询随机复核。`action` 自动读取当前轮号，使用 `--item ID` 和 `--take ID` 申报物品。顺序、超时、提交锁定仍由服务端判断。

提交前会向 stderr 输出 request_id；网络失败时先查 state，必要时以同样正文和 `--request-id` 重试。客户端不会自动重试写请求、不会代行、不会自动结算。

主持人和高级操作可用 `api settlement --body-file settlement.json` 等提交完整 API JSON；权限不变。导出文件默认拒绝覆盖。用户自己的会话和导出不可提交到 Git。

运行CLI无需其他源码仓库；跨仓库回归可在相邻 trpg-server 和 trpg-web 存在时运行：`python3 -m unittest discover -s tests`。本版是命令式 CLI，暂不提供全屏 TUI 或后台自动决策。

## 共用协议依赖

本仓库声明 `@xiong/trpg-protocol: 0.1.0`，正式安装不依赖相邻目录。包发布目标已选GitHub Packages，实际仓库地址与权限待核验，当前只用已打包tgz完成本地验证。发布后执行 `npm install --ignore-scripts`、`npm run protocol:sync`、`npm run protocol:check` 并提交安装锁文件。Python运行无需Node。详见 [协议说明](docs/API.md)。

## 固定分发边界

仅 `@xiong/trpg-protocol` 使用 npm 独立分发。服务端保持 Python 项目，网页分发静态资源，CLI 保持 Python 包（`python3 -m nighttable_cli` 或安装后的终端命令）。应用仓库里的 package.json 只用于构建期契约依赖与检查，不表示将 Python 应用改成 npm 应用。

## GitHub Packages 发布方案

已选择私有 GitHub Packages，scope 映射在 .npmrc，发布 registry 被限定为 https://npm.pkg.github.com。实际仓库所有者必须与 @xiong 对应；当前尚未拿到远程地址，未推送或发布。

协议仓库的 Publish private protocol package 工作流只可手动触发，先核验私有仓库及scope，再测试、绑定实际仓库URL并发布；新包按GitHub默认保持private，不添加public发布选项。三端CI具备packages:read，仍须在包的Actions访问设置中授予这些私有仓库读取权限，或配置只读NPM_READ_TOKEN。本机可通过npm login --scope=@xiong --auth-type=legacy --registry=https://npm.pkg.github.com认证，token只在本机输入，不入库或群聊。
