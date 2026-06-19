---
title: "我让 AI 帮我盯 A 股——LearyClaw 接入指南"
date: 2026-06-13
draft: false
---

没有 K8s，没有 Docker Compose，没有编排框架。一个 `workspace/` 目录 + 四个 Python 脚本 + Agent 框架的 tools routing，就能让 AI 替你盯盘、出评、推卡片。

## 架构

```text
用户（飞书消息）← → OpenClaw Gateway
                         │
            （toolsLayer 路由）
                │
      ┌─────────┼─────────┐
      ▼         ▼         ▼
 Tushare Pro  腾讯行情  Python 脚本库
      │         │
      └────┬────┘
           ▼
     飞书消息卡片（Schema 2.0）
```

## 文件布局

```text
workspace/
├── scripts/
│   ├── morning_report.py      # 早评（隔夜外盘 + 昨日复盘 + 板块判断 + 潜力票池 + 持仓要点）
│   ├── midday_report.py       # 午评（上午实盘验证 + 午后策略微调）
│   ├── evening_report.py      # 收评（大盘诊断 + 涨跌停情绪 + 龙虎榜资金扫描 + 次日策略池）
│   └── auction_watcher.py     # 竞价盯盘（9:15/9:20/9:25 三轮循环，异常票自动高亮）
├── memory/
│   ├── holdings.md            # 实时持仓记录（我口述买卖，LearyClaw 自动写入）
│   └── lessons.md             # 踩坑日志，供 Agent 事后调参
├── skills/
│   └── a-stock-advisor/       # A 股投顾技能包（唯一启用的 skill）
│       └── SKILL.md           # 报告框架 + 思维模型 + 过滤规则集 + 输出协议
├── SOUL.md                    # 身份映射
├── IDENTITY.md                # 人设 + 输出风格约定
├── TOOLS.md                   # 工具注册簿（每条 API 的调用方式、认证方式、典型 query）
└── HEARTBEAT.md               # 心跳循环，控制 LearyClaw 主动找我还是等我开口
```

## 数据平台

| 平台 | 用途 | 成本 |
|---|---|---|
| **Tushare Pro** | 大盘行情、个股日线、涨跌停统计、龙虎榜 | 2000 积分 / 约 200 元 |
| **腾讯行情 API** `qt.gtimg.cn` | 实时盘口、竞价阶段快照 | 零成本，无认证，纯 `urllib.request` |

Tushare 拿盘后数据和历史趋势，腾讯 API 拿实时快照。没有中间缓存层——单用户场景不需要。

## Skill 层做了什么

`a-stock-advisor/SKILL.md` 规定了三件事：

### 1. 分析模型

- **龙虎榜过滤：** 主力净买 > 3000 万 AND 涨停 AND 占比 < 60% → 资金驱动型标的
- **竞价判断：** 高开 3–5% + 量比 > 1.5 → 强势延续；高开 > 7% + 量比 < 0.8 → 冲高回落预警
- **情绪面：** 涨停/跌停比 > 3 → 高温区；< 0.5 → 冰点期

### 2. 票池推荐管线

龙虎榜延伸 → 机构+北向双买 → 事件催化 → 连板高标延伸 → 持仓替代，按优先级串联。

### 3. 输出协议

Schema 2.0 消息卡片，Markdown 表格直出，不走 `message.presentation`（那个字段已废弃）。

## 工作流

| 时间 | 脚本 | 说明 |
|---|---|---|
| 09:15 | `auction_watcher.py --stage 1` | 集合竞价开始，扫描持仓异常 |
| 09:20 | `auction_watcher.py --stage 2` | 撤单期前，量价突变跟踪 |
| 09:25 | `auction_watcher.py --stage 3` | 开盘价确定，给出当日策略基调 |
| 08:30 | `morning_report.py` | 早评（外盘 + 板块 + 票池） |
| 12:00 | `midday_report.py` | 午评（上午实盘校验） |
| 16:00 | `evening_report.py` | 收评（盘后诊断 + 龙虎榜清洗） |

全部触发走 Agent 自带的 cron + heartbeat，不需要外部 scheduler。

## 持仓同步

我在飞书说「买了 XXX」或「清了 XXX」→ LearyClaw 写进 `memory/holdings.md` → 四个脚本启动时自动读这个文件，分析自动对齐最新持仓。

负成本 T 仓（做 T 摊到成本为负的票）在脚本里挂零成本做特殊处理。

## 效果

- 竞价盯盘三轮循环，异常票自动用 🔴🟢 高亮，注意力集中在真正需要决策的票上
- 早午收评自动推送飞书卡片，每天少花 20–30 分钟手工复盘
- 龙虎榜票池过滤规整，不会出现庄股和微盘垃圾

## 坑

- **腾讯行情竞价段偶尔拉空** — 集合竞价阶段个股数据响应不稳定。踩坑记录全在 `lessons.md` 里
- **不要依赖 AI 的「判断」** — 板块推荐和票池只是参考。最终决策自己拍板
- **持仓要勤更新** — 忘了说买卖 AI 就按旧仓出报告。规矩是清仓加仓 30 秒内必须告诉 AI

## 后续方向

- **Level-2 行情接入** — 换通达信/同花顺逐笔委托接口，竞价阶段资金流向判断更精确
- **飞书台账双向同步** — 让飞书多维表格作为 source of truth，LearyClaw 定期拉 diff 自动更新持仓，消除人力输入误差
- **回测验证** — 现有过滤规则全是启发式的。用 backtrader/zipline 跑一遍历史数据，低胜率规则直接删
- **多 Agent 分工** — 目前单 Agent 包办所有。拆成数据采集 / 分析 / 报告生成三个 Agent，各自选更适合的模型
- **情绪因子集成** — 接入财联社快讯做 NER + 情感打分，把纯技术面拉成基本面+情绪面混合判断
- **止损自动弹窗** — 持仓脚本埋监控 loop，盘中单票跌幅超预设止损线，主动飞书弹 alert 卡片到脸上
