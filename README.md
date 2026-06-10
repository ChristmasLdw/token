# Token 监控工具

AI 大模型 Token 余量监控系统，实时监控多个 AI 平台的 API 额度使用情况。

## 📋 功能特性

- ✅ 支持 10+ 主流 AI 平台额度查询
  - OpenAI
  - Anthropic Claude
  - Google Gemini
  - DeepSeek
  - 阿里云百炼
  - 百度千帆
  - 智谱 AI
  - SiliconFlow
  - 月之暗面 (Kimi)
  - 小米 MiLM
  - 字节跳动豆包

- 📊 实时数据展示
  - 总额度、已使用、剩余额度统计
  - 各平台独立卡片展示
  - 使用率进度条可视化
  - Chart.js 图表支持

- 🚀 快捷操作
  - 一键添加平台
  - 批量刷新所有平台数据
  - 快速购买/充值入口
  - 价格对比表格

- 🎨 现代化 UI
  - Tailwind CSS 响应式设计
  - FontAwesome 7 图标库
  - 流畅的卡片动画效果
  - 移动端适配

## 🛠️ 技术栈

**后端**
- Node.js + Express
- Axios (API 请求)
- CORS (跨域支持)
- dotenv (环境变量)

**前端**
- Tailwind CSS (样式框架)
- Chart.js (图表)
- FontAwesome 7 (图标)
- 原生 JavaScript

## 📦 安装部署

### 1. 克隆仓库

```bash
git clone https://github.com/ChristmasLdw/token.git
cd token
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

创建 `.env` 文件：

```bash
PORT=3002
```

### 4. 启动服务

```bash
# 开发环境
npm start

# 生产环境 (PM2)
pm2 start server.js --name token
```

### 5. 访问服务

打开浏览器访问：`http://localhost:3002`

## 🚀 使用指南

### 添加平台

1. 点击右上角「添加平台」按钮
2. 在快捷添加面板中点击对应平台卡片
3. 输入该平台的 API Key
4. 点击「添加」按钮

### 查看额度

- 每个平台卡片会显示：
  - 总额度 (Total)
  - 已使用 (Used)
  - 剩余额度 (Remaining)
  - 使用率进度条

### 刷新数据

- 点击右上角「刷新全部」按钮批量刷新所有平台
- 或在每个平台卡片上点击「刷新」按钮单独刷新

### 价格对比

向下滚动可查看「价格查询与对比」表格，了解各平台的定价信息。

## 🔧 API 接口

### 健康检查

```
GET /health
```

### 查询单个平台额度

```
POST /api/{platform}/quota

Body:
{
  "apiKey": "your-api-key"
}
```

支持的平台：`openai`, `anthropic`, `gemini`, `deepseek`, `aliyun`, `baidu`, `zhipu`, `silicon`, `moonshot`, `xiaomi`, `bytedance`

### 批量查询额度

```
POST /api/batch/quota

Body:
{
  "platforms": [
    { "type": "openai", "apiKey": "sk-xxx" },
    { "type": "deepseek", "apiKey": "sk-xxx" }
  ]
}
```

## 📝 修改指南

### 添加新的 AI 平台

1. **后端 (server.js)**：添加新的路由处理器

```javascript
app.post('/api/newplatform/quota', async (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: '缺少 API Key' });

    try {
        // 调用该平台的 API
        const resp = await axios.get('https://api.newplatform.com/quota', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        res.json({
            success: true,
            platform: 'newplatform',
            total: resp.data.total,
            used: resp.data.used,
            remaining: resp.data.total - resp.data.used,
            currency: 'USD'
        });
    } catch (error) {
        res.status(500).json({ error: '查询失败' });
    }
});
```

2. **前端 (index.html)**：在快捷添加数据中添加平台信息

```javascript
const quickAddPlatforms = [
    // ... 其他平台
    { 
        type: 'newplatform', 
        name: 'New Platform', 
        icon: 'fa-robot', 
        color: 'bg-cyan-500' 
    }
];
```

### 修改端口

修改 `.env` 文件：

```bash
PORT=3002  # 改为你想要的端口
```

### 修改样式

前端使用 Tailwind CSS，可直接修改 HTML 中的 class：

```html
<!-- 修改颜色 -->
<div class="bg-blue-600">  <!-- 改为其他颜色，如 bg-green-600 -->

<!-- 修改间距 -->
<div class="p-6">  <!-- 改为 p-4 或 p-8 -->
```

## 🔐 安全说明

- **API Key 不会被存储**：所有 API Key 仅用于转发请求，不会保存到服务器
- **本地存储**：前端使用 localStorage 保存配置（仅存储在浏览器本地）
- **HTTPS 部署**：生产环境建议使用 HTTPS + SSL 证书
- **环境变量**：敏感配置通过 `.env` 文件管理，不要提交到 Git

## 📂 项目结构

```
token/
├── server.js           # 后端服务主文件
├── package.json        # 依赖配置
├── .env               # 环境变量（需手动创建）
├── public/            # 前端静态文件
│   ├── index.html     # 主页面
│   └── logos/         # 平台 Logo
├── node_modules/      # 依赖包
└── README.md          # 本文档
```

## 🌐 线上地址

- **网站地址**: https://christmasldw.com/token/
- **GitHub 仓库**: https://github.com/ChristmasLdw/token

## 📄 License

MIT License

## 👤 作者

ChristmasLdw

---

如有问题或建议，欢迎提交 Issue 或 PR！
