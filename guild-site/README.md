# 星尘公会 · 像素风招募站

零依赖 Node.js 实现：访客展示（介绍 / 活动 / 作品 / 条件）+ 申请提交 + 管理端审核。

## 运行

```bash
node server.js        # 或 npm start
```

- 招募页：http://localhost:3000/
- 管理端：http://localhost:3000/admin.html
- 管理密码：首次启动自动生成并打印在控制台，同时保存在 `data/admin-secret.json`；
  可用环境变量覆盖：

```bash
ADMIN_PASSWORD=yourpassword PORT=8080 node server.js
```

## 功能

- **访客端**：公会介绍、活动时间、成员作品、加入条件、提交申请（角色名 / 常玩职业 / 在线时段 / 自我介绍）、申请进度查询
- **管理端**：密码登录（2 小时滑动令牌）、按状态筛选、通过 / 拒绝 / 改判、审核备注（申请人可见）
- **可靠性**：服务端校验、同名未拒绝申请拦截、提交与登录限流、原子化 JSON 持久化、输出转义防 XSS、安全响应头

## 数据

`data/applications.json` 存储全部申请；首次启动会写入 4 条示例数据便于体验审核流程，删除该文件即可重置。
