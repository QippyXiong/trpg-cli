# HTTP API 契约（拆分初版）

三端共享同一服务端。JSON POST、Cookie 会话；浏览器保持同源。未认证 state 只返回登录页公开配置。401需登录、403无权限或角色死亡、409顺序/轮次/重复操作冲突、400参数错误。所有写请求需要 Content-Type: application/json。

| 功能 | 路由与主要参数 |
| --- | --- |
| 登录/登出 | POST /api/login {username,password}；POST /api/logout {} |
| 大厅/状态 | GET /api/games；GET /api/state?game_id=N |
| 角色/加入/就位 | POST /api/role/select {game_id,role_id}；/api/game/join {game_id}；/api/game/ready {game_id,ready} |
| 行动 | POST /api/message {game_id,round_no,kind:"action",text,check_id,item_ids:[],take_item_ids:[],request_id} |
| 闲聊 | POST /api/message {game_id,kind:"chat",text,request_id} |
| 历史/归档 | GET /api/history?game_id=N&before=ID；/api/export?game_id=N&format=md或jsonl |
| 审计 | GET /api/random/audit?game_id=N |
| 主持人 | POST /api/settlement、/api/round/next、/api/player/state、/api/final；具体格式与验证在服务端 gameplay.py 及其测试 |

`flow.adventure.initiative.current`、slots、deadline 和 complete 是顺序权威；请勿从旧聊天推测轮次。提交锁定由服务端执行，相同 request_id 重试返回 duplicate，不得换编号绕过。私密内容由服务端按请求者身份裁剪，客户端不缓存其他账号的数据。

物品申报不表示效果已生效，主持人确认实际状态变更。服务端是规则、权限与数据唯一权威，两个客户端不各自复制骰子或伤害逻辑。
