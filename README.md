# NightTable CLI

夜航终端客户端，Python 3.9+，运行时零第三方依赖。通过 HTTP API 连接 trpg-server，不接触数据库或复制结算规则。


## 开源使用与依赖

本项目MIT开源。公开clone后可直接运行Python CLI，运行不需要Node或GitHub Packages凭据；协议JSON包含在源码和Python安装包里。实际服务端地址与账号由运行者提供。

协议包正在从GitHub Packages迁移至npm官方registry。**npmjs版本尚未发布，当前锁文件仍是已验证的GitHub Packages来源**；不要把源码公开等同于无需认证的registry安装完成。待npmjs发布后，将消费端scope映射、锁文件及CI一起切换并做匿名冷安装。

发布前需要更新协议的开发者，可用本README末尾的公开Release压缩包临时安装；Python运行本身不需要这一步。


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

本仓库声明 `@qippyxiong/trpg-protocol: 0.1.1`，正式安装不依赖相邻目录。包已发布到GitHub Packages并完成真实冷安装验证，CI跨仓库授权仍待完成。更新协议时执行 `npm install --ignore-scripts`、`npm run protocol:sync`、`npm run protocol:check` 并提交安装锁文件。Python运行无需Node。详见 [协议说明](docs/API.md)。

## 固定分发边界

仅 `@qippyxiong/trpg-protocol` 使用 npm 独立分发。服务端保持 Python 项目，网页分发静态资源，CLI 保持 Python 包（`python3 -m nighttable_cli` 或安装后的终端命令）。应用仓库里的 package.json 只用于构建期契约依赖与检查，不表示将 Python 应用改成 npm 应用。

源码公开与GitHub Packages包公开是独立设置；安装与CI状态以实际验证为准。

## 无Token获取npm契约包

公开Release提供与registry相同的MIT包，不需要GitHub登录：

```sh
npm install --save-exact https://github.com/QippyXiong/trpg-protocol/releases/download/v0.1.1/qippyxiong-trpg-protocol-0.1.1.tgz
npm run protocol:sync
```

这只是无需认证的开发安装方式；Python CLI运行本身不需要安装npm包。正式依赖仍保持0.1.1版本号，GitHub Packages安装仍遵循其认证规则。
