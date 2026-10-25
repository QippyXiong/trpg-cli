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

也可 `pip install .` 后用 `nighttable` 命令。统一设置 `NIGHTTABLE_URL`，或每次带 `--server`。公网仅允许 HTTPS，本机回环允许 HTTP。密码交互输入，不接受命令行明文密码参数。会话按服务器地址分开保存在 `~/.local/share/trpg-cli`，Linux/macOS上目录0700、Cookie文件0600；Windows沿用用户目录ACL，不强行chmod；不会每轮重新登录。

`ready --cancel` 取消就位；`chat` 发桌边消息；`history` 支持 `--before` 分页；`audit` 查询随机复核。`action` 自动读取当前轮号，使用 `--item ID` 和 `--take ID` 申报物品。顺序、超时、提交锁定仍由服务端判断。

提交前会向 stderr 输出 request_id；网络失败时先查 state，必要时以同样正文和 `--request-id` 重试。客户端不会自动重试写请求、不会代行、不会自动结算。

主持人和高级操作可用 `api settlement --body-file settlement.json` 等提交完整 API JSON；权限不变。导出文件默认拒绝覆盖。用户自己的会话和导出不可提交到 Git。

本版是命令式 CLI，暂不提供全屏 TUI 或后台自动决策。独立测试与可选跨仓库集成测试见下节。

## 固定分发边界

仅 `@qippyxiong/trpg-protocol` 使用 npm 独立分发。服务端保持 Python 项目，网页分发静态资源，CLI 保持 Python 包（`python3 -m nighttable_cli` 或安装后的终端命令）。应用仓库里的 package.json 只用于构建期契约依赖与检查，不表示将 Python 应用改成 npm 应用。

源码公开与GitHub Packages包公开是独立设置；安装与CI状态以实际验证为准。


## 独立仓库测试与安装验证

仅clone本仓库即可测试，无需server/web源码，无需npm或GitHub Packages凭据：

    python3 -m pip install '.[test]'
    python3 -m pytest -q -rs

也支持仅用标准库运行测试：

    python3 -m unittest discover -s tests -v

独立套件在本机临时HTTP服务上验证Cookie持久化、服务端地址选择、行动轮号/request_id、错误与不自动重试、重定向拒绝、导出及防覆盖；不导入服务端实现。

跨仓库集成是可选项，只有显式同时配置以下环境变量才启用：

    TRPG_SERVER_DIR=/path/to/trpg-server TRPG_WEB_DIR=/path/to/trpg-web python3 -m pytest -q -rs

路径均指仓库根目录；集成测试还需服务端自己的依赖（含Pillow）。不设置变量时，跨仓库测试明确显示SKIPPED；设置了无效路径则报错，不把配置错误当成通过。缺少相邻目录不会再导致pytest收集失败。

CI从单独checkout构建安装Python包，在Python 3.9/3.12上跑独立测试，并从源码目录之外运行nighttable --help，验证安装包包含protocol.json。可选集成未启用时会分别报告“独立通过”和“集成跳过”，不混成全部通过。

## Windows会话目录和pip临时目录

Windows不会把POSIX的0700/0600当成完整ACL策略。客户端沿用所选目录的Windows ACL，不对现有目录或Cookie文件强制chmod；建议把会话放在自己的用户目录。真正的读写失败仍返回错误，不绕过文件系统权限。

PowerShell预创建目录也受支持：

    $sessionPath = Join-Path $HOME "nighttable-session"
    New-Item -ItemType Directory -Force -Path $sessionPath | Out-Null
    python -m nighttable_cli --session-dir $sessionPath --server https://你的服务地址 login 你的账号

如果pip因临时目录不可写而失败，可只在当前PowerShell会话指定自己可写的位置，不需要管理员权限：

    $env:TEMP = Join-Path $HOME "nighttable-pip-tmp"
    New-Item -ItemType Directory -Force -Path $env:TEMP | Out-Null
    $env:TMP = $env:TEMP
    python -m pip install . --no-cache-dir

这处理的是安装环境，不替代CLI功能验证。源码运行仍可使用；账号密码由服务方私下交付，不放命令行或群聊。

CI增加Windows与Linux的Python3.9/3.12矩阵，并用真实PowerShell创建目录、保存Cookie、再次加载，验证此兼容问题。
