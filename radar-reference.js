// 冻结的排名参考样本。scores 的顺序与 models 一致，null 表示该参考模型未实测。
// 参考样本与展示数据分别维护；搜索、筛选、增加展示模型不会重算这份参考。
// 每项均值与总体标准差由这里的固定样本计算；遮挡验证排除被验证模型，评测口径变化时需提供新的基准版本。
window.RADAR_REFERENCE = {
  version: "model-atlas-reference-2026-10-27-v1",
  sourceVersion: "eight-dimensions-measured",
  retrievedAt: "2026-10-27T10:32:59.608116+00:00",
  models: [
    { id: "deepseek", name: "DeepSeek V4.1 Flash", detail: "1017 · max" },
    { id: "gpt", name: "GPT-6.1 Sol", detail: "max" },
    { id: "terra", name: "GPT-6.1 Terra", detail: "max" },
    { id: "grok", name: "Grok 4.7", detail: "xhigh" },
    { id: "glm", name: "GLM 5.3", detail: "max" },
    { id: "kimi", name: "Kimi K3.1 Pro", detail: "单一配置" },
    { id: "opus", name: "Claude Opus 5.5", detail: "max · default fallback" },
    { id: "qwen", name: "Qwen3.8 Max", detail: "0902" },
    { id: "astra", name: "GPT-6 Astra", detail: "max" },
    { id: "fable", name: "Claude Fable 5.1", detail: "max · default fallback" },
    { id: "gemini", name: "Gemini 4 Argon", detail: "high" },
    { id: "gemini-flash", name: "Gemini 3.8 Flash", detail: "high" },
    { id: "qwen-flash", name: "Qwen3.8-Flash-Next", detail: "单一配置" },
    { id: "glm-flash", name: "GLM-5.3-Flash", detail: "单一配置" }
  ],
  items: [
    {
      dimensionId: "knowledge", key: "omniscience", label: "AA-Omniscience", metric: "百分制指数", source: "aa",
      scores: [4.7, 42, 29.6, 32, 14.3, 29.5, 46.4, 12, 43.4, 43.5, 42.4, 29.6, 0, 7.5]
    },
    {
      dimensionId: "knowledge", key: "gpqa", label: "GPQA Diamond", metric: "准确率", source: "epoch",
      scores: [93.2, 95.4, 94.3, 92.7, 90.9, null, 90.6, 92.3, 95.8, null, 96.4, 95.4, null, 90.2]
    },
    {
      dimensionId: "backend", key: "terminalBench40", label: "Terminal-Bench 4.0", metric: "pass@1", source: "aa",
      scores: [33.8, 56.1, 55.6, 25.8, 41.9, 67.2, 59.6, 38.9, 59.1, 52, 57.1, 19.7, 25.3, 32.8]
    },
    {
      dimensionId: "backend", key: "livebenchCoding", label: "LiveBench Coding", metric: "准确率", source: "livebench",
      scores: [96, 96, 94.3, 84.5, null, 81.8, 96.3, 60.3, 93.7, 97.7, 89.7, 82.2, null, 80.6]
    },
    {
      dimensionId: "frontend", key: "webdevArena", label: "WebDev Arena", metric: "Elo 期望胜率", source: "lmarena",
      scores: [76, 83.8, 76.4, 72.8, 71.1, 78.8, 87.8, 77, 85.4, 83.3, 77.4, 66.3, 71.7, 69.2]
    },
    {
      dimensionId: "frontend", key: "designArena", label: "Design Arena", metric: "Elo 期望胜率", source: "design-arena",
      scores: [66.4, 74.5, 67.3, 63.9, null, 74, 77.4, null, 76.2, 71.9, 71.4, 68, null, null]
    },
    {
      dimensionId: "science", key: "scicode", label: "SciCode", metric: "准确率", source: "aa",
      scores: [55.9, 54.2, 55.1, 57.4, 59, 60.8, 66.9, 52.1, 56.5, 63.1, 61.8, 56.6, 50.6, 51.6]
    },
    {
      dimensionId: "science", key: "frontierCode", label: "FrontierCode 1.1", metric: "准确率", source: "aa",
      scores: [43.7, 49.1, 36, 33.8, 40.1, 47.1, 52.2, 43.2, 47, 49, 43.5, 36.4, null, 41]
    },
    {
      dimensionId: "science", key: "terminalBenchScience", label: "Terminal-Bench-Science 0.1", metric: "准确率", source: "aa",
      scores: [12.9, 58.1, 57.6, 4.8, 9.5, 34.3, 59, 11.9, 63.3, 43.3, 52.9, 10, null, 4.8]
    },
    {
      dimensionId: "reasoning", key: "frontierMath", label: "FrontierMath（T1–3）", metric: "准确率", source: "epoch",
      scores: [71.2, 93.7, 90.9, 53, 68.8, null, 91.2, 65.6, 93.7, 90.2, 86, 68.4, null, 55.8]
    },
    {
      dimensionId: "reasoning", key: "critpt", label: "CritPt", metric: "准确率", source: "aa",
      scores: [24, 31.7, 28, 17.7, 19.1, 24.6, 31.7, 17.7, 31.7, 29.7, 27.1, 18.3, 11.1, 15.4]
    },
    {
      dimensionId: "reasoning", key: "livebenchReasoning", label: "LiveBench Reasoning", metric: "准确率", source: "livebench",
      scores: [89.1, 92.6, 88.7, 82.7, null, 91.1, 92.2, 88.2, 92.7, 91.7, 95.1, 89.3, null, 77.6]
    },
    {
      dimensionId: "professional", key: "gdpval", label: "GDPval-AA v2.1", metric: "Elo 期望胜率", source: "aa",
      scores: [62.6, 43, 26.2, 59.3, 50.2, 74.8, 77, 52.4, 39.8, 64.9, 46.4, 22.9, 47.2, 49.1]
    },
    {
      dimensionId: "professional", key: "briefcase", label: "AA-Briefcase v1.1", metric: "rubric 通过率", source: "aa",
      scores: [47.5, 55.7, 42.4, 55.4, 51.3, 50.4, 61.2, 58, 52, 61.5, 64.6, 42.1, 54.1, 46.4]
    },
    {
      dimensionId: "professional", key: "arenaMultiTurn", label: "LMArena Multi-Turn", metric: "Elo 期望胜率", source: "lmarena",
      scores: [null, 69.7, null, 63, 72.6, null, 76.3, null, 70.1, 75.3, 80.4, 76.2, null, 72.7]
    },
    {
      dimensionId: "context", key: "lcr", label: "AA-LCR v1.1", metric: "准确率", source: "aa",
      scores: [82.7, 83, 82.7, 76.7, 79.7, 86.3, 84.7, 80.3, 80.7, 85.3, 79.7, 81.3, 79.7, 80]
    },
    {
      dimensionId: "context", key: "mlcr", label: "MLCR-AA", metric: "准确率", source: "aa",
      scores: [26.7, 38.3, 30.6, 20, 17.2, 38.3, 27.8, 20, 41.7, 15.6, 13.9, 10.6, 20.6, 11.7]
    },
    {
      dimensionId: "context", key: "longerQuery", label: "Longer Query", metric: "Elo 期望胜率", source: "lmarena",
      scores: [null, 69.2, null, 63.5, 71.9, null, 77.3, null, 69.4, 76.4, 77.8, 74.6, null, 71.8]
    },
    {
      dimensionId: "automation", key: "automationBench", label: "AutomationBench-AA", metric: "任务完成率", source: "aa",
      scores: [66.6, 64.9, 60.2, 65.6, 62.2, 73.3, 69.5, 56.2, 68.5, 59.4, 77.5, 59.9, 55.9, 60.4]
    },
    {
      dimensionId: "automation", key: "livebenchAgentic", label: "LiveBench Agentic Tool Use", metric: "准确率", source: "livebench",
      scores: [40.9, 68.7, 48.6, 46.1, null, 39.1, 72.8, 29.9, 77.5, 77.9, 61.2, 16.5, null, 19]
    }
  ]
};
