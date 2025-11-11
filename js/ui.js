import {
  languageModels,
  imageModels,
  videoModels,
  audioModels,
  worldModels,
  computeUpgrades,
  researchUpgrades,
  revenueUpgrades,
  partnershipUpgrades,
  fundingRounds,
} from './gameData.js';
import { formatCurrency, formatNumber, getActiveModel } from './gameLogic.js';

class LineChart {
  constructor(canvas, color) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.color = color;
  }

  draw(values) {
    const ctx = this.ctx;
    const { width, height } = this.canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, 0, width, height);

    if (!values || values.length < 2) return;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = 12;
    const span = max - min || 1;

    ctx.beginPath();
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    values.forEach((value, index) => {
      const x = (index / (values.length - 1)) * (width - padding * 2) + padding;
      const normalized = (value - min) / span;
      const y = height - padding - normalized * (height - padding * 2);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `${this.color}55`);
    gradient.addColorStop(1, `${this.color}05`);
    ctx.lineTo(width - padding, height - padding);
    ctx.lineTo(padding, height - padding);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
  }
}

export class UIController {
  constructor(root, actions) {
    this.root = root;
    this.actions = actions;
    this.tabs = root.querySelectorAll('nav button');
    this.sections = root.querySelectorAll('.tab');
    this.activeTab = 'dashboard';
    this.chartControllers = {
      compute: new LineChart(root.querySelector('#computeChart'), '#2fb8ff'),
      revenue: new LineChart(root.querySelector('#revenueChart'), '#7cfbff'),
      power: new LineChart(root.querySelector('#powerChart'), '#7a8bff'),
    };
    this.bindTabNavigation();
    this.renderUpgrades();
    this.renderFunding();
    this.renderResearchTrees();
  }

  bindTabNavigation() {
    this.tabs.forEach((button) => {
      button.addEventListener('click', () => {
        const tab = button.dataset.tab;
        this.activeTab = tab;
        this.tabs.forEach((b) => b.classList.toggle('active', b === button));
        this.sections.forEach((section) => section.classList.toggle('active', section.id === tab));
      });
    });
  }

  renderDashboard(state) {
    this.root.querySelector('#computeStat').textContent = `${formatNumber(state.computeCapacity)} capacity`;
    const currentModel = getActiveModel(state);
    const trainedCount = state.completedModels.length;
    this.root.querySelector('#modelStat').textContent = currentModel
      ? `${currentModel.model.name} (${currentModel.progressPercent.toFixed(0)}%)`
      : `${trainedCount} deployed`;
    this.root.querySelector('#fundingStat').textContent = formatCurrency(state.funding);
    this.root.querySelector('#revenueStat').textContent = `${formatCurrency(state.revenuePerSecond)}`;
    this.root.querySelector('#researchStat').textContent = `${state.researchSpeed.toFixed(2)}x`;
    this.root.querySelector('#energyStat').textContent = `${formatNumber(state.energyUsage)} MW`; // approximate units

    this.chartControllers.compute.draw(state.history.compute);
    this.chartControllers.revenue.draw(state.history.revenue);
    this.chartControllers.power.draw(state.history.aiPower);

    const newsFeed = this.root.querySelector('#newsFeed');
    newsFeed.innerHTML = state.news
      .map((entry) => `<li>${entry}</li>`)
      .join('');
  }

  renderActiveResearch(state) {
    const container = this.root.querySelector('#activeResearch');
    const active = getActiveModel(state);
    if (!active) {
      container.innerHTML = '<p>No active model training. Select a model below to begin.</p>';
      return;
    }
    container.innerHTML = `
      <div class="infrastructure-card">
        <h3>${active.model.name} in training</h3>
        <p>${active.model.parameters} &bull; ${active.model.year}</p>
        <p>${active.model.description}</p>
        <div class="progress-bar"><span style="width: ${active.progressPercent}%"></span></div>
        <p>Progress: ${active.progressPercent.toFixed(1)}% &mdash; Compute in use: ${formatNumber(
          active.computeRequired
        )}</p>
      </div>
    `;
  }

  renderResearchTrees() {
    const container = this.root.querySelector('#researchTrees');
    const treeData = [
      { id: 'language', title: 'Language Models', list: languageModels },
      { id: 'image', title: 'Image Models', list: imageModels },
      { id: 'video', title: 'Video & World Simulation', list: videoModels },
      { id: 'audio', title: 'Audio & Voice', list: audioModels },
      { id: 'world', title: 'World & Systems Models', list: worldModels },
    ];
    container.innerHTML = treeData
      .map(
        (tree) => `
        <article class="tree-card" data-tree="${tree.id}">
          <h3>${tree.title}</h3>
          <div class="tree-list">
            ${tree.list
              .map(
                (model, index) => `
                  <div class="upgrade-card" data-model="${model.id}">
                    <h4>${model.name}</h4>
                    <p>${model.parameters || ''} ${model.year ? '&bull; ' + model.year : ''}</p>
                    <p>${model.description}</p>
                    <p>Cost: ${formatCurrency(model.cost)} &bull; Compute: ${formatNumber(model.computeRequired)}</p>
                    <button class="action" data-action="train" data-category="${tree.id}" data-index="${index}">
                      Train Model
                    </button>
                  </div>
                `
              )
              .join('')}
          </div>
        </article>
      `
      )
      .join('');

    container.querySelectorAll('button[data-action="train"]').forEach((button) => {
      button.addEventListener('click', () => {
        const category = button.dataset.category;
        const index = Number(button.dataset.index);
        this.actions.onStartResearch(category, index);
      });
    });
    this.researchButtons = Array.from(container.querySelectorAll('button[data-action="train"]'));
  }

  renderUpgrades(state = null) {
    this.renderUpgradeGroup('#computeUpgrades', computeUpgrades, 'compute', state);
    this.renderUpgradeGroup('#modelUpgrades', researchUpgrades, 'research', state);
    this.renderUpgradeGroup('#revenueUpgrades', revenueUpgrades, 'revenue', state);
    this.renderUpgradeGroup('#partnershipUpgrades', partnershipUpgrades, 'partnerships', state);
  }

  renderUpgradeGroup(selector, upgrades, type, state) {
    const container = this.root.querySelector(selector);
    container.innerHTML = `<h3>${type.charAt(0).toUpperCase() + type.slice(1)} Upgrades</h3>`;
    upgrades.forEach((upgrade) => {
      const purchased = state?.purchasedUpgrades?.has(upgrade.id) || false;
      const buttonLabel = purchased ? 'Purchased' : `Acquire (${formatCurrency(upgrade.cost)})`;
      const button = document.createElement('button');
      button.className = 'action';
      button.textContent = buttonLabel;
      button.disabled = purchased;
      button.addEventListener('click', () => this.actions.onPurchaseUpgrade(upgrade, type));

      const card = document.createElement('div');
      card.className = 'upgrade-card';
      card.innerHTML = `
        <h4>${upgrade.name}</h4>
        <p>${upgrade.description}</p>
        <p>Cost: ${formatCurrency(upgrade.cost)}</p>
      `;
      card.appendChild(button);
      container.appendChild(card);
    });
  }

  renderFunding(state) {
    const container = this.root.querySelector('#fundingRounds');
    container.innerHTML = '<h3>Funding Rounds</h3>';
    fundingRounds.forEach((round) => {
      const claimed = state?.fundingClaimed?.has(round.id);
      const button = document.createElement('button');
      button.className = 'action';
      button.textContent = claimed ? `Raised ${formatCurrency(round.amount)}` : `Raise ${round.name}`;
      button.disabled = !!claimed;
      button.addEventListener('click', () => this.actions.onRaiseFunding(round));

      const card = document.createElement('div');
      card.className = 'upgrade-card';
      card.innerHTML = `
        <h4>${round.name}</h4>
        <p>${round.description}</p>
        <p>Capital: ${formatCurrency(round.amount)} &bull; Terms: ${round.equity}</p>
      `;
      card.appendChild(button);
      container.appendChild(card);
    });
  }

  renderInfrastructure(state) {
    const container = this.root.querySelector('#infrastructureList');
    container.innerHTML = '';
    computeUpgrades.forEach((upgrade) => {
      const purchased = state.purchasedUpgrades.has(upgrade.id);
      const card = document.createElement('div');
      card.className = 'infrastructure-card';
      card.innerHTML = `
        <h3>${upgrade.name}</h3>
        <p>${upgrade.description}</p>
        <p>Compute Gain: +${formatNumber(upgrade.computeGain)} &bull; Energy Impact: ${formatNumber(
        upgrade.energyCost
      )} MW</p>
        <p>Cost: ${formatCurrency(upgrade.cost)}</p>
        <div class="progress-bar"><span style="width: ${purchased ? 100 : 0}%"></span></div>
      `;
      container.appendChild(card);
    });
  }

  refresh(state) {
    this.renderDashboard(state);
    this.renderActiveResearch(state);
    this.updateResearchButtons(state);
    this.renderUpgrades(state);
    this.renderFunding(state);
    this.renderInfrastructure(state);
    this.root.querySelector('#cashStat').textContent = formatCurrency(state.cash);
    this.root.querySelector('#expenseStat').textContent = `${formatCurrency(state.expensesPerSecond)} / sec`;
  }

  updateResearchButtons(state) {
    if (!this.researchButtons) return;
    const active = getActiveModel(state);
    this.researchButtons.forEach((button) => {
      const category = button.dataset.category;
      const index = Number(button.dataset.index);
      const modelList = {
        language: languageModels,
        image: imageModels,
        video: videoModels,
        audio: audioModels,
        world: worldModels,
      }[category];
      const model = modelList?.[index];
      if (!model) return;
      const unlockedCount = state.unlockedModels[category];
      const completed = state.completedModels.includes(model.id);
      const locked = index > unlockedCount;
      button.disabled = completed || locked || (!!active && active.model.id !== model.id);
      if (completed) {
        button.textContent = 'Deployed';
      } else if (locked) {
        button.textContent = 'Locked';
      } else if (active && active.model.id === model.id) {
        button.textContent = 'Training...';
      } else {
        button.textContent = `Train Model (${formatCurrency(model.cost)})`;
      }
    });
  }
}
