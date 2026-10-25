# NightTable CLI

夜航终端客户端，Python 3.9+，运行时零第三方依赖。通过 HTTP API 连接 trpg-server，不接触数据库或复制结算规则。


## 当前协议安装方式：公开 Release

共享契约固定为公开Release v0.1.1，package.json和package-lock.json均记录真实公开URL及完整性校验。当前安装不需要npmjs账号、GitHub Packages包权限或本地协议目录。npm公网发布仍是独立待办，不因CI通过而宣称已发布。

CI显式curl下载，先对照protocol-release.json与安装锁验证SHA-256/SHA-512，再以--ignore-scripts安装并检查协议；不传递包registry凭据。常规环境可运行npm ci。若本机Node证书链不信任下载站点，可使用以下等效流程，保留TLS校验：

    curl --fail --location --proto '=https' -o protocol.tgz https://github.com/QippyXiong/trpg-protocol/releases/download/v0.1.1/qippyxiong-trpg-protocol-0.1.1.tgz
    node scripts/check-release.mjs protocol.tgz
    npm install --no-save --package-lock=false --ignore-scripts --no-audit --no-fund ./protocol.tgz
    npm run protocol:check

该流程不改写提交的依赖和锁文件。tgz仍被Git忽略。未来真正发布npmjs后再显式迁移依赖和锁文件。

## 开源使用与依赖

本项目MIT开源。Python CLI运行不依赖Node或registry凭据；协议JSON已包含在源码及安装包中。开发契约采用上文固定的公开Release，不需要私有包读取授权。服务端地址和游戏账号由实际运行者提供。

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

## 固定分发边界

仅 `@qippyxiong/trpg-protocol` 使用 npm 独立分发。服务端保持 Python 项目，网页分发静态资源，CLI 保持 Python 包（`python3 -m nighttable_cli` 或安装后的终端命令）。应用仓库里的 package.json 只用于构建期契约依赖与检查，不表示将 Python 应用改成 npm 应用。

源码公开与GitHub Packages包公开是独立设置；安装与CI状态以实际验证为准。

