(() => {
  "use strict";

  // 维度、综合、雷达与排序共用评分引擎；只有分项图直接展示原始实测。
  // 缺项使用经遮挡验证的同维近邻估计，证据不足时明确标记并按参考平均水平参与。
  // 实测、估计、证据不足分别展示；AA 智力指数仅用于标准分相同时的排列。
  const namespace = "http://www.w3.org/2000/svg";
  const $ = id => document.getElementById(id);
  const data = window.RADAR_DATA;
  const EPSILON = 1e-9;

  function fail(message) {
    const box = $("fatal");
    box.hidden = false;
    box.textContent = `数据无法加载：${message}。请检查模型数据、冻结参考与评分配置。`;
    $("view-body").hidden = true;
    throw new Error(message);
  }

  const validSource = value => typeof value === "string" && /^https:\/\/artificialanalysis\.ai\/models\/[a-z0-9-]+$/.test(value);
  const validValue = value => value === null || (Number.isFinite(value) && value >= 0 && value <= 100);
  const validBreakdown = model => {
    if (!model.breakdown || typeof model.breakdown !== "object") return false;
    return Object.values(model.breakdown).every(items => items && typeof items === "object" && Object.values(items).every(validValue));
  };

  if (!data || !Array.isArray(data.models) || !Array.isArray(data.dimensions)) fail("缺少模型或维度数据");
  if (!data.models.length || !data.dimensions.length) fail("模型或维度列表为空");
  if (!/^\d{4}-\d{2}-\d{2}T/.test(data.retrievedAt)) fail("缺少有效的获取时间");

  const SOURCE_LABELS = { aa: "AA", epoch: "Epoch", livebench: "LiveBench", lmarena: "LMArena", "design-arena": "Design Arena" };

  const dimensions = new Map();
  for (const dimension of data.dimensions) {
    if (!dimension.id || dimensions.has(dimension.id) || !dimension.name) fail(`维度定义无效：${dimension.id}`);
    if (!Array.isArray(dimension.items) || !dimension.items.length) fail(`维度 ${dimension.id} 没有评分项`);
    const keys = new Set();
    for (const item of dimension.items) {
      if (!item.key || keys.has(item.key) || !item.label || !item.metric || !SOURCE_LABELS[item.source]) fail(`评分项无效：${dimension.id}.${item && item.key}`);
      keys.add(item.key);
    }
    dimensions.set(dimension.id, dimension);
  }
  const models = new Map();
  for (const model of data.models) {
    if (!model.id || models.has(model.id) || !validSource(model.url) || !/^#[0-9a-f]{6}$/i.test(model.color)) fail(`模型配置无效：${model.id}`);
    if (!validBreakdown(model)) fail(`${model.name} 的 breakdown 数值超出 0–100 或类型无效`);
    for (const [dimensionId, items] of Object.entries(model.breakdown)) {
      const dimension = dimensions.get(dimensionId);
      if (!dimension) fail(`${model.name} 的 breakdown 含未知维度：${dimensionId}`);
      for (const key of Object.keys(items)) {
        if (!dimension.items.some(item => item.key === key)) fail(`${model.name} 的 ${dimensionId}.${key} 不在该维度评分项里`);
      }
    }
    if (!Number.isFinite(model.intelligenceIndex)) fail(`${model.name} 缺少 intelligenceIndex`);
    models.set(model.id, model);
  }

  if (typeof window.createRadarScoring !== "function") fail("缺少排名计算模块");
  const scoring = window.createRadarScoring(data, window.RADAR_REFERENCE, fail);

  const state = {
    view: "overview",
    selected: new Set(["deepseek", "gpt"]),
    scale: "absolute",
    query: "",
    creator: "all",
    completeOnly: false,
    detailId: "gpt",
    priorities: scoring.defaultPriorities()
  };
  let rankingWeights;
  let rankingResults;
  function refreshRanking() {
    rankingWeights = scoring.weightsFor(state.priorities.dimensions, state.priorities.items);
    rankingResults = new Map(data.models.map(model => [model.id, scoring.evaluate(model, rankingWeights)]));
  }
  refreshRanking();
  if (rankingWeights.error) fail(`默认优先级配置无效：${rankingWeights.error}`);
  // 保留默认分配供页面说明使用，手动调整时只更新当前排名权重。
  const defaultWeights = rankingWeights;

  const node = (tag, attributes = {}, text) => {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const svgNode = (tag, attributes = {}, text) => {
    const element = document.createElementNS(namespace, tag);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const number = value => value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const precise = value => value.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 6 });
  const percent = fraction => `${(fraction * 100).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 3 })}%`;
  const sourceLink = (url, text) => node("a", { href: url, target: "_blank", rel: "noopener noreferrer", class: "text-link" }, text);
  const currentDimension = () => dimensions.get(state.view);
  const dimensionResult = (model, dimensionId) => rankingResults.get(model.id)?.dimensions.get(dimensionId) ?? null;
  const valueOf = (model, dimensionId) => dimensionResult(model, dimensionId)?.score ?? null;
  const evidenceSummary = result => `实测 ${percent(result.coverage)} · 估计 ${percent(result.estimatedCoverage)} · 证据不足 ${percent(result.unknownCoverage)}`;
  // 表格只在存在估计或证据不足时给一条提示，完整构成见悬停说明与明细。
  function evidenceNode(result) {
    const gaps = [];
    if (result.estimatedCoverage > EPSILON) gaps.push(`估计 ${percent(result.estimatedCoverage)}`);
    if (result.unknownCoverage > EPSILON) gaps.push(`不足 ${percent(result.unknownCoverage)}`);
    if (!gaps.length) return null;
    return node("span", { class: "score-evidence", title: evidenceSummary(result) }, gaps.join(" · "));
  }
  const filteredModels = () => data.models.filter(model => (state.creator === "all" || model.creator === state.creator) && `${model.name} ${model.detail} ${model.creator}`.toLowerCase().includes(state.query) && (!state.completeOnly || rankingResults.get(model.id)?.coverage >= 1 - EPSILON));

  function coverageBadge(model) {
    const measured = scoring.measuredCount(model);
    return node("span", { class: `coverage${measured === scoring.entries.length ? " full" : ""}`, title: `${measured} / ${scoring.entries.length} 项有原始实测；有效实测覆盖率按本场景权重单独计算` }, `${measured} / ${scoring.entries.length}`);
  }

  function valueCell(model, dimensionId, major = false) {
    const value = valueOf(model, dimensionId);
    const cell = node("td", { class: value === null ? "missing" : major ? "score-cell" : "dimension-score" });
    if (value === null) {
      cell.append(node("span", { class: "missing" }, "—"));
      return cell;
    }
    // 维度列只显示指数，证据构成放在悬停说明与明细中，避免表格堆叠注释。
    cell.append(node("span", { class: major ? "score-value" : "", title: `维度标准分 Z=${precise(dimensionResult(model, dimensionId).z)} · ${evidenceSummary(dimensionResult(model, dimensionId))}` }, number(value)));
    if (major) {
      const track = node("div", { class: "score-track", "aria-hidden": "true" });
      const known = node("span", { class: "known" });
      known.style.width = `${value}%`;
      track.append(known);
      cell.append(track);
    }
    return cell;
  }

  function renderNavigation() {
    const navigation = $("navigation");
    if (navigation.childElementCount === 0) {
      const entries = [{ id: "overview", name: "总览", icon: "◈" }, ...data.dimensions];
      navigation.append(...entries.map(entry => {
        const link = node("a", { href: `#${entry.id}`, class: "nav-item", "data-view": entry.id });
        link.append(node("span", { "aria-hidden": "true" }, entry.icon), document.createTextNode(entry.name));
        return link;
      }));
    }
    navigation.querySelectorAll("a").forEach(link => {
      if (link.dataset.view === state.view) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function renderHeader() {
    const dimension = currentDimension();
    $("breadcrumb").textContent = dimension ? `${dimension.name} · 维度` : "总览";
    $("view-eyebrow").textContent = dimension ? dimension.en : "MODEL ATLAS";
    $("view-title").textContent = dimension ? dimension.name : "模型能力图谱。";
    $("view-description").textContent = dimension
      ? dimension.description
      : `${data.dimensions.length} 个能力维度，${data.models.length} 个模型。维度与综合指数统一使用冻结参考的均值与总体标准差，缺项仅在同维证据与遮挡验证支持时估计。`;
    $("back-link").hidden = !dimension;
    $("model-count").textContent = data.models.length;
    $("dimension-count").textContent = data.dimensions.length;
    const measured = data.models.reduce((sum, model) => sum + scoring.measuredCount(model), 0);
    $("value-count").textContent = `${measured} / ${data.models.length * scoring.entries.length}`;
    $("chart-title").textContent = dimension ? `${dimension.name}分项图` : "能力雷达";
    $("ranking-title").textContent = dimension ? `${dimension.name} · 模型数据` : "模型数据总览";
    const sortMetric = dimension ? `${dimension.name}指数` : "综合排名指数";
    $("table-sort-label").textContent = `${sortMetric}高→低`;
    $("ranking-description").textContent = `按${sortMetric}的完整标准分从高到低排列。维度、综合与总览雷达共用同一计算结果；50 表示参考平均水平。实测、估计与证据不足分别显示，不乘入能力分。`;
    $("table-caption").textContent = `模型综合排名指数、${data.dimensions.length} 个维度指数及实测、估计、证据不足的权重占比，按${sortMetric}从高到低排列`;
  }

  function renderDeck() {
    $("dimension-deck").replaceChildren(...data.dimensions.map(dimension => {
      const card = node("a", { href: `#${dimension.id}`, class: "dimension-card" });
      const top = node("div", { class: "card-top" });
      top.append(node("span", { class: "dim-number" }, dimension.icon), node("span", {}, dimension.name), node("span", { class: "card-arrow", "aria-hidden": "true" }, "↗"));
      const sources = [...new Set(dimension.items.map(item => item.source))];
      const measuredModels = data.models.filter(model => dimension.items.some(item => itemValue(model, dimension.id, item.key) !== null)).length;
      const meta = `${dimension.items.length} 项 · ${sources.length} 个来源${sources.length === 1 ? " · 单一来源" : ""} · ${measuredModels} / ${data.models.length} 个模型有实测`;
      card.append(top, node("p", {}, dimension.description), node("p", { class: "card-meta" }, meta));
      return card;
    }));
  }

  function renderModels() {
    $("selection-count").textContent = `${state.selected.size} / ${data.models.length}`;
    $("model-list").replaceChildren(...filteredModels().map(model => {
      const label = node("label", { class: "model-option" });
      label.style.setProperty("--model-color", model.color);
      const input = node("input", { type: "checkbox", "aria-label": `${model.name} ${model.detail}，在雷达图中显示` });
      input.checked = state.selected.has(model.id);
      input.addEventListener("change", () => {
        if (input.checked) state.selected.add(model.id); else state.selected.delete(model.id);
        $("selection-count").textContent = `${state.selected.size} / ${data.models.length}`;
        renderChart();
      });
      const text = node("span", { class: "model-text" });
      text.append(node("strong", {}, model.name), node("small", {}, `${model.creator} · ${model.detail}`));
      label.append(input, node("span", { class: "model-dot", "aria-hidden": "true" }), text);
      return label;
    }));
  }

  function tooltip(text, x, y) {
    const box = $("tooltip");
    box.hidden = false;
    box.textContent = text;
    const bounds = box.getBoundingClientRect();
    box.style.left = `${Math.min(window.innerWidth - bounds.width - 12, Math.max(12, x + 14))}px`;
    box.style.top = `${Math.max(12, y - bounds.height - 14)}px`;
  }
  function hideTooltip() {
    $("tooltip").hidden = true;
  }

  function itemReading(model, dimension, entry) {
    const result = scoring.itemResult(model, dimension.id, entry.key, rankingWeights);
    const reading = result.value === null ? "原始实测 —" : `原始实测 ${number(result.value)}（${entry.metric}）`;
    const estimate = result.estimatedValue === null ? "" : ` · 近邻估计 ${number(result.estimatedValue)}`;
    return `${entry.label} · ${SOURCE_LABELS[entry.source]} · ${reading}${estimate} · ${result.reason}${result.item.calibrated ? ` · z=${precise(result.z)}` : ""}`;
  }

  function breakdownLines(model, dimension) {
    return dimension.items.map(entry => itemReading(model, dimension, entry));
  }

  function pointTooltip(model, dimension, plotted) {
    const result = dimensionResult(model, dimension.id);
    const lines = [
      `${model.name} · ${model.detail}`,
      `${dimension.name}：${number(plotted)} / 100${state.scale === "relative" ? "（相对刻度）" : "（维度指数）"}`,
      `维度指数 ${number(result.score)} · 标准分 ${precise(result.z)}`,
      evidenceSummary(result)
    ];
    if (state.scale === "relative") lines.push(`该维最高指数：${number(dimensionMaximum(dimension.id))}`);
    lines.push(...breakdownLines(model, dimension));
    return lines.join("\n");
  }

  // 分项图只为全场已有原始实测的项目画轴；总览雷达使用可计算的维度指数。
  function itemMeasuredAnywhere(dimensionId, itemKey) {
    return data.models.some(model => itemValue(model, dimensionId, itemKey) !== null);
  }

  function plottedItems(dimension) {
    return dimension.items.filter(item => itemMeasuredAnywhere(dimension.id, item.key));
  }

  function plottedDimensions() {
    return data.dimensions.filter(dimension => data.models.some(model => valueOf(model, dimension.id) !== null));
  }

  function renderLegend(selectedModels) {
    const dimension = currentDimension();
    $("chart-legend").replaceChildren(...selectedModels.map(model => {
      const button = node("button", { type: "button", class: "legend-item", "aria-label": `移除${model.name}的对比图形` });
      button.style.setProperty("--model-color", model.color);
      button.append(node("span", { class: "dot", "aria-hidden": "true" }), document.createTextNode(model.name));
      const result = dimension ? dimensionResult(model, dimension.id) : rankingResults.get(model.id);
      button.append(node("span", { class: "legend-coverage" }, result ? evidenceSummary(result) : rankingWeights.error ? "评分配置无效" : "本维度未纳入计分"));
      button.append(node("span", { "aria-hidden": "true" }, "×"));
      button.addEventListener("click", () => { state.selected.delete(model.id); renderModels(); renderChart(); });
      return button;
    }));
  }

  function renderOverviewRadar() {
    hideTooltip();
    const svg = $("radar");
    svg.setAttribute("viewBox", "0 0 880 700");
    svg.setAttribute("aria-labelledby", "radar-title radar-description");
    svg.removeAttribute("aria-label");
    $("chart-title").textContent = "能力雷达";
    $("chart-back").hidden = true;
    const axes = plottedDimensions();
    const center = { x: 440, y: 342 };
    const radius = 220;
    const point = (index, value, extra = 0) => {
      const angle = -Math.PI / 2 + index * 2 * Math.PI / axes.length;
      return { x: center.x + Math.cos(angle) * (radius * value / 100 + extra), y: center.y + Math.sin(angle) * (radius * value / 100 + extra) };
    };
    const pointsText = points => points.map(p => `${p.x},${p.y}`).join(" ");
    svg.replaceChildren(
      svgNode("title", { id: "radar-title" }, "能力雷达图"),
      svgNode("desc", { id: "radar-description" }, `${state.scale === "relative" ? "相对模式：每维最高指数记为 100。" : "绝对模式：各轴为按参考均值与标准差标准化后合成的维度指数，50 为参考平均水平。"}估计与证据不足占比见各点说明。共选择 ${state.selected.size} 个模型。`)
    );
    if (!axes.length) {
      const message = rankingWeights.error || "没有可计算的维度指数";
      svg.append(svgNode("text", { x: center.x, y: center.y, "text-anchor": "middle", class: "chart-empty" }, "评分配置无效，无法绘制维度指数"));
      $("chart-note").textContent = message;
      $("chart-legend").replaceChildren();
      return;
    }
    for (const tick of [100, 80, 60, 40, 20]) svg.append(svgNode("polygon", { points: pointsText(axes.map((_, index) => point(index, tick))), fill: tick === 100 ? "#f8faff" : "none", stroke: "#e1e8f2", "stroke-width": 1 }));
    axes.forEach((axis, index) => {
      const outer = point(index, 100);
      svg.append(svgNode("line", { x1: center.x, y1: center.y, x2: outer.x, y2: outer.y, stroke: "#e3eaf3" }));
      const label = point(index, 100, 68);
      const anchor = Math.abs(label.x - center.x) < 5 ? "middle" : label.x > center.x ? "start" : "end";
      const group = svgNode("g", { class: "radar-axis", role: "button", tabindex: 0, "aria-label": `查看${axis.name}维度` });
      group.append(svgNode("text", { x: label.x, y: label.y - 5, "text-anchor": anchor, "font-size": 17, "font-weight": 650, fill: "#3f5777" }, axis.name));
      group.append(svgNode("text", { x: label.x, y: label.y + 18, "text-anchor": anchor, "font-size": 11, fill: "#9cabc0" }, axis.en));
      const open = () => { location.hash = axis.id; };
      group.addEventListener("click", open);
      group.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
      svg.append(group);
    });
    const selectedModels = data.models.filter(model => state.selected.has(model.id));
    for (const model of selectedModels) {
      const styleIndex = data.models.indexOf(model);
      // 绘图与表格共用维度指数，相对模式仅缩放图形刻度。
      const plotted = axes.map(axis => plottedValue(model, axis.id));
      const lineStyle = { stroke: model.color, "stroke-width": 2, "vector-effect": "non-scaling-stroke", "stroke-linejoin": "round" };
      if (plotted.every(value => value !== null)) {
        svg.append(svgNode("polygon", { ...lineStyle, points: pointsText(plotted.map((value, index) => point(index, value))), fill: model.color, "fill-opacity": .035 }));
      } else {
        // 没有可计算指数的轴断开，不虚构落点。
        plotted.forEach((value, index) => {
          const next = (index + 1) % axes.length;
          if (value === null || plotted[next] === null) return;
          const start = point(index, value), end = point(next, plotted[next]);
          svg.append(svgNode("line", { ...lineStyle, x1: start.x, y1: start.y, x2: end.x, y2: end.y }));
        });
      }
      axes.forEach((axis, index) => {
        const value = plotted[index];
        if (value === null) return;
        const text = pointTooltip(model, axis, value);
        const group = svgNode("g", { class: "radar-point", tabindex: 0, "aria-label": text.replaceAll("\n", "，") });
        group.append(svgNode("title", {}, text));
        const position = point(index, value);
        group.append(svgNode("circle", { cx: position.x, cy: position.y, r: 11, fill: "transparent" }));
        if (styleIndex % 3 === 0) group.append(svgNode("circle", { cx: position.x, cy: position.y, r: 4.5, fill: model.color, stroke: model.color, "stroke-width": 1.8 }));
        else if (styleIndex % 3 === 1) group.append(svgNode("rect", { x: position.x - 4, y: position.y - 4, width: 8, height: 8, fill: model.color, stroke: model.color, "stroke-width": 1.8 }));
        else group.append(svgNode("polygon", { points: `${position.x},${position.y-5.5} ${position.x+5},${position.y+4} ${position.x-5},${position.y+4}`, fill: model.color, stroke: model.color, "stroke-width": 1.8 }));
        group.addEventListener("pointerenter", event => tooltip(text, event.clientX, event.clientY));
        group.addEventListener("pointermove", event => tooltip(text, event.clientX, event.clientY));
        group.addEventListener("pointerleave", hideTooltip);
        group.addEventListener("focus", () => { const bounds = group.getBoundingClientRect(); tooltip(text, bounds.x + bounds.width / 2, bounds.y); });
        group.addEventListener("blur", hideTooltip);
        svg.append(group);
      });
    }
    for (const tick of [20, 40, 60, 80, 100]) {
      const at = point(0, tick);
      svg.append(svgNode("rect", { x: at.x + 8, y: at.y - 10, width: 28, height: 17, fill: "#fff", "fill-opacity": .85 }));
      svg.append(svgNode("text", { x: at.x + 12, y: at.y + 2, fill: "#a2b0c4", "font-size": 10 }, String(tick)));
    }
    if (!selectedModels.length) svg.append(svgNode("text", { x: center.x, y: center.y + 15, "text-anchor": "middle", class: "chart-empty" }, "勾选模型，开始对比"));
    $("chart-note").textContent = state.scale === "relative"
      ? `相对刻度：维度指数 ÷ 全部 ${data.models.length} 个模型中的该维最高指数 × 100，只缩放图形。固定参考与评分不受筛选和勾选影响。`
      : `各轴为与表格一致的维度指数，50 表示参考平均水平。缺项经验证后估计，证据不足时按平均水平参与；图例为综合权重占比，各点说明为该维度权重占比。`;
    renderLegend(selectedModels);
  }

  // 分项图的轴是该维度计入的评分项。1 项用条形图，2 项用直角三角形，3 项及以上用雷达。
  const itemMaxima = new Map();

  const itemValue = scoring.measuredValue;

  // 相对模式下每根轴以该项全场最高为 100，基准同样固定取全部模型。
  function itemMaximum(itemKey) {
    if (!itemMaxima.has(itemKey)) {
      let max = 0;
      for (const model of data.models) {
        for (const dimension of data.dimensions) {
          const value = itemValue(model, dimension.id, itemKey);
          if (value !== null && value > max) max = value;
        }
      }
      itemMaxima.set(itemKey, max);
    }
    return itemMaxima.get(itemKey);
  }

  function plottedItem(model, dimensionId, itemKey) {
    const value = itemValue(model, dimensionId, itemKey);
    if (value === null) return null;
    if (state.scale === "absolute") return value;
    const max = itemMaximum(itemKey);
    return max > 0 ? value / max * 100 : null;
  }

  function dimensionRadar(dimension, models) {
    const width = 620, height = 520, centerX = width / 2, centerY = height / 2, radius = 168;
    const axes = dimension.items;
    const angleAt = index => -Math.PI / 2 + index * 2 * Math.PI / axes.length;
    const at = (index, value) => ({
      x: centerX + radius * (value / 100) * Math.cos(angleAt(index)),
      y: centerY + radius * (value / 100) * Math.sin(angleAt(index))
    });
    const svg = svgNode("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": `${dimension.name}分项雷达：${axes.map(item => item.label).join("、")}` });
    for (const tick of [20, 40, 60, 80, 100]) {
      svg.append(svgNode("polygon", {
        points: axes.map((_, index) => { const p = at(index, tick); return `${p.x},${p.y}`; }).join(" "),
        fill: "none", stroke: tick === 100 ? "#dce4f0" : "#eff3f9", "stroke-width": 1
      }));
    }
    axes.forEach((item, index) => {
      const edge = at(index, 100);
      svg.append(svgNode("line", { x1: centerX, y1: centerY, x2: edge.x, y2: edge.y, stroke: "#e8edf5", "stroke-width": 1 }));
      const label = at(index, 124);
      const offset = label.x - centerX;
      const anchor = Math.abs(offset) < 8 ? "middle" : offset > 0 ? "start" : "end";
      svg.append(svgNode("text", { x: label.x, y: label.y + 3, "text-anchor": anchor, "font-size": 12, fill: "#8a99ae" }, item.short));
    });
    for (const model of models) {
      const plotted = axes.map(item => plottedItem(model, dimension.id, item.key));
      const lineStyle = { stroke: model.color, "stroke-width": 1.8, "vector-effect": "non-scaling-stroke", "stroke-linejoin": "round" };
      if (plotted.every(value => value !== null)) {
        svg.append(svgNode("polygon", { ...lineStyle, points: plotted.map((value, index) => { const p = at(index, value); return `${p.x},${p.y}`; }).join(" "), fill: model.color, "fill-opacity": .05 }));
      } else {
        // 缺项同样断开连线，不用 0 或均值补齐。
        plotted.forEach((value, index) => {
          const next = (index + 1) % axes.length;
          if (value === null || plotted[next] === null) return;
          const start = at(index, value), end = at(next, plotted[next]);
          svg.append(svgNode("line", { ...lineStyle, x1: start.x, y1: start.y, x2: end.x, y2: end.y }));
        });
      }
      axes.forEach((item, index) => {
        const value = plotted[index];
        if (value === null) return;
        const position = at(index, value);
        const raw = itemValue(model, dimension.id, item.key);
        const text = state.scale === "relative"
          ? `${model.name} · ${dimension.name}\n${item.label}：相对 ${number(value)} / 100\n原始数值：${number(raw)}`
          : `${model.name} · ${dimension.name}\n${item.label}：${number(value)} / 100`;
        const hit = svgNode("circle", { cx: position.x, cy: position.y, r: 10, fill: "transparent" });
        hit.append(svgNode("title", {}, text));
        svg.append(hit);
        svg.append(svgNode("circle", { cx: position.x, cy: position.y, r: 3.4, fill: model.color }));
      });
    }
    return svg;
  }

  // 只有一个评分项的维度用竖柱状图：一根柱一个模型，柱高就是该项分数。
  function singleItemColumns(dimension, models) {
    const item = dimension.items[0];
    const width = 760, height = 470, left = 58, right = 26, top = 26, bottom = height - 104;
    const plotWidth = width - left - right, plotHeight = bottom - top;
    const entries = models
      .map(model => ({ model, plotted: plottedItem(model, dimension.id, item.key), raw: itemValue(model, dimension.id, item.key) }))
      .filter(entry => entry.plotted !== null)
      .sort((a, b) => b.plotted - a.plotted);
    const svg = svgNode("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": `${dimension.name}竖柱状图：${item.label}，按分数从高到低` });
    for (const tick of [0, 20, 40, 60, 80, 100]) {
      const y = bottom - plotHeight * tick / 100;
      svg.append(svgNode("line", { x1: left, y1: y, x2: left + plotWidth, y2: y, stroke: tick === 0 ? "#dce4f0" : "#eff3f9", "stroke-width": 1 }));
      svg.append(svgNode("text", { x: left - 10, y: y + 4, "text-anchor": "end", "font-size": 11, fill: "#a2b0c4" }, String(tick)));
    }
    if (!entries.length) {
      svg.append(svgNode("text", { x: left + plotWidth / 2, y: bottom - plotHeight / 2, "text-anchor": "middle", class: "chart-empty" }, "没有可绘制的模型"));
      return svg;
    }
    const slot = plotWidth / entries.length;
    const barWidth = Math.min(48, slot * 0.62);
    entries.forEach((entry, index) => {
      const center = left + slot * (index + 0.5);
      const y = bottom - plotHeight * entry.plotted / 100;
      const label = state.scale === "relative"
        ? `${entry.model.name} · ${item.label}：相对 ${number(entry.plotted)} / 100\n原始数值：${number(entry.raw)}`
        : `${entry.model.name} · ${item.label}：${number(entry.raw)} / 100`;
      const bar = svgNode("rect", { x: center - barWidth / 2, y, width: barWidth, height: Math.max(bottom - y, 0), rx: 3, fill: entry.model.color, "fill-opacity": .85 });
      bar.append(svgNode("title", {}, label));
      svg.append(bar);
      svg.append(svgNode("text", { x: center, y: y - 8, "text-anchor": "middle", "font-size": 10, fill: "#465e80" }, number(entry.raw)));
      svg.append(svgNode("text", { x: center, y: bottom + 14, "font-size": 10, fill: "#8a99ae", "text-anchor": "end", transform: `rotate(-38 ${center} ${bottom + 14})` }, entry.model.name));
    });
    return svg;
  }

  // 两个评分项的维度用直角三角形：两条直角边就是两项分数，直角在原点。
  // 单轴叠不成多边形，两条正交的边能直接读出两项的相对强弱。
  function dimensionTriangle(dimension, models) {
    const width = 640, height = 500, left = 76, bottom = height - 56, size = Math.min(width - left - 32, bottom - 26);
    const [first, second] = dimension.items;
    const at = (x, y) => ({ x: left + size * x / 100, y: bottom - size * y / 100 });
    const origin = at(0, 0);
    const svg = svgNode("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": `${dimension.name}分项直角三角形：横轴${first.label}，纵轴${second.label}` });
    for (const tick of [0, 20, 40, 60, 80, 100]) {
      const xPoint = at(tick, 0), yPoint = at(0, tick);
      if (tick > 0) {
        svg.append(svgNode("line", { x1: left, y1: yPoint.y, x2: left + size, y2: yPoint.y, stroke: "#eff3f9", "stroke-width": 1 }));
        svg.append(svgNode("line", { x1: xPoint.x, y1: bottom - size, x2: xPoint.x, y2: bottom, stroke: "#eff3f9", "stroke-width": 1 }));
      }
      svg.append(svgNode("text", { x: xPoint.x, y: bottom + 19, "text-anchor": "middle", "font-size": 11, fill: "#a2b0c4" }, String(tick)));
      svg.append(svgNode("text", { x: left - 11, y: yPoint.y + 4, "text-anchor": "end", "font-size": 11, fill: "#a2b0c4" }, String(tick)));
    }
    svg.append(svgNode("line", { x1: left, y1: bottom, x2: left + size, y2: bottom, stroke: "#dce4f0", "stroke-width": 1 }));
    svg.append(svgNode("line", { x1: left, y1: bottom - size, x2: left, y2: bottom, stroke: "#dce4f0", "stroke-width": 1 }));
    svg.append(svgNode("text", { x: left + size / 2, y: bottom + 42, "text-anchor": "middle", "font-size": 12, fill: "#8a99ae" }, `${first.short} →`));
    svg.append(svgNode("text", { x: left - 58, y: bottom - size / 2, "font-size": 12, fill: "#8a99ae", transform: `rotate(-90 ${left - 58} ${bottom - size / 2})`, "text-anchor": "middle" }, `${second.short} →`));
    for (const model of models) {
      const x = plottedItem(model, dimension.id, first.key);
      const y = plottedItem(model, dimension.id, second.key);
      if (x === null && y === null) continue;
      const vertex = (point, item, value, missing) => {
        const raw = itemValue(model, dimension.id, item.key);
        const lines = [`${model.name} · ${dimension.name}`];
        lines.push(state.scale === "relative"
          ? `${item.label}：相对 ${number(value)} / 100（原始数值 ${number(raw)}）`
          : `${item.label}：${number(value)} / 100`);
        // 只有一项成绩时把缺的另一项写进提示，读者不会误以为它在原点得 0 分。
        if (missing) lines.push(`${missing.label}：无数据，仅标出有成绩的这一项`);
        const hit = svgNode("circle", { cx: point.x, cy: point.y, r: 10, fill: "transparent" });
        hit.append(svgNode("title", {}, lines.join("\n")));
        svg.append(hit, svgNode("circle", { cx: point.x, cy: point.y, r: 3.6, fill: model.color }));
      };
      if (x === null || y === null) {
        // 只有一项成绩的模型标在那一项所在的轴上，另一轴留空：不补 0，也不从图里消失。
        if (x !== null) {
          const point = at(x, 0);
          svg.append(svgNode("line", { x1: origin.x, y1: origin.y, x2: point.x, y2: point.y, stroke: model.color, "stroke-width": 1.4, "stroke-dasharray": "4 4", "vector-effect": "non-scaling-stroke" }));
          vertex(point, first, x, second);
        } else {
          const point = at(0, y);
          svg.append(svgNode("line", { x1: origin.x, y1: origin.y, x2: point.x, y2: point.y, stroke: model.color, "stroke-width": 1.4, "stroke-dasharray": "4 4", "vector-effect": "non-scaling-stroke" }));
          vertex(point, second, y, first);
        }
      } else {
        const xEnd = at(x, 0), yEnd = at(0, y);
        svg.append(svgNode("polygon", {
          points: `${origin.x},${origin.y} ${xEnd.x},${xEnd.y} ${yEnd.x},${yEnd.y}`,
          fill: model.color, "fill-opacity": .07, stroke: model.color, "stroke-width": 1.6, "vector-effect": "non-scaling-stroke", "stroke-linejoin": "round"
        }));
        vertex(xEnd, first, x, null);
        vertex(yEnd, second, y, null);
      }
    }
    return svg;
  }

  function emptyDimensionChart(dimension) {
    const svg = svgNode("svg", { viewBox: "0 0 760 470", role: "img", "aria-label": `${dimension.name}还没有实测成绩` });
    svg.append(svgNode("text", { x: 380, y: 235, "text-anchor": "middle", class: "chart-empty" }, "这一维还没有实测成绩"));
    return svg;
  }

  // 图形区只有主雷达那一块：总览画能力雷达，进入某个维度时在同一块画布里换成
  // 该维度的分项图（单评分项维度用条形图占位），工具栏与图例保持不变。
  function renderChart() {
    const dimension = dimensions.get(state.view);
    if (dimension) renderDimensionChart(dimension);
    else renderOverviewRadar();
  }

  function renderDimensionChart(dimension) {
    hideTooltip();
    const svg = $("radar");
    const selected = data.models.filter(model => state.selected.has(model.id));
    renderLegend(selected);
    $("chart-title").textContent = `${dimension.name}分项图`;
    $("chart-back").hidden = false;
    const items = plottedItems(dimension);
    const pending = dimension.items.filter(item => !items.includes(item));
    const view = { ...dimension, items };
    const chart = !items.length ? emptyDimensionChart(dimension)
      : items.length === 1 ? singleItemColumns(view, selected)
      : items.length === 2 ? dimensionTriangle(view, selected)
      : dimensionRadar(view, selected);
    svg.setAttribute("viewBox", chart.getAttribute("viewBox"));
    svg.removeAttribute("aria-labelledby");
    svg.setAttribute("aria-label", chart.getAttribute("aria-label"));
    svg.replaceChildren(...[...chart.childNodes]);
    const pendingNote = pending.length ? `尚未有任何模型成绩、因此不占轴的评分项：${pending.map(item => item.label).join("、")}。` : "";
    $("chart-note").textContent = !items.length
      ? `${dimension.name}：定义了 ${dimension.items.length} 个评分项，但全场都没有实测，分项图不画空轴。`
      : items.length === 1
      ? `${dimension.name}：有实测的评分项只有 ${items[0].label}，单轴叠不出多边形，改用竖柱状图：一根柱一个模型，柱高即该项${state.scale === "relative" ? "按全场最高换算后" : ""}的分数，柱顶数字为原始分数，按分数从高到低排列。${pendingNote}`
      : `${dimension.name}：坐标轴是已有实测的 ${items.length} 个评分项（${items.map(item => item.label).join("、")}）${items.length === 2 ? "，两条直角边就是两项分数，只拿到一项成绩的模型用虚线标在对应轴上" : ""}。${pendingNote}${state.scale === "relative" ? "相对模式按该项全场最高换算成 100。" : ""}`;
    $("chart-note").textContent += " 分项图只画原始实测；图例证据占比对应当前维度指数。";
  }

  // 相对分数的基准固定取全部模型，不跟随搜索、厂商筛选和勾选，切换模型时同一模型的读数不变。
  const maxima = new Map();
  function dimensionMaximum(dimensionId) {
    if (!maxima.has(dimensionId)) {
      let max = 0;
      for (const model of data.models) {
        const value = valueOf(model, dimensionId);
        if (value !== null && value > max) max = value;
      }
      maxima.set(dimensionId, max);
    }
    return maxima.get(dimensionId);
  }

  // 总览绝对刻度画维度指数；相对刻度仅把每维最高指数缩放到 100。
  // 某维最高值不大于 0 时相对分数没有定义，按无数据处理，不编造比例。
  function plottedValue(model, dimensionId) {
    const value = valueOf(model, dimensionId);
    if (value === null) return null;
    if (state.scale === "absolute") return value;
    const max = dimensionMaximum(dimensionId);
    return max > 0 ? value / max * 100 : null;
  }

  // 总览与维度均按引擎输出的完整标准分降序，避免指数饱和或四舍五入影响名次。
  function orderedModels() {
    const dimension = currentDimension();
    const score = model => dimension ? dimensionResult(model, dimension.id)?.z ?? null : rankingResults.get(model.id)?.z ?? null;
    return filteredModels().sort((a, b) => {
      const va = score(a), vb = score(b);
      if (va === null && vb === null) return data.models.indexOf(a) - data.models.indexOf(b);
      if (va === null) return 1;
      if (vb === null) return -1;
      return vb - va || b.intelligenceIndex - a.intelligenceIndex || data.models.indexOf(a) - data.models.indexOf(b);
    });
  }

  function updateWeightLabels() {
    document.querySelectorAll("[data-dimension-weight]").forEach(output => {
      output.textContent = rankingWeights.error ? "—" : percent(rankingWeights.dimensionWeights.get(output.dataset.dimensionWeight));
    });
    document.querySelectorAll("[data-item-weight]").forEach(output => {
      output.textContent = rankingWeights.error ? "—" : percent(rankingWeights.itemWeights.get(output.dataset.itemWeight));
    });
    $("weight-error").hidden = !rankingWeights.error;
    $("weight-error").textContent = rankingWeights.error || "";
  }

  function updateRanking(rebuildControls = false) {
    maxima.clear();
    refreshRanking();
    if (rebuildControls) renderWeights();
    else updateWeightLabels();
    renderHeader();
    renderModels();
    renderChart();
    renderTable();
    renderInspector();
  }

  function renderWeights() {
    const priorityNames = ["0 · 不纳入", "1 · 一般", "2 · 重要", "3 · 核心"];
    const fieldFor = (name, priority, attribute, id, onChange) => {
      const field = node("label", { class: "weight-field" });
      const select = node("select", { "aria-label": `${name}优先级` });
      select.append(...priorityNames.map((label, value) => node("option", { value: String(value) }, label)));
      select.value = String(priority);
      select.addEventListener("change", () => { onChange(Number(select.value)); updateRanking(); });
      field.append(node("span", { class: "weight-name" }, name), select, node("output", { class: "weight-value", [attribute]: id, "aria-label": `${name}占总分权重` }));
      return field;
    };
    const reset = node("button", { type: "button", class: "text-button" }, "恢复默认分配");
    reset.addEventListener("click", () => { state.priorities = scoring.defaultPriorities(); updateRanking(true); });
    const toolbar = node("div", { class: "weight-toolbar" });
    toolbar.append(node("span", { class: "weight-title" }, "用途优先级"), node("span", { class: "weight-hint" }, "默认侧重编码、推理、长文与工具；右侧百分比为实际总分权重。"), reset);
    const dimensionFields = node("div", { class: "dimension-priorities" });
    dimensionFields.append(...data.dimensions.map(dimension => fieldFor(dimension.name, state.priorities.dimensions[dimension.id], "data-dimension-weight", dimension.id, priority => { state.priorities.dimensions[dimension.id] = priority; })));
    const details = node("details", { class: "item-priorities" });
    details.append(node("summary", {}, "调整具体评测的重要性与查看参考状态"));
    const groups = node("div", { class: "item-priority-groups" });
    groups.append(...data.dimensions.map(dimension => {
      const group = node("fieldset", { class: "item-priority-group" });
      group.append(node("legend", {}, dimension.name));
      for (const entry of scoring.entries.filter(item => item.dimensionId === dimension.id)) {
        group.append(fieldFor(entry.label, state.priorities.items[entry.id], "data-item-weight", entry.id, priority => { state.priorities.items[entry.id] = priority; }));
        if (!entry.calibrated) group.append(node("p", { class: "calibration-note" }, `${entry.label}：${entry.status}，已移出计分；其余有效项目统一按优先级分配权重。`));
      }
      return group;
    }));
    details.append(groups);
    $("weight-controls").replaceChildren(toolbar, dimensionFields, details);
    updateWeightLabels();
  }

  function renderTable() {
    const dimension = currentDimension();
    const header = node("tr");
    header.append(node("th", { scope: "col" }, "模型 / 推理档位"));
    const compositeHeader = node("th", { scope: "col" }, "综合排名指数");
    compositeHeader.append(node("small", {}, "参考均值与标准差 · 50 为参考平均"));
    if (!dimension) compositeHeader.setAttribute("aria-sort", "descending");
    header.append(compositeHeader);
    for (const item of data.dimensions) {
      const th = node("th", { scope: "col" });
      const button = node("button", { type: "button", class: "header-link" }, `${item.name} ↗`);
      button.addEventListener("click", () => { location.hash = item.id; });
      th.append(button, node("small", {}, `${item.en} · 维度指数`));
      if (dimension && dimension.id === item.id) {
        th.setAttribute("aria-current", "true");
        th.setAttribute("aria-sort", "descending");
      }
      header.append(th);
    }
    header.append(node("th", { scope: "col" }, "实测评分项"));
    $("ranking-head").replaceChildren(header);

    const list = orderedModels();
    $("ranking-body").replaceChildren(...list.map(model => {
      const row = node("tr");
      const nameCell = node("td");
      const label = node("div", { class: "table-model" });
      label.style.setProperty("--model-color", model.color);
      const text = node("span");
      text.append(node("span", { class: "model-name" }, model.name), node("small", {}, model.detail));
      label.append(node("span", { class: "model-dot", "aria-hidden": "true" }), text);
      nameCell.append(label);
      row.append(nameCell);
      const result = rankingResults.get(model.id);
      const compositeCell = node("td", { class: result === null ? "missing" : "composite-cell" });
      if (result === null) compositeCell.append(node("span", { class: "missing", title: rankingWeights.error }, "—"));
      else {
        compositeCell.append(node("span", { class: "score-value", title: `综合标准分 Z=${precise(result.z)}；合成实测、经验证估计与明确标记的中性值，名次使用完整精度` }, number(result.score)));
        const evidence = evidenceNode(result);
        if (evidence) compositeCell.append(evidence);
        const track = node("div", { class: "score-track", "aria-hidden": "true" });
        const known = node("span", { class: "known" });
        known.style.width = `${result.score}%`;
        track.append(known);
        compositeCell.append(track);
      }
      row.append(compositeCell);
      for (const item of data.dimensions) row.append(valueCell(model, item.id, Boolean(dimension && dimension.id === item.id)));
      const coverageCell = node("td");
      coverageCell.append(coverageBadge(model));
      row.append(coverageCell);
      return row;
    }));
    if (!list.length) {
      const row = node("tr");
      row.append(node("td", { colspan: data.dimensions.length + 3, class: "empty" }, rankingWeights.error || (state.completeOnly ? "没有有效实测覆盖率达到 100% 的模型。缺测或参考基准不足的项目均不计入有效覆盖。" : "没有匹配的模型。请调整搜索或厂商筛选。")));
      $("ranking-body").append(row);
    }
    $("table-count").textContent = `显示 ${list.length} / ${data.models.length} 个模型`;
  }

  function renderInspector() {
    const model = models.get(state.detailId);
    const dimension = currentDimension();
    const result = rankingResults.get(model.id);
    $("inspector-title").textContent = `${model.name} · 评分明细`;
    $("inspector-description").textContent = `${model.creator} · ${model.detail}。原始实测、近邻估计、固定参考、权重与贡献分别列出；估计依据包含中位锚点、回归校正与遮挡验证误差。`;
    $("model-source").href = model.url;
    $("detail-summary").replaceChildren(
      node("span", {}, "原始实测"), coverageBadge(model),
      node("span", {}, "综合证据构成"),
      result === null ? node("span", {}, "—") : node("span", {}, evidenceSummary(result)),
      node("span", {}, dimension ? `当前维度：${dimension.name}` : `总览：${data.dimensions.length} 个维度`)
    );
    const rows = [];
    const kindNames = { measured: "实测", estimated: "近邻估计", unknown: "证据不足", excluded: "未纳入" };
    for (const current of dimension ? [dimension] : data.dimensions) {
      const currentResult = dimensionResult(model, current.id);
      const group = node("tr", { class: "group-row" });
      const heading = node("td", { colspan: 8 });
      const button = node("button", { type: "button", class: "header-link" }, current.name);
      button.addEventListener("click", () => { location.hash = current.id; });
      heading.append(button, document.createTextNode(` · ${scoring.measuredCount(model, current.id)} / ${current.items.length} 项实测 · 维度指数 ${currentResult === null ? "—" : number(currentResult.score)}`));
      if (currentResult !== null) heading.append(node("small", { class: "dimension-evidence" }, evidenceSummary(currentResult)));
      group.append(heading);
      rows.push(group);
      for (const entry of current.items) {
        const detail = scoring.itemResult(model, current.id, entry.key, rankingWeights);
        const row = node("tr");
        const label = node("td", { class: "detail-benchmark" });
        label.append(node("span", {}, entry.label), node("small", {}, `${SOURCE_LABELS[entry.source]} · ${entry.metric}`));
        const referenceCell = node("td", { class: "reference-cell" });
        referenceCell.append(
          node("span", {}, `均值 ${detail.item.center === null ? "—" : precise(detail.item.center)}`),
          node("small", {}, `总体标准差 ${detail.item.scale === null ? "—" : precise(detail.item.scale)}`),
          node("small", {}, `${detail.item.count} 条参考成绩`)
        );
        const statusCell = node("td", { class: "scoring-status" }, `${kindNames[detail.kind]}：${detail.reason}`);
        if (detail.weight === 0 && detail.withinWeight > 0) statusCell.append(node("small", { class: "validation-note" }, "本维度未纳入综合，当前贡献仅计入维度指数。"));
        if (detail.validation) {
          const validation = detail.validation;
          statusCell.append(node("small", { class: "validation-note" }, `遮挡验证 ${validation.count} 例 · 校正估计 MAE ${validation.neighborMae === null ? "—" : precise(validation.neighborMae)} · 均值基线 MAE ${validation.baselineMae === null ? "—" : precise(validation.baselineMae)}`));
        }
        if (detail.prediction) {
          const prediction = detail.prediction;
          const basis = node("details", { class: "prediction-details" });
          basis.append(node("summary", {}, `候选估计 ${number(prediction.value)} · ${detail.kind === "estimated" ? "已用于计分" : "未用于计分"}`));
          basis.append(node("p", {}, `中位锚点 ${precise(prediction.anchorValue)} ＋ 回归校正（${precise(prediction.correction)}）＝ ${precise(prediction.value)}`));
          basis.append(node("p", {}, `邻居目标成绩：${prediction.neighbors.map(neighbor => `${neighbor.name} ${number(neighbor.value)}`).join("；")}`));
          for (const adjustment of prediction.adjustments) {
            basis.append(node("p", {}, `${adjustment.label}：本模型 ${number(adjustment.subjectValue)}，邻居中位数 ${number(adjustment.anchorValue)}，对应校正 ${precise(adjustment.correction)} 分。`));
          }
          statusCell.append(basis);
        }
        row.append(
          label,
          node("td", { class: detail.value === null ? "missing" : "" }, detail.value === null ? "—" : number(detail.value)),
          node("td", { class: detail.estimatedValue === null ? "missing" : "estimate-value" }, detail.estimatedValue === null ? "—" : number(detail.estimatedValue)),
          referenceCell,
          node("td", {}, detail.weight === null ? "—" : percent(detail.weight)),
          node("td", {}, detail.item.calibrated ? precise(detail.z) : "—"),
          node("td", {}, detail.contribution === null ? "—" : precise(detail.contribution)),
          statusCell
        );
        rows.push(row);
      }
    }
    $("detail-body").replaceChildren(...rows);
  }

  function render() {
    const route = location.hash.slice(1) || "overview";
    const valid = route === "overview" || dimensions.has(route);
    state.view = route;
    renderNavigation();
    $("route-error").hidden = valid;
    $("view-body").hidden = !valid;
    if (!valid) return;
    renderHeader();
    renderModels();
    renderChart();
    renderTable();
    renderInspector();
  }

  const defaultDistribution = data.dimensions.map(dimension => `${dimension.name} ${percent(defaultWeights.dimensionWeights.get(dimension.id))}`).join("、");
  $("default-weight-description").textContent = `通用任务默认分配：${defaultDistribution}。分项评测按预设优先级分配。`;
  const snapshotDate = new Date(data.retrievedAt).toISOString().slice(0, 10);
  $("snapshot").textContent = `数据快照 · ${snapshotDate} UTC`;
  $("source-description").textContent = `数据获取时间 ${data.retrievedAt}。冻结参考版本 ${scoring.reference.version}，参考快照 ${scoring.reference.retrievedAt}，共 ${scoring.reference.models.length} 个参考模型。中心为参考算术均值，尺度为总体标准差；遮挡验证完整排除被验证模型后重新计算基准。AA 智力指数仅用于标准分相同的排列。`;
  const unavailableItems = scoring.entries.filter(item => !item.calibrated);
  $("reference-status").textContent = `每项至少 ${scoring.rules.minimumReferences} 条有效参考且标准差大于 0；近邻估计要求至少 ${scoring.rules.minimumReferences} 个完整候选，取最近 ${scoring.rules.neighbors} 个的中位数为锚点，再按同维实测差异作局部回归校正（收缩系数 ${scoring.rules.ridgePenalty}）。至少 ${scoring.rules.minimumValidationCases} 个遮挡样本且校正估计 MAE 严格优于均值基线才启用。${unavailableItems.length ? `已移出计分：${unavailableItems.map(item => `${item.label}（${item.status}）`).join("、")}；其余有效项目统一归一权重。` : "当前所有评测均符合参考准入要求。"}`;
  $("model-sources").replaceChildren(...data.models.map(model => sourceLink(model.url, `${model.name} · ${model.detail} ↗`)));
  $("creator-filter").append(...[...new Set(data.models.map(model => model.creator))].sort().map(creator => node("option", { value: creator }, creator)));
  $("detail-model").append(...data.models.map(model => node("option", { value: model.id }, `${model.name} · ${model.detail}`)));
  $("detail-model").value = state.detailId;
  $("detail-model").addEventListener("change", event => { state.detailId = event.target.value; renderInspector(); });
  $("model-search").addEventListener("input", event => { state.query = event.target.value.trim().toLowerCase(); renderModels(); renderTable(); });
  $("creator-filter").addEventListener("change", event => { state.creator = event.target.value; renderModels(); renderTable(); });
  $("complete-only").addEventListener("change", event => { state.completeOnly = event.target.checked; renderModels(); renderTable(); });
  $("select-default").addEventListener("click", () => { state.selected = new Set(["deepseek", "gpt"]); renderModels(); renderChart(); });
  const setScale = scale => {
    state.scale = scale;
    $("scale-absolute").setAttribute("aria-pressed", String(scale === "absolute"));
    $("scale-relative").setAttribute("aria-pressed", String(scale === "relative"));
    renderChart();
  };
  $("chart-back").addEventListener("click", () => { location.hash = "overview"; });
  $("scale-absolute").addEventListener("click", () => setScale("absolute"));
  $("scale-relative").addEventListener("click", () => setScale("relative"));
  $("select-all").addEventListener("click", () => { state.selected = new Set(data.models.map(model => model.id)); renderModels(); renderChart(); });
  $("select-none").addEventListener("click", () => { state.selected.clear(); renderModels(); renderChart(); });
  $("method-link").addEventListener("click", () => $("method").scrollIntoView({ block: "center" }));
  window.addEventListener("hashchange", render);
  window.addEventListener("resize", hideTooltip);
  renderDeck();
  renderWeights();
  render();
})();
