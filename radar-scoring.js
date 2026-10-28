(() => {
  "use strict";

  // 维度、综合、覆盖率与明细共用这里的结果；原始实测和冻结参考均不补写。
  window.createRadarScoring = function (data, reference, reject) {
    const rules = Object.freeze({ minimumReferences: 5, neighbors: 3, minimumValidationCases: 5, ridgePenalty: 1 });
    if (!reference || !reference.version || !reference.sourceVersion || !/^\d{4}-\d{2}-\d{2}T/.test(reference.retrievedAt)) reject("缺少有效的冻结参考基准");
    if (!Array.isArray(reference.models) || !reference.models.length || !Array.isArray(reference.items)) reject("参考模型或评测列表无效");
    const referenceIds = new Set();
    for (const model of reference.models) {
      if (!model || !model.id || referenceIds.has(model.id) || !model.name || !model.detail) reject("参考模型配置无效或重复");
      referenceIds.add(model.id);
    }

    function median(values) {
      if (!values.length) return null;
      const sorted = values.slice().sort((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    }

    // 标准分采用算术均值与总体标准差：μ = Σx/n，σ = √(Σ(x−μ)²/n)。
    // 参考不足或参考成绩完全相同时无法标准化，该项明确移出计分。
    function calibrate(values) {
      const count = values.length;
      const center = count ? values.reduce((sum, value) => sum + value, 0) / count : null;
      const variance = count ? values.reduce((sum, value) => sum + (value - center) ** 2, 0) / count : null;
      const scale = variance === null ? null : Math.sqrt(variance);
      const calibrated = count >= rules.minimumReferences && scale > 0;
      const status = count < rules.minimumReferences ? `有效参考不足 ${rules.minimumReferences} 条（现有 ${count} 条）`
        : !(scale > 0) ? "标准差为零，无法标准化" : "参考基准可用";
      return { count, center, scale, calibrated, status };
    }

    const itemId = (dimensionId, key) => `${dimensionId}.${key}`;
    const definitions = new Map(data.dimensions.flatMap(dimension => dimension.items.map(item => [itemId(dimension.id, item.key), { ...item, dimensionId: dimension.id }])));
    const entries = [];
    const references = new Map();
    const referenceRows = reference.models.map((model, order) => ({ ...model, order, values: new Map() }));
    for (const entry of reference.items) {
      if (!entry || !entry.dimensionId || !entry.key) reject("参考评测缺少维度或评分项标识");
      const id = itemId(entry.dimensionId, entry.key);
      const definition = definitions.get(id);
      if (!definition || references.has(id)) reject(`参考评测未知或重复：${id}`);
      if (entry.label !== definition.label || entry.metric !== definition.metric || entry.source !== definition.source) reject(`评测口径与冻结基准不一致：${id}，请提供匹配的基准版本`);
      if (!Array.isArray(entry.scores) || entry.scores.length !== reference.models.length || entry.scores.some(value => value !== null && (!Number.isFinite(value) || value < 0 || value > 100))) reject(`参考成绩无效：${id}`);
      entry.scores.forEach((value, index) => referenceRows[index].values.set(id, value));
      const item = Object.freeze({ ...definition, id, ...calibrate(entry.scores.filter(value => value !== null)) });
      references.set(id, item);
      entries.push(item);
    }
    for (const id of definitions.keys()) {
      if (!references.has(id)) reject(`缺少评测的冻结参考：${id}`);
    }
    const entriesByDimension = new Map(data.dimensions.map(dimension => [dimension.id, entries.filter(item => item.dimensionId === dimension.id)]));

    const measuredValue = (model, dimensionId, key) => {
      const value = model.breakdown[dimensionId]?.[key];
      return value === undefined || value === null ? null : value;
    };
    const measuredCount = (model, dimensionId) => entries.filter(item => (!dimensionId || item.dimensionId === dimensionId) && measuredValue(model, item.dimensionId, item.key) !== null).length;
    // 初始化与重置读取同一份用途定义，用户调整不会改写默认优先级。
    const defaultPriorities = () => ({
      dimensions: Object.fromEntries(data.dimensions.map(dimension => [dimension.id, dimension.defaultPriority])),
      items: Object.fromEntries(entries.map(item => [item.id, item.defaultPriority]))
    });

    function weightsFor(dimensionPriorities, itemPriorities) {
      const invalid = error => ({ error, dimensionWeights: new Map(), itemWeights: new Map(), withinWeights: new Map() });
      const validPriority = priority => Number.isInteger(priority) && priority >= 0 && priority <= 3;
      if (data.dimensions.some(dimension => !validPriority(dimensionPriorities[dimension.id])) || entries.some(item => !validPriority(itemPriorities[item.id]))) return invalid("优先级必须为 0、1、2 或 3。");
      const total = data.dimensions.reduce((sum, dimension) => sum + dimensionPriorities[dimension.id], 0);
      if (!total) return invalid("请至少为一个维度设置大于 0 的优先级。");
      const dimensionWeights = new Map(), itemWeights = new Map(), withinWeights = new Map();
      for (const dimension of data.dimensions) {
        const weight = dimensionPriorities[dimension.id] / total;
        const items = entriesByDimension.get(dimension.id);
        const itemTotal = items.reduce((sum, item) => sum + (item.calibrated ? itemPriorities[item.id] : 0), 0);
        if (weight > 0 && !itemTotal) return invalid(`${dimension.name}已纳入排名，请至少为一项参考有效的评测设置大于 0 的优先级。`);
        dimensionWeights.set(dimension.id, weight);
        for (const item of items) {
          // 不可标准化的项目移出计分；模型缺项始终保留同一份固定权重。
          const withinWeight = item.calibrated && itemTotal > 0 ? itemPriorities[item.id] / itemTotal : 0;
          withinWeights.set(item.id, withinWeight);
          itemWeights.set(item.id, weight * withinWeight);
        }
      }
      return { error: null, dimensionWeights, itemWeights, withinWeights };
    }

    function fitRidge(features, targets) {
      const width = features[0].length;
      const gram = Array.from({ length: width }, (_, row) => Array.from({ length: width }, (_, column) =>
        features.reduce((sum, sample) => sum + sample[row] * sample[column], 0) + (row === column ? rules.ridgePenalty : 0)));
      const rhs = Array.from({ length: width }, (_, column) => features.reduce((sum, sample, index) => sum + sample[column] * targets[index], 0));
      // 固定收缩使三邻居下的相关特征也有唯一解，用 Cholesky 分解求解正定方程。
      const lower = Array.from({ length: width }, () => Array(width).fill(0));
      for (let row = 0; row < width; row++) {
        for (let column = 0; column <= row; column++) {
          let residual = gram[row][column];
          for (let index = 0; index < column; index++) residual -= lower[row][index] * lower[column][index];
          if (row === column) {
            if (!(residual > 0) || !Number.isFinite(residual)) reject("局部回归方程无法求解");
            lower[row][column] = Math.sqrt(residual);
          } else lower[row][column] = residual / lower[column][column];
        }
      }
      const forward = Array(width).fill(0), coefficients = Array(width).fill(0);
      for (let row = 0; row < width; row++) {
        let residual = rhs[row];
        for (let column = 0; column < row; column++) residual -= lower[row][column] * forward[column];
        forward[row] = residual / lower[row][row];
      }
      for (let row = width - 1; row >= 0; row--) {
        let residual = forward[row];
        for (let column = row + 1; column < width; column++) residual -= lower[column][row] * coefficients[column];
        coefficients[row] = residual / lower[row][row];
      }
      return coefficients;
    }

    function neighborsFor(target, predictors, subject, rows, calibrations) {
      if (!predictors.length || predictors.some(item => !calibrations.get(item.id).calibrated)) return null;
      const candidates = rows.filter(row => row.id !== subject.id && row.values.get(target.id) !== null && predictors.every(item => row.values.get(item.id) !== null));
      if (candidates.length < rules.minimumReferences) return null;
      const neighbors = candidates.map(row => {
        const squaredDistance = predictors.reduce((sum, item) => sum + ((subject.values.get(item.id) - row.values.get(item.id)) / calibrations.get(item.id).scale) ** 2, 0);
        return { id: row.id, name: row.name, order: row.order, value: row.values.get(target.id), predictorValues: predictors.map(item => row.values.get(item.id)), distance: Math.sqrt(squaredDistance / predictors.length) };
      }).sort((a, b) => a.distance - b.distance || a.order - b.order).slice(0, rules.neighbors);
      const anchorValue = median(neighbors.map(neighbor => neighbor.value));
      const predictorAnchors = predictors.map((item, index) => median(neighbors.map(neighbor => neighbor.predictorValues[index])));
      const targetScale = calibrations.get(target.id).scale;
      const features = neighbors.map(neighbor => predictors.map((item, index) => (neighbor.predictorValues[index] - predictorAnchors[index]) / calibrations.get(item.id).scale));
      const targets = neighbors.map(neighbor => (neighbor.value - anchorValue) / targetScale);
      const coefficients = fitRidge(features, targets);
      // 中位数提供锚点；回归只估计模型相对邻居的差异，输入与目标均先缩放以统一收缩强度。
      const adjustments = predictors.map((item, index) => {
        const subjectValue = subject.values.get(item.id);
        const delta = (subjectValue - predictorAnchors[index]) / calibrations.get(item.id).scale;
        return { id: item.id, label: item.label, anchorValue: predictorAnchors[index], subjectValue, correction: targetScale * coefficients[index] * delta };
      });
      const correction = adjustments.reduce((sum, adjustment) => sum + adjustment.correction, 0);
      const value = anchorValue + correction;
      if (!Number.isFinite(value)) reject(`局部回归产生无效估计：${target.id}`);
      return { value, anchorValue, correction, adjustments, candidateCount: candidates.length, neighbors };
    }

    const validationCache = new Map();
    function validationFor(target, predictors) {
      const cacheKey = JSON.stringify([target.id, predictors.map(item => item.id)]);
      if (validationCache.has(cacheKey)) return validationCache.get(cacheKey);
      const cases = [];
      for (const subject of referenceRows) {
        if (subject.values.get(target.id) === null || predictors.some(item => subject.values.get(item.id) === null)) continue;
        // 遮挡整行：目标值、距离尺度和均值基线均不能使用被验证模型。
        const training = referenceRows.filter(row => row.id !== subject.id);
        const calibrations = new Map([target, ...predictors].map(item => [item.id, calibrate(training.map(row => row.values.get(item.id)).filter(value => value !== null))]));
        const targetCalibration = calibrations.get(target.id);
        if (!targetCalibration.calibrated) continue;
        const prediction = neighborsFor(target, predictors, subject, training, calibrations);
        if (!prediction) continue;
        cases.push({ modelId: subject.id, actual: subject.values.get(target.id), predicted: prediction.value, baseline: targetCalibration.center, neighbors: prediction.neighbors.map(neighbor => neighbor.id) });
      }
      const count = cases.length;
      const neighborMae = count ? cases.reduce((sum, entry) => sum + Math.abs(entry.predicted - entry.actual), 0) / count : null;
      const baselineMae = count ? cases.reduce((sum, entry) => sum + Math.abs(entry.baseline - entry.actual), 0) / count : null;
      const enabled = count >= rules.minimumValidationCases && neighborMae < baselineMae;
      const reason = count < rules.minimumValidationCases ? `遮挡验证不足 ${rules.minimumValidationCases} 个样本`
        : enabled ? "遮挡验证通过，局部回归误差低于均值基线" : "局部回归误差未低于均值基线";
      const result = Object.freeze({ targetId: target.id, predictorIds: predictors.map(item => item.id), count, neighborMae, baselineMae, enabled, reason, cases });
      validationCache.set(cacheKey, result);
      return result;
    }

    function resolveItem(model, item, weights) {
      const value = measuredValue(model, item.dimensionId, item.key);
      const weight = weights.error ? null : weights.itemWeights.get(item.id);
      const withinWeight = weights.error ? null : weights.withinWeights.get(item.id);
      const effective = value !== null && item.calibrated;
      const result = { item, value, estimatedValue: null, effective, weight, withinWeight, z: effective ? (value - item.center) / item.scale : 0, kind: effective ? "measured" : "unknown", reason: "实测且参考基准可用", validation: null, prediction: null, neighbors: [], predictors: [] };
      if (!item.calibrated) {
        result.kind = "excluded";
        result.reason = `${item.status}，已移出计分`;
      } else if (weights.error) {
        result.reason = "优先级配置无效，无法计算排名";
      } else if (!withinWeight) {
        result.kind = "excluded";
        result.reason = "本项优先级为 0，未纳入计分";
      } else if (value === null) {
        const predictors = entriesByDimension.get(item.dimensionId).filter(other => other.id !== item.id && weights.withinWeights.get(other.id) > 0 && measuredValue(model, other.dimensionId, other.key) !== null);
        result.predictors = predictors.map(other => other.id);
        result.reason = "同维度没有相关实测，按参考平均水平参与（z=0）";
        if (predictors.length) {
          const subject = { id: model.id, values: new Map(predictors.map(other => [other.id, measuredValue(model, other.dimensionId, other.key)])) };
          const prediction = neighborsFor(item, predictors, subject, referenceRows, references);
          result.reason = `完整候选参考不足 ${rules.minimumReferences} 个，按参考平均水平参与（z=0）`;
          if (prediction) {
            result.prediction = prediction;
            result.neighbors = prediction.neighbors;
            result.validation = validationFor(item, predictors);
            result.reason = `${result.validation.reason}，按参考平均水平参与（z=0）`;
            // 越界候选保留在验证误差中，实际计分明确拒绝，不截断分数或挑掉困难案例。
            if (prediction.value < 0 || prediction.value > 100) {
              result.reason = "局部回归候选超出 0–100 分范围，按参考平均水平参与（z=0）";
            } else if (result.validation.enabled) {
              result.kind = "estimated";
              result.estimatedValue = prediction.value;
              result.z = (prediction.value - item.center) / item.scale;
              result.reason = `${rules.neighbors} 近邻中位锚点与局部回归校正，遮挡验证通过`;
            }
          }
        }
      }
      result.contribution = weight === null ? null : weight * result.z;
      return result;
    }

    const evaluationCache = new WeakMap();
    const toIndex = z => 100 / (1 + Math.exp(-z));
    function evaluate(model, weights) {
      if (weights.error) return null;
      if (!evaluationCache.has(weights)) evaluationCache.set(weights, new WeakMap());
      const modelCache = evaluationCache.get(weights);
      if (modelCache.has(model)) return modelCache.get(model);
      const items = new Map(entries.map(item => [item.id, resolveItem(model, item, weights)]));
      const dimensionResults = new Map();
      let z = 0, coverage = 0, estimatedCoverage = 0, unknownCoverage = 0;
      for (const dimension of data.dimensions) {
        const details = entriesByDimension.get(dimension.id).map(item => items.get(item.id));
        if (!details.some(detail => detail.withinWeight > 0)) {
          dimensionResults.set(dimension.id, null);
          continue;
        }
        const result = { z: 0, coverage: 0, estimatedCoverage: 0, unknownCoverage: 0 };
        for (const detail of details) {
          result.z += detail.withinWeight * detail.z;
          if (detail.kind === "measured") result.coverage += detail.withinWeight;
          else if (detail.kind === "estimated") result.estimatedCoverage += detail.withinWeight;
          else if (detail.kind === "unknown") result.unknownCoverage += detail.withinWeight;
        }
        result.score = toIndex(result.z);
        dimensionResults.set(dimension.id, result);
        const weight = weights.dimensionWeights.get(dimension.id);
        // 综合分合成维度标准分，避免对已映射的指数再取平均。
        z += weight * result.z;
        coverage += weight * result.coverage;
        estimatedCoverage += weight * result.estimatedCoverage;
        unknownCoverage += weight * result.unknownCoverage;
      }
      const result = { z, score: toIndex(z), coverage, estimatedCoverage, unknownCoverage, dimensions: dimensionResults, items };
      modelCache.set(model, result);
      return result;
    }

    function itemResult(model, dimensionId, key, weights) {
      const id = itemId(dimensionId, key);
      const item = references.get(id);
      if (!item) reject(`未知的评分项：${id}`);
      return weights.error ? resolveItem(model, item, weights) : evaluate(model, weights).items.get(id);
    }

    return Object.freeze({ reference, rules, entries: Object.freeze(entries), defaultPriorities, weightsFor, measuredValue, measuredCount, itemResult, evaluate });
  };
})();
