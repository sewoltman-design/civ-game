(function (global) {
  const data = global.GameData || {};
  const languageModels = data.languageModels || [];
  const imageModels = data.imageModels || [];
  const videoModels = data.videoModels || [];
  const audioModels = data.audioModels || [];
  const worldModels = data.worldModels || [];
  const computeUpgrades = data.computeUpgrades || [];
  const researchUpgrades = data.researchUpgrades || [];
  const revenueUpgrades = data.revenueUpgrades || [];
  const partnershipUpgrades = data.partnershipUpgrades || [];
  const fundingRounds = data.fundingRounds || [];

  const categories = {
    language: languageModels,
    image: imageModels,
    video: videoModels,
    audio: audioModels,
    world: worldModels,
  };

  function createDefaultState() {
    return {
      time: 0,
      cash: 500000,
      funding: 500000,
      expensesPerSecond: 250,
      revenuePerSecond: 800,
      computeCapacity: 500,
      computeUsed: 0,
      energyUsage: 40,
      researchSpeed: 1,
      aiPower: 0,
      unlockedModels: { language: 0, image: 0, video: 0, audio: 0, world: 0 },
      completedModels: [],
      purchasedUpgrades: new Set(),
      partnerships: new Set(),
      fundingClaimed: new Set(),
      activeResearch: null,
      history: {
        timestamps: [],
        compute: [],
        revenue: [],
        aiPower: [],
      },
      news: [
        'Founders secure seed capital and repurpose a warehouse into a compute lab.',
        'Talent joins from academia, ready to train GPT-1.',
      ],
    };
  }

  function sanitizeState(state) {
    const safeState = createDefaultState();
    const incoming = state || {};
    const history = incoming.history || {};

    return {
      ...safeState,
      ...incoming,
      purchasedUpgrades: new Set(incoming.purchasedUpgrades || []),
      partnerships: new Set(incoming.partnerships || []),
      fundingClaimed: new Set(incoming.fundingClaimed || []),
      unlockedModels: { ...safeState.unlockedModels, ...(incoming.unlockedModels || {}) },
      history: {
        timestamps: Array.isArray(history.timestamps) ? [...history.timestamps] : [],
        compute: Array.isArray(history.compute) ? [...history.compute] : [],
        revenue: Array.isArray(history.revenue) ? [...history.revenue] : [],
        aiPower: Array.isArray(history.aiPower) ? [...history.aiPower] : [],
      },
      news: Array.isArray(incoming.news) ? [...incoming.news] : [...safeState.news],
    };
  }

  function getModelList(category) {
    return categories[category] || [];
  }

  function getModelById(modelId) {
    for (const list of Object.values(categories)) {
      const found = list.find((m) => m.id === modelId);
      if (found) return found;
    }
    return null;
  }

  function canAfford(state, cost) {
    return state.cash >= cost;
  }

  function purchaseUpgrade(state, upgrade, type) {
    if (state.purchasedUpgrades.has(upgrade.id)) return false;
    if (!canAfford(state, upgrade.cost)) return false;
    state.cash -= upgrade.cost;
    state.purchasedUpgrades.add(upgrade.id);
    if (type === 'partnerships') {
      state.partnerships.add(upgrade.id);
    }
    pushNews(state, `${upgrade.name} deployed, improving ${type} operations.`);

    if (upgrade.computeGain) {
      state.computeCapacity += upgrade.computeGain;
    }
    if (upgrade.energyCost) {
      state.energyUsage += upgrade.energyCost;
      if (state.energyUsage < 0) state.energyUsage = 0;
    }
    if (upgrade.researchBoost) {
      state.researchSpeed += upgrade.researchBoost;
    }
    if (upgrade.revenueBoost) {
      state.revenuePerSecond += upgrade.revenueBoost;
    }
    if (upgrade.expenseReduction) {
      state.expensesPerSecond *= 1 - upgrade.expenseReduction;
    }
    return true;
  }

  function unlockFunding(state, funding) {
    if (state.fundingClaimed.has(funding.id)) return false;
    state.cash += funding.amount;
    state.funding += funding.amount;
    state.fundingClaimed.add(funding.id);
    pushNews(state, `${funding.name} secured for ${formatCurrency(funding.amount)} (${funding.equity}).`);
    return true;
  }

  function startResearch(state, category, index) {
    const list = getModelList(category);
    const model = list[index];
    if (!model) return { success: false, reason: 'Model not found.' };
    if (index > state.unlockedModels[category]) {
      return { success: false, reason: 'Research previous model first.' };
    }
    if (state.activeResearch) {
      return { success: false, reason: 'Another project is already training.' };
    }
    if (!canAfford(state, model.cost)) {
      return { success: false, reason: 'Insufficient cash.' };
    }
    if (state.computeCapacity < model.computeRequired) {
      return { success: false, reason: 'Insufficient compute capacity.' };
    }

    state.cash -= model.cost;
    state.activeResearch = {
      category,
      modelId: model.id,
      progress: 0,
      duration: model.researchTime,
      computeRequired: model.computeRequired,
      revenueBoost: model.revenueBoost || 0,
      researchBoost: model.researchBoost || 0,
      efficiencyBoost: model.efficiencyBoost || 0,
      energyCost: model.energyCost || 0,
    };
    pushNews(state, `Training ${model.name} (${model.year}) begins. ${model.description}`);
    return { success: true };
  }

  function updateResearch(state, deltaSeconds) {
    if (!state.activeResearch) {
      state.computeUsed = 0;
      return;
    }
    const project = state.activeResearch;
    project.progress += deltaSeconds * state.researchSpeed;
    state.computeUsed = Math.min(project.computeRequired, state.computeCapacity);
    if (project.progress >= project.duration) {
      completeResearch(state, project);
      state.activeResearch = null;
      state.computeUsed = 0;
    }
  }

  function completeResearch(state, project) {
    const model = getModelById(project.modelId);
    if (!model) return;
    state.unlockedModels[project.category] += 1;
    state.completedModels.push(project.modelId);
    state.revenuePerSecond += project.revenueBoost;
    state.researchSpeed += project.researchBoost;
    if (project.efficiencyBoost) {
      state.computeCapacity *= project.efficiencyBoost;
    }
    state.energyUsage += project.energyCost;
    state.aiPower += project.computeRequired * (1 + project.researchBoost * 5);
    pushNews(state, `${model.name} deployed! ${model.description}`);
  }

  function updateEconomy(state, deltaSeconds) {
    const net = state.revenuePerSecond - state.expensesPerSecond;
    state.cash += net * deltaSeconds;
    if (state.cash < 0) state.cash = 0;
  }

  function advanceTime(state, deltaSeconds) {
    state.time += deltaSeconds;
    updateResearch(state, deltaSeconds);
    updateEconomy(state, deltaSeconds);
    recordHistory(state);
  }

  function recordHistory(state) {
    const maxPoints = 240;
    state.history.timestamps.push(state.time);
    state.history.compute.push(state.computeCapacity);
    state.history.revenue.push(state.revenuePerSecond - state.expensesPerSecond);
    state.history.aiPower.push(state.aiPower);
    if (state.history.timestamps.length > maxPoints) {
      state.history.timestamps.shift();
      state.history.compute.shift();
      state.history.revenue.shift();
      state.history.aiPower.shift();
    }
  }

  function pushNews(state, message) {
    const timestamp = Math.floor(state.time / 60);
    const prefix = timestamp > 0 ? `Year ${2024 + timestamp}: ` : 'Year 2024: ';
    state.news.push(prefix + message);
    if (state.news.length > 40) {
      state.news.shift();
    }
  }

  function formatNumber(value) {
    if (value >= 1000000000) {
      return `${(value / 1000000000).toFixed(2)}B`;
    }
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toFixed(0);
  }

  function formatCurrency(value) {
    return `$${formatNumber(value)}`;
  }

  function getInfrastructure(state) {
    return computeUpgrades.map((upgrade) => ({
      ...upgrade,
      purchased: state.purchasedUpgrades.has(upgrade.id),
    }));
  }

  function getAvailableFunding(state) {
    return fundingRounds.map((round) => ({
      ...round,
      claimed: state.fundingClaimed.has(round.id),
    }));
  }

  function describeModel(model) {
    return `${model.description} Requires ${formatNumber(model.computeRequired)} compute and ${formatCurrency(
      model.cost
    )}.`;
  }

  function getActiveModel(state) {
    if (!state.activeResearch) return null;
    const model = getModelById(state.activeResearch.modelId);
    if (!model) return null;
    return {
      ...state.activeResearch,
      model,
      progressPercent: Math.min(100, (state.activeResearch.progress / state.activeResearch.duration) * 100),
    };
  }

  function serializeState(state) {
    return {
      ...state,
      purchasedUpgrades: Array.from(state.purchasedUpgrades),
      partnerships: Array.from(state.partnerships),
      fundingClaimed: Array.from(state.fundingClaimed),
    };
  }

  global.GameLogic = {
    createDefaultState,
    sanitizeState,
    getModelList,
    getModelById,
    canAfford,
    purchaseUpgrade,
    unlockFunding,
    startResearch,
    updateResearch,
    updateEconomy,
    advanceTime,
    pushNews,
    formatNumber,
    formatCurrency,
    getInfrastructure,
    getAvailableFunding,
    describeModel,
    getActiveModel,
    serializeState,
  };
})(window);
