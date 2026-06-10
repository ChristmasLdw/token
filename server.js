/**
 * AI大模型 Token 余量监控后端服务
 * 
 * 部署到腾讯云步骤：
 * 1. 在腾讯云创建轻量应用服务器（Node.js 环境）
 * 2. 上传本文件夹到服务器
 * 3. 运行 npm install 安装依赖
 * 4. 运行 npm start 启动服务
 * 5. 配置防火墙开放对应端口（默认 3000）
 * 
 * 本服务作为代理，接收前端传来的 API Key，
 * 调用各平台官方 API 获取额度信息，返回给前端。
 * 用户的 API Key 不会被存储，仅用于转发请求。
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 启用 CORS，允许前端跨域访问
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// 托管前端静态页面（从 public 目录）
app.use(express.static(path.join(__dirname, 'public')));

/**
 * 健康检查接口
 * 用于确认后端服务正常运行
 */
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * 查询 OpenAI API 额度
 * 
 * OpenAI 提供两个关键接口：
 * 1. /v1/dashboard/billing/subscription - 获取订阅信息（总额度、到期时间等）
 * 2. /v1/dashboard/billing/usage - 获取已使用量
 * 
 * 请求体: { apiKey: "sk-xxx" }
 */
app.post('/api/openai/quota', async (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: '缺少 API Key' });

    try {
        const headers = { 'Authorization': `Bearer ${apiKey}` };

        // 获取订阅信息（总额度）
        const subResp = await axios.get(
            'https://api.openai.com/v1/dashboard/billing/subscription',
            { headers, timeout: 10000 }
        );

        // 获取已使用量（本月）
        const now = new Date();
        const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        const usageResp = await axios.get(
            `https://api.openai.com/v1/dashboard/billing/usage?start_date=${startDate}&end_date=${endDate}`,
            { headers, timeout: 10000 }
        );

        const total = subResp.data.hard_limit_usd * 1000; // 转换为 token 单位
        const used = usageResp.data.total_usage; // 单位：分
        const remaining = total - used;

        res.json({
            success: true,
            platform: 'openai',
            total: Math.round(total),
            used: Math.round(used),
            remaining: Math.round(remaining),
            currency: 'USD',
            accessUntil: subResp.data.access_until
        });
    } catch (error) {
        console.error('OpenAI API Error:', error.message);
        res.status(500).json({
            error: '获取 OpenAI 额度失败',
            detail: error.response?.data?.error?.message || error.message
        });
    }
});

/**
 * 查询 Anthropic Claude API 额度
 * 
 * Anthropic 的 API 目前不直接提供额度查询接口。
 * 我们通过调用 API 并检查响应头来获取信息，
 * 或者返回提示信息引导用户到控制台查看。
 * 
 * 请求体: { apiKey: "sk-ant-xxx" }
 */
app.post('/api/anthropic/quota', async (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: '缺少 API Key' });

    try {
        // Anthropic 目前没有公开的额度查询 API
        // 尝试调用一个简单的 API 来验证 Key 是否有效
        const resp = await axios.get('https://api.anthropic.com/v1/models', {
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            timeout: 10000
        });

        res.json({
            success: true,
            platform: 'anthropic',
            total: 0,
            used: 0,
            remaining: 0,
            note: 'Anthropic 暂不支持 API 查询额度，请前往控制台查看',
            models: resp.data.models?.map(m => m.id) || [],
            consoleUrl: 'https://console.anthropic.com/settings/usage'
        });
    } catch (error) {
        console.error('Anthropic API Error:', error.message);
        res.status(500).json({
            error: 'Anthropic API 验证失败',
            detail: error.response?.data?.error?.message || error.message
        });
    }
});

/**
 * 查询 Google Gemini API 额度
 * 
 * Gemini API 通过 Google Cloud 项目配额管理。
 * 需要项目 ID 和 API Key 才能查询配额。
 * 
 * 请求体: { apiKey: "xxx", projectId: "xxx" }
 */
app.post('/api/gemini/quota', async (req, res) => {
    const { apiKey, projectId } = req.body;
    if (!apiKey) return res.status(400).json({ error: '缺少 API Key' });

    try {
        // Gemini API 配额查询需要 Google Cloud 项目
        // 这里返回提示信息
        res.json({
            success: true,
            platform: 'gemini',
            total: 0,
            used: 0,
            remaining: 0,
            note: 'Gemini 配额需在 Google Cloud Console 查看',
            consoleUrl: 'https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Gemini API 查询失败',
            detail: error.message
        });
    }
});

/**
 * 查询阿里云百炼 (DashScope) API 额度
 * 
 * 阿里云 DashScope 提供额度查询接口。
 * 
 * 请求体: { apiKey: "sk-xxx" }
 */
app.post('/api/aliyun/quota', async (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: '缺少 API Key' });

    try {
        // 阿里云 DashScope 的额度查询
        const resp = await axios.get('https://dashscope.aliyuncs.com/api/v1/billing/quota', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        res.json({
            success: true,
            platform: 'aliyun',
            total: resp.data.total_quota || 0,
            used: resp.data.used_quota || 0,
            remaining: (resp.data.total_quota || 0) - (resp.data.used_quota || 0),
            currency: 'CNY'
        });
    } catch (error) {
        console.error('阿里云 API Error:', error.message);
        // 阿里云可能不支持直接 API 查询，返回提示
        res.json({
            success: true,
            platform: 'aliyun',
            total: 0,
            used: 0,
            remaining: 0,
            note: '阿里云百炼额度请前往控制台查看',
            consoleUrl: 'https://dashscope.aliyun.com/billing'
        });
    }
});

/**
 * 查询百度千帆 API 额度
 * 
 * 请求体: { apiKey: "xxx", secretKey: "xxx" }
 */
app.post('/api/baidu/quota', async (req, res) => {
    const { apiKey, secretKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: '缺少 API Key' });

    try {
        // 百度千帆需要 access_token，先获取
        const tokenResp = await axios.post(
            `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`,
            {},
            { timeout: 10000 }
        );

        const accessToken = tokenResp.data.access_token;

        // 查询额度
        const quotaResp = await axios.post(
            `https://qianfan.baidubce.com/v2/quota?access_token=${accessToken}`,
            {},
            { timeout: 10000 }
        );

        res.json({
            success: true,
            platform: 'baidu',
            total: quotaResp.data.total || 0,
            used: quotaResp.data.used || 0,
            remaining: (quotaResp.data.total || 0) - (quotaResp.data.used || 0),
            currency: 'CNY'
        });
    } catch (error) {
        console.error('百度 API Error:', error.message);
        res.json({
            success: true,
            platform: 'baidu',
            total: 0,
            used: 0,
            remaining: 0,
            note: '百度千帆额度请前往控制台查看',
            consoleUrl: 'https://qianfan.baidu.com/billing'
        });
    }
});

/**
 * 查询智谱AI API 额度
 * 
 * 请求体: { apiKey: "xxx" }
 */
app.post('/api/zhipu/quota', async (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: '缺少 API Key' });

    try {
        const resp = await axios.get('https://open.bigmodel.cn/api/paas/v4/user/quota', {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            },
            timeout: 10000
        });

        res.json({
            success: true,
            platform: 'zhipu',
            total: resp.data.total || 0,
            used: resp.data.used || 0,
            remaining: (resp.data.total || 0) - (resp.data.used || 0),
            currency: 'CNY'
        });
    } catch (error) {
        console.error('智谱 API Error:', error.message);
        res.json({
            success: true,
            platform: 'zhipu',
            total: 0,
            used: 0,
            remaining: 0,
            note: '智谱AI额度请前往控制台查看',
            consoleUrl: 'https://open.bigmodel.cn/usercenter/quota'
        });
    }
});

/**
 * 查询 DeepSeek API 额度
 * 
 * 请求体: { apiKey: "sk-xxx" }
 */
app.post('/api/deepseek/quota', async (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: '缺少 API Key' });

    try {
        /**
         * DeepSeek 查询余额接口
         * GET /user/balance
         * 响应格式: { is_available: boolean, balance_infos: [{ currency, total_balance, granted_balance, topped_up_balance }] }
         */
        const resp = await axios.get('https://api.deepseek.com/user/balance', {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            },
            timeout: 10000
        });

        const balanceInfo = resp.data.balance_infos?.[0];
        // total_balance 是字符串如 "110.00"，表示可用余额（含赠金和充值）
        const total = balanceInfo ? parseFloat(balanceInfo.total_balance || '0') : 0;
        const currency = balanceInfo?.currency || 'CNY';
        const isAvailable = resp.data.is_available || false;

        res.json({
            success: true,
            platform: 'deepseek',
            total: total,
            used: 0,
            remaining: total,
            isAvailable: isAvailable,
            currency: currency,
            note: 'DeepSeek 显示的是账户余额（元），非 Token 额度'
        });
    } catch (error) {
        console.error('DeepSeek API Error:', error.message);
        // API 调用失败时返回具体的错误信息
        const errorDetail = error.response?.data?.error?.message || error.message;
        res.json({
            success: false,
            platform: 'deepseek',
            total: 0,
            used: 0,
            remaining: 0,
            error: 'API 请求失败: ' + errorDetail,
            note: '请验证 API Key 是否正确，或前往控制台查看',
            consoleUrl: 'https://platform.deepseek.com/usage'
        });
    }
});

/**
 * 查询 SiliconFlow API 额度
 * 
 * 请求体: { apiKey: "sk-xxx" }
 */
app.post('/api/silicon/quota', async (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: '缺少 API Key' });

    try {
        const resp = await axios.get('https://api.siliconflow.cn/v1/user/info', {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            },
            timeout: 10000
        });

        res.json({
            success: true,
            platform: 'silicon',
            total: resp.data.data?.totalBalance || 0,
            used: resp.data.data?.totalUsage || 0,
            remaining: (resp.data.data?.totalBalance || 0) - (resp.data.data?.totalUsage || 0),
            currency: 'CNY'
        });
    } catch (error) {
        console.error('SiliconFlow API Error:', error.message);
        res.json({
            success: true,
            platform: 'silicon',
            total: 0,
            used: 0,
            remaining: 0,
            note: 'SiliconFlow 额度请前往控制台查看',
            consoleUrl: 'https://cloud.siliconflow.cn/account/usage'
        });
    }
});

/**
 * 查询月之暗面 (Kimi) API 额度
 * 
 * 请求体: { apiKey: "sk-xxx" }
 */
app.post('/api/moonshot/quota', async (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: '缺少 API Key' });

    try {
        // 月之暗面目前没有公开的额度查询 API
        res.json({
            success: true,
            platform: 'moonshot',
            total: 0,
            used: 0,
            remaining: 0,
            note: '月之暗面额度请前往控制台查看',
            consoleUrl: 'https://platform.moonshot.cn/console/account'
        });
    } catch (error) {
        res.status(500).json({ error: '查询失败', detail: error.message });
    }
});

/**
 * 查询小米 (MiLM) API 额度
 * 
 * 请求体: { apiKey: "xxx" }
 */
app.post('/api/xiaomi/quota', async (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: '缺少 API Key' });

    try {
        res.json({
            success: true,
            platform: 'xiaomi',
            total: 0,
            used: 0,
            remaining: 0,
            note: '小米 MiLM 目前主要通过设备端使用，API 额度请前往控制台查看',
            consoleUrl: 'https://ai.mi.com/'
        });
    } catch (error) {
        res.status(500).json({ error: '查询失败', detail: error.message });
    }
});

/**
 * 查询字节跳动 (豆包) API 额度
 * 
 * 请求体: { apiKey: "xxx" }
 */
app.post('/api/bytedance/quota', async (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: '缺少 API Key' });

    try {
        // 字节跳动火山引擎的额度查询
        res.json({
            success: true,
            platform: 'bytedance',
            total: 0,
            used: 0,
            remaining: 0,
            note: '豆包大模型额度请前往火山引擎控制台查看',
            consoleUrl: 'https://console.volcengine.com/ark'
        });
    } catch (error) {
        res.status(500).json({ error: '查询失败', detail: error.message });
    }
});

/**
 * 批量查询所有平台的额度
 * 
 * 请求体: { platforms: [{ type: 'openai', apiKey: 'xxx' }, ...] }
 */
app.post('/api/batch/quota', async (req, res) => {
    const { platforms } = req.body;
    if (!Array.isArray(platforms)) {
        return res.status(400).json({ error: '请求格式错误，需要 platforms 数组' });
    }

    const results = [];

    for (const platform of platforms) {
        const { type, apiKey, secretKey } = platform;
        if (!apiKey) continue;

        try {
            let endpoint = '';
            const body = { apiKey };
            if (secretKey) body.secretKey = secretKey;

            switch (type) {
                case 'openai': endpoint = '/api/openai/quota'; break;
                case 'anthropic': endpoint = '/api/anthropic/quota'; break;
                case 'gemini': endpoint = '/api/gemini/quota'; break;
                case 'aliyun': endpoint = '/api/aliyun/quota'; break;
                case 'baidu': endpoint = '/api/baidu/quota'; break;
                case 'zhipu': endpoint = '/api/zhipu/quota'; break;
                case 'deepseek': endpoint = '/api/deepseek/quota'; break;
                case 'silicon': endpoint = '/api/silicon/quota'; break;
                case 'moonshot': endpoint = '/api/moonshot/quota'; break;
                case 'xiaomi': endpoint = '/api/xiaomi/quota'; break;
                case 'bytedance': endpoint = '/api/bytedance/quota'; break;
                default: continue;
            }

            const result = await axios.post(
                `http://localhost:${PORT}${endpoint}`,
                body,
                { timeout: 15000 }
            );

            results.push({
                type,
                ...result.data
            });
        } catch (error) {
            results.push({
                type,
                success: false,
                error: error.message
            });
        }
    }

    res.json({ success: true, results });
});

// 启动服务
app.listen(PORT, () => {
    console.log(`AI Token 监控后端服务已启动`);
    console.log(`监听端口: ${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/health`);
    console.log(`\n部署到腾讯云后，请将前端页面中的 BACKEND_URL 改为你的服务器地址`);
});
