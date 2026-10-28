// 能力图谱的实测数据接口。这里只存实测评分项，不存派生维度分和排名指数。
// 维度分、综合分与总览雷达共用 radar-scoring.js 按冻结参考计算的稳健标准分。
// 没有成绩的评分项不写进 breakdown；近邻估计与证据不足状态只保存在计算结果中。
//
// dimensions: 雷达轴与表格列，顺序即显示顺序。
//   id           维度标识，需唯一
//   name / en    中文名与英文小标题
//   icon         维度卡片上的编号
//   description  维度说明
//   defaultPriority  通用任务的默认优先级，0 不纳入、1 一般、2 重要、3 核心
//   items        该维度计入的评分项，按 key 对应模型 breakdown 里的字段
//     key        评分项标识，维度内唯一
//     label      评分项名称
//     metric     原始计量口径。breakdown 里的数已经是 0–100
//     source     来源：aa、epoch、livebench、lmarena、design-arena
//     defaultPriority  该评测在所属维度内的默认优先级，取 0–3
// 默认用途侧重编码、复杂推理、长文与工具工作流；分项按任务契合度分配重要性。
// 默认优先级只表达用途，不根据模型缺测或参考成绩数量调整。
//
// models:
//   id、name、detail、creator、color、url
//   intelligenceIndex  AA Intelligence Index。不进入任何分数，只在综合标准分完全相同时决定先后
//   breakdown   { 维度 id: { 评分项 key: 0–100 } }，只记录有成绩的评分项
//
// 人类偏好榜的原始分是 Elo。写入 breakdown 之前换成对冻结参照的期望胜率：
//   100 / (1 + 10^(-(elo - eloRef) / 400))
// eloRef 按评分项单独取值并随快照冻结，不由当前模型名单现算。页面不接受原始 Elo。
//
// 人类偏好榜写入的是期望胜率。参照是抓取时该榜全部上榜模型的 Elo 均值，已冻结，不随这 14 个模型变动：
//   WebDev Arena 1466.3（LMArena webdev/overall，151 个模型，2026-10-27）
//   Design Arena 1170.9（代码总榜 allcategories，189 个模型，2026-10-28）
//   LMArena Multi-Turn 1300.9（text/multi_turn，416 个模型，2026-10-22）
//   Longer Query 1319.9（text/longer_query，396 个模型，2026-10-22）
// 每个模型取该模型在来源榜上的最高档。GPT-6.1 Sol、GPT-6.1 Terra 用 max。
// GDP.pdf 不在专业能力里。
// 科学与算法的三项都来自 AA，是目前唯一的单一来源维度。
window.RADAR_DATA = {
  "version": "eight-dimensions-measured",
  "retrievedAt": "2026-10-27T10:32:59.608116+00:00",
  "dimensions": [
    {
      "id": "knowledge",
      "defaultPriority": 2,
      "name": "知识能力",
      "en": "KNOWLEDGE",
      "icon": "01",
      "description": "掌握事实、科学与医学知识，兼顾回答正确性、幻觉和弃答表现。",
      "items": [
        {
          "key": "omniscience",
          "defaultPriority": 2,
          "short": "AA-Omniscience",
          "label": "AA-Omniscience",
          "metric": "百分制指数",
          "source": "aa"
        },
        {
          "key": "gpqa",
          "defaultPriority": 2,
          "short": "GPQA",
          "label": "GPQA Diamond",
          "metric": "准确率",
          "source": "epoch"
        }
      ]
    },
    {
      "id": "backend",
      "defaultPriority": 3,
      "name": "后端与系统",
      "en": "BACKEND",
      "icon": "02",
      "description": "在终端里完成构建、调试和多步环境操作，并覆盖通用编码辅助。",
      "items": [
        {
          "key": "terminalBench40",
          "defaultPriority": 3,
          "short": "TB 4.0",
          "label": "Terminal-Bench 4.0",
          "metric": "pass@1",
          "source": "aa"
        },
        {
          "key": "livebenchCoding",
          "defaultPriority": 2,
          "short": "LB Coding",
          "label": "LiveBench Coding",
          "metric": "准确率",
          "source": "livebench"
        }
      ]
    },
    {
      "id": "frontend",
      "defaultPriority": 2,
      "name": "前端与界面",
      "en": "FRONTEND",
      "icon": "03",
      "description": "实现可交互的界面与视觉结构。这一维目前只有人类偏好对战。",
      "items": [
        {
          "key": "webdevArena",
          "defaultPriority": 3,
          "short": "WebDev",
          "label": "WebDev Arena",
          "metric": "Elo 期望胜率",
          "source": "lmarena"
        },
        {
          "key": "designArena",
          "defaultPriority": 2,
          "short": "Design",
          "label": "Design Arena",
          "metric": "Elo 期望胜率",
          "source": "design-arena"
        }
      ]
    },
    {
      "id": "science",
      "defaultPriority": 2,
      "name": "科学与算法",
      "en": "SCIENCE",
      "icon": "04",
      "description": "完成科学计算、真实仓库改动和科研工作流里可验证的代码。",
      "items": [
        {
          "key": "scicode",
          "defaultPriority": 3,
          "short": "SciCode",
          "label": "SciCode",
          "metric": "准确率",
          "source": "aa"
        },
        {
          "key": "frontierCode",
          "defaultPriority": 3,
          "short": "FrontierCode",
          "label": "FrontierCode 1.1",
          "metric": "准确率",
          "source": "aa"
        },
        {
          "key": "terminalBenchScience",
          "defaultPriority": 2,
          "short": "TB-Science",
          "label": "Terminal-Bench-Science 0.1",
          "metric": "准确率",
          "source": "aa"
        }
      ]
    },
    {
      "id": "reasoning",
      "defaultPriority": 3,
      "name": "复杂推理与计算",
      "en": "REASONING",
      "icon": "05",
      "description": "解决专家级难题，完成研究级推导、数学证明与科学计算。",
      "items": [
        {
          "key": "frontierMath",
          "defaultPriority": 3,
          "short": "FrontierMath",
          "label": "FrontierMath（T1–3）",
          "metric": "准确率",
          "source": "epoch"
        },
        {
          "key": "critpt",
          "defaultPriority": 3,
          "short": "CritPt",
          "label": "CritPt",
          "metric": "准确率",
          "source": "aa"
        },
        {
          "key": "livebenchReasoning",
          "defaultPriority": 2,
          "short": "LB Reasoning",
          "label": "LiveBench Reasoning",
          "metric": "准确率",
          "source": "livebench"
        }
      ]
    },
    {
      "id": "professional",
      "defaultPriority": 2,
      "name": "专业能力",
      "en": "PROFESSIONAL",
      "icon": "06",
      "description": "把资料转化为合格的专业工作产物，并守住任务约束。",
      "items": [
        {
          "key": "gdpval",
          "defaultPriority": 3,
          "short": "GDPval-AA",
          "label": "GDPval-AA v2.1",
          "metric": "Elo 期望胜率",
          "source": "aa"
        },
        {
          "key": "briefcase",
          "defaultPriority": 3,
          "short": "AA-Briefcase",
          "label": "AA-Briefcase v1.1",
          "metric": "rubric 通过率",
          "source": "aa"
        },
        {
          "key": "arenaMultiTurn",
          "defaultPriority": 1,
          "short": "Multi-Turn",
          "label": "LMArena Multi-Turn",
          "metric": "Elo 期望胜率",
          "source": "lmarena"
        }
      ]
    },
    {
      "id": "context",
      "defaultPriority": 3,
      "name": "长上下文推理",
      "en": "LONG CONTEXT",
      "icon": "07",
      "description": "从长文、病历及专业文档中检索、整合证据并形成结论。",
      "items": [
        {
          "key": "lcr",
          "defaultPriority": 3,
          "short": "AA-LCR",
          "label": "AA-LCR v1.1",
          "metric": "准确率",
          "source": "aa"
        },
        {
          "key": "mlcr",
          "defaultPriority": 3,
          "short": "MLCR-AA",
          "label": "MLCR-AA",
          "metric": "准确率",
          "source": "aa"
        },
        {
          "key": "longerQuery",
          "defaultPriority": 1,
          "short": "Longer Query",
          "label": "Longer Query",
          "metric": "Elo 期望胜率",
          "source": "lmarena"
        }
      ]
    },
    {
      "id": "automation",
      "defaultPriority": 3,
      "name": "工具自动化",
      "en": "AUTOMATION",
      "icon": "08",
      "description": "协调工具执行多步流程，以环境状态与诊断结果检验效果。",
      "items": [
        {
          "key": "automationBench",
          "defaultPriority": 3,
          "short": "AutomationBench",
          "label": "AutomationBench-AA",
          "metric": "任务完成率",
          "source": "aa"
        },
        {
          "key": "livebenchAgentic",
          "defaultPriority": 3,
          "short": "LB Agentic",
          "label": "LiveBench Agentic Tool Use",
          "metric": "准确率",
          "source": "livebench"
        }
      ]
    }
  ],
  "models": [
    {
      "id": "deepseek",
      "intelligenceIndex": 45.1,
      "name": "DeepSeek V4.1 Flash",
      "detail": "1017 · max",
      "creator": "DeepSeek",
      "color": "#059669",
      "url": "https://artificialanalysis.ai/models/deepseek-v4-1-flash-1017",
      "breakdown": {
        "knowledge": {
          "omniscience": 4.7,
          "gpqa": 93.2
        },
        "backend": {
          "terminalBench40": 33.8,
          "livebenchCoding": 96
        },
        "frontend": {
          "webdevArena": 76,
          "designArena": 66.4
        },
        "science": {
          "scicode": 55.9,
          "frontierCode": 43.7,
          "terminalBenchScience": 12.9
        },
        "reasoning": {
          "frontierMath": 71.2,
          "critpt": 24,
          "livebenchReasoning": 89.1
        },
        "professional": {
          "gdpval": 62.6,
          "briefcase": 47.5
        },
        "context": {
          "lcr": 82.7,
          "mlcr": 26.7
        },
        "automation": {
          "automationBench": 66.6,
          "livebenchAgentic": 40.9
        }
      }
    },
    {
      "id": "gpt",
      "intelligenceIndex": 54.5,
      "name": "GPT-6.1 Sol",
      "detail": "max",
      "creator": "OpenAI",
      "color": "#2563eb",
      "url": "https://artificialanalysis.ai/models/gpt-6-1-sol",
      "breakdown": {
        "knowledge": {
          "omniscience": 42,
          "gpqa": 95.4
        },
        "backend": {
          "terminalBench40": 56.1,
          "livebenchCoding": 96
        },
        "frontend": {
          "webdevArena": 83.8,
          "designArena": 74.5
        },
        "science": {
          "scicode": 54.2,
          "frontierCode": 49.1,
          "terminalBenchScience": 58.1
        },
        "reasoning": {
          "frontierMath": 93.7,
          "critpt": 31.7,
          "livebenchReasoning": 92.6
        },
        "professional": {
          "gdpval": 43,
          "briefcase": 55.7,
          "arenaMultiTurn": 69.7
        },
        "context": {
          "lcr": 83,
          "mlcr": 38.3,
          "longerQuery": 69.2
        },
        "automation": {
          "automationBench": 64.9,
          "livebenchAgentic": 68.7
        }
      }
    },
    {
      "id": "terra",
      "intelligenceIndex": 51,
      "name": "GPT-6.1 Terra",
      "detail": "max",
      "creator": "OpenAI",
      "color": "#65a30d",
      "url": "https://artificialanalysis.ai/models/gpt-6-1-terra",
      "breakdown": {
        "knowledge": {
          "omniscience": 29.6,
          "gpqa": 94.3
        },
        "backend": {
          "terminalBench40": 55.6,
          "livebenchCoding": 94.3
        },
        "frontend": {
          "webdevArena": 76.4,
          "designArena": 67.3
        },
        "science": {
          "scicode": 55.1,
          "frontierCode": 36,
          "terminalBenchScience": 57.6
        },
        "reasoning": {
          "frontierMath": 90.9,
          "critpt": 28,
          "livebenchReasoning": 88.7
        },
        "professional": {
          "gdpval": 26.2,
          "briefcase": 42.4
        },
        "context": {
          "lcr": 82.7,
          "mlcr": 30.6
        },
        "automation": {
          "automationBench": 60.2,
          "livebenchAgentic": 48.6
        }
      }
    },
    {
      "id": "grok",
      "intelligenceIndex": 46.4,
      "name": "Grok 4.7",
      "detail": "xhigh",
      "creator": "SpaceXAI",
      "color": "#d97706",
      "url": "https://artificialanalysis.ai/models/grok-4-7",
      "breakdown": {
        "knowledge": {
          "omniscience": 32,
          "gpqa": 92.7
        },
        "backend": {
          "terminalBench40": 25.8,
          "livebenchCoding": 84.5
        },
        "frontend": {
          "webdevArena": 72.8,
          "designArena": 63.9
        },
        "science": {
          "scicode": 57.4,
          "frontierCode": 33.8,
          "terminalBenchScience": 4.8
        },
        "reasoning": {
          "frontierMath": 53,
          "critpt": 17.7,
          "livebenchReasoning": 82.7
        },
        "professional": {
          "gdpval": 59.3,
          "arenaMultiTurn": 63,
          "briefcase": 55.4
        },
        "context": {
          "lcr": 76.7,
          "mlcr": 20,
          "longerQuery": 63.5
        },
        "automation": {
          "automationBench": 65.6,
          "livebenchAgentic": 46.1
        }
      }
    },
    {
      "id": "glm",
      "intelligenceIndex": 44.8,
      "name": "GLM 5.3",
      "detail": "max",
      "creator": "Z AI",
      "color": "#7c3aed",
      "url": "https://artificialanalysis.ai/models/glm-5-3",
      "breakdown": {
        "knowledge": {
          "omniscience": 14.3,
          "gpqa": 90.9
        },
        "backend": {
          "terminalBench40": 41.9
        },
        "frontend": {
          "webdevArena": 71.1
        },
        "science": {
          "scicode": 59,
          "frontierCode": 40.1,
          "terminalBenchScience": 9.5
        },
        "reasoning": {
          "frontierMath": 68.8,
          "critpt": 19.1
        },
        "professional": {
          "gdpval": 50.2,
          "briefcase": 51.3,
          "arenaMultiTurn": 72.6
        },
        "context": {
          "lcr": 79.7,
          "mlcr": 17.2,
          "longerQuery": 71.9
        },
        "automation": {
          "automationBench": 62.2
        }
      }
    },
    {
      "id": "kimi",
      "intelligenceIndex": 55.1,
      "name": "Kimi K3.1 Pro",
      "detail": "单一配置",
      "creator": "Kimi",
      "color": "#db2777",
      "url": "https://artificialanalysis.ai/models/kimi-k3-1-pro",
      "breakdown": {
        "knowledge": {
          "omniscience": 29.5
        },
        "backend": {
          "terminalBench40": 67.2,
          "livebenchCoding": 81.8
        },
        "frontend": {
          "webdevArena": 78.8,
          "designArena": 74
        },
        "science": {
          "scicode": 60.8,
          "frontierCode": 47.1,
          "terminalBenchScience": 34.3
        },
        "reasoning": {
          "critpt": 24.6,
          "livebenchReasoning": 91.1
        },
        "professional": {
          "gdpval": 74.8,
          "briefcase": 50.4
        },
        "context": {
          "lcr": 86.3,
          "mlcr": 38.3
        },
        "automation": {
          "automationBench": 73.3,
          "livebenchAgentic": 39.1
        }
      }
    },
    {
      "id": "opus",
      "intelligenceIndex": 57.6,
      "name": "Claude Opus 5.5",
      "detail": "max · default fallback",
      "creator": "Anthropic",
      "color": "#172b45",
      "url": "https://artificialanalysis.ai/models/claude-opus-5-5",
      "breakdown": {
        "knowledge": {
          "omniscience": 46.4,
          "gpqa": 90.6
        },
        "backend": {
          "terminalBench40": 59.6,
          "livebenchCoding": 96.3
        },
        "frontend": {
          "webdevArena": 87.8,
          "designArena": 77.4
        },
        "science": {
          "scicode": 66.9,
          "frontierCode": 52.2,
          "terminalBenchScience": 59
        },
        "reasoning": {
          "frontierMath": 91.2,
          "critpt": 31.7,
          "livebenchReasoning": 92.2
        },
        "professional": {
          "gdpval": 77,
          "briefcase": 61.2,
          "arenaMultiTurn": 76.3
        },
        "context": {
          "lcr": 84.7,
          "mlcr": 27.8,
          "longerQuery": 77.3
        },
        "automation": {
          "automationBench": 69.5,
          "livebenchAgentic": 72.8
        }
      }
    },
    {
      "id": "qwen",
      "intelligenceIndex": 45.4,
      "name": "Qwen3.8 Max",
      "detail": "0902",
      "creator": "Alibaba",
      "color": "#0891b2",
      "url": "https://artificialanalysis.ai/models/qwen3-8-max",
      "breakdown": {
        "knowledge": {
          "omniscience": 12,
          "gpqa": 92.3
        },
        "backend": {
          "terminalBench40": 38.9,
          "livebenchCoding": 60.3
        },
        "frontend": {
          "webdevArena": 77
        },
        "science": {
          "scicode": 52.1,
          "frontierCode": 43.2,
          "terminalBenchScience": 11.9
        },
        "reasoning": {
          "frontierMath": 65.6,
          "critpt": 17.7,
          "livebenchReasoning": 88.2
        },
        "professional": {
          "gdpval": 52.4,
          "briefcase": 58
        },
        "context": {
          "lcr": 80.3,
          "mlcr": 20
        },
        "automation": {
          "automationBench": 56.2,
          "livebenchAgentic": 29.9
        }
      }
    },
    {
      "id": "astra",
      "intelligenceIndex": 52.7,
      "name": "GPT-6 Astra",
      "detail": "max",
      "creator": "OpenAI",
      "color": "#60a5fa",
      "url": "https://artificialanalysis.ai/models/gpt-6-astra",
      "breakdown": {
        "knowledge": {
          "omniscience": 43.4,
          "gpqa": 95.8
        },
        "backend": {
          "terminalBench40": 59.1,
          "livebenchCoding": 93.7
        },
        "frontend": {
          "webdevArena": 85.4,
          "designArena": 76.2
        },
        "science": {
          "scicode": 56.5,
          "frontierCode": 47,
          "terminalBenchScience": 63.3
        },
        "reasoning": {
          "frontierMath": 93.7,
          "critpt": 31.7,
          "livebenchReasoning": 92.7
        },
        "professional": {
          "gdpval": 39.8,
          "arenaMultiTurn": 70.1,
          "briefcase": 52
        },
        "context": {
          "lcr": 80.7,
          "mlcr": 41.7,
          "longerQuery": 69.4
        },
        "automation": {
          "automationBench": 68.5,
          "livebenchAgentic": 77.5
        }
      }
    },
    {
      "id": "fable",
      "intelligenceIndex": 53.4,
      "name": "Claude Fable 5.1",
      "detail": "max · default fallback",
      "creator": "Anthropic",
      "color": "#831843",
      "url": "https://artificialanalysis.ai/models/claude-fable-5-1",
      "breakdown": {
        "knowledge": {
          "omniscience": 43.5
        },
        "backend": {
          "terminalBench40": 52,
          "livebenchCoding": 97.7
        },
        "frontend": {
          "webdevArena": 83.3,
          "designArena": 71.9
        },
        "science": {
          "scicode": 63.1,
          "frontierCode": 49,
          "terminalBenchScience": 43.3
        },
        "reasoning": {
          "frontierMath": 90.2,
          "critpt": 29.7,
          "livebenchReasoning": 91.7
        },
        "professional": {
          "gdpval": 64.9,
          "arenaMultiTurn": 75.3,
          "briefcase": 61.5
        },
        "context": {
          "lcr": 85.3,
          "mlcr": 15.6,
          "longerQuery": 76.4
        },
        "automation": {
          "automationBench": 59.4,
          "livebenchAgentic": 77.9
        }
      }
    },
    {
      "id": "gemini",
      "intelligenceIndex": 52.6,
      "name": "Gemini 4 Argon",
      "detail": "high",
      "creator": "Google",
      "color": "#b91c1c",
      "url": "https://artificialanalysis.ai/models/gemini-4-argon",
      "breakdown": {
        "knowledge": {
          "omniscience": 42.4,
          "gpqa": 96.4
        },
        "backend": {
          "terminalBench40": 57.1,
          "livebenchCoding": 89.7
        },
        "frontend": {
          "webdevArena": 77.4,
          "designArena": 71.4
        },
        "science": {
          "scicode": 61.8,
          "frontierCode": 43.5,
          "terminalBenchScience": 52.9
        },
        "reasoning": {
          "frontierMath": 86,
          "critpt": 27.1,
          "livebenchReasoning": 95.1
        },
        "professional": {
          "gdpval": 46.4,
          "briefcase": 64.6,
          "arenaMultiTurn": 80.4
        },
        "context": {
          "lcr": 79.7,
          "mlcr": 13.9,
          "longerQuery": 77.8
        },
        "automation": {
          "automationBench": 77.5,
          "livebenchAgentic": 61.2
        }
      }
    },
    {
      "id": "gemini-flash",
      "intelligenceIndex": 40.9,
      "name": "Gemini 3.8 Flash",
      "detail": "high",
      "creator": "Google",
      "color": "#f97316",
      "url": "https://artificialanalysis.ai/models/gemini-3-8-flash",
      "breakdown": {
        "knowledge": {
          "omniscience": 29.6,
          "gpqa": 95.4
        },
        "backend": {
          "terminalBench40": 19.7,
          "livebenchCoding": 82.2
        },
        "frontend": {
          "webdevArena": 66.3,
          "designArena": 68
        },
        "science": {
          "scicode": 56.6,
          "frontierCode": 36.4,
          "terminalBenchScience": 10
        },
        "reasoning": {
          "frontierMath": 68.4,
          "critpt": 18.3,
          "livebenchReasoning": 89.3
        },
        "professional": {
          "gdpval": 22.9,
          "briefcase": 42.1,
          "arenaMultiTurn": 76.2
        },
        "context": {
          "lcr": 81.3,
          "mlcr": 10.6,
          "longerQuery": 74.6
        },
        "automation": {
          "automationBench": 59.9,
          "livebenchAgentic": 16.5
        }
      }
    },
    {
      "id": "qwen-flash",
      "intelligenceIndex": 39.8,
      "name": "Qwen3.8-Flash-Next",
      "detail": "单一配置",
      "creator": "Alibaba",
      "color": "#14b8a6",
      "url": "https://artificialanalysis.ai/models/qwen3-8-flash-next",
      "breakdown": {
        "knowledge": {
          "omniscience": 0
        },
        "backend": {
          "terminalBench40": 25.3
        },
        "frontend": {
          "webdevArena": 71.7
        },
        "science": {
          "scicode": 50.6
        },
        "reasoning": {
          "critpt": 11.1
        },
        "professional": {
          "gdpval": 47.2,
          "briefcase": 54.1
        },
        "context": {
          "lcr": 79.7,
          "mlcr": 20.6
        },
        "automation": {
          "automationBench": 55.9
        }
      }
    },
    {
      "id": "glm-flash",
      "intelligenceIndex": 41.8,
      "name": "GLM-5.3-Flash",
      "detail": "单一配置",
      "creator": "Z AI",
      "color": "#a855f7",
      "url": "https://artificialanalysis.ai/models/glm-5-3-flash",
      "breakdown": {
        "knowledge": {
          "omniscience": 7.5,
          "gpqa": 90.2
        },
        "backend": {
          "terminalBench40": 32.8,
          "livebenchCoding": 80.6
        },
        "frontend": {
          "webdevArena": 69.2
        },
        "science": {
          "scicode": 51.6,
          "frontierCode": 41,
          "terminalBenchScience": 4.8
        },
        "reasoning": {
          "frontierMath": 55.8,
          "critpt": 15.4,
          "livebenchReasoning": 77.6
        },
        "professional": {
          "gdpval": 49.1,
          "briefcase": 46.4,
          "arenaMultiTurn": 72.7
        },
        "context": {
          "lcr": 80,
          "mlcr": 11.7,
          "longerQuery": 71.8
        },
        "automation": {
          "automationBench": 60.4,
          "livebenchAgentic": 19
        }
      }
    }
  ]
};
