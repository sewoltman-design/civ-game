(function (global) {
  const logic = global.GameLogic || {};
  const storage = global.GameStorage || {};
  const UIController = global.UIController;
  if (!UIController) {
    console.error('UIController not available.');
    return;
  }

  const {
    advanceTime,
    createDefaultState,
    sanitizeState,
    purchaseUpgrade,
    unlockFunding,
    startResearch,
    serializeState,
  } = logic;

  const { saveGame, loadGame, clearGame } = storage;

  const root = document.getElementById('app');
  if (!root) {
    console.error('App root not found.');
    return;
  }

  let state = loadExistingState();
  const ui = new UIController(root, {
    onPurchaseUpgrade: handlePurchaseUpgrade,
    onRaiseFunding: handleFunding,
    onStartResearch: handleStartResearch,
  });

  const saveBtn = document.getElementById('saveBtn');
  const loadBtn = document.getElementById('loadBtn');
  const resetBtn = document.getElementById('resetBtn');

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      if (saveGame && serializeState) {
        saveGame(serializeState(state));
        flashMessage('Progress saved.');
      }
    });
  }

  if (loadBtn) {
    loadBtn.addEventListener('click', () => {
      const loaded = loadExistingState();
      state = loaded;
      ui.refresh(state);
      flashMessage('Save loaded.');
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Start a new company? This will erase current progress.')) {
        if (clearGame) {
          clearGame();
        }
        state = createDefaultState ? createDefaultState() : loadExistingState();
        ui.refresh(state);
        flashMessage('New company founded.');
      }
    });
  }

  let lastSave = 0;
  let lastTimestamp = performance.now();

  function loop(now) {
    const delta = Math.min(1, (now - lastTimestamp) / 1000);
    lastTimestamp = now;
    if (advanceTime) {
      advanceTime(state, delta);
    }
    ui.refresh(state);

    if (saveGame && serializeState && now - lastSave > 15000) {
      saveGame(serializeState(state));
      lastSave = now;
    }
    requestAnimationFrame(loop);
  }

  ui.refresh(state);
  requestAnimationFrame(loop);

  function handlePurchaseUpgrade(upgrade, type) {
    if (!purchaseUpgrade) return;
    const success = purchaseUpgrade(state, upgrade, type);
    if (!success) {
      flashMessage('Upgrade unavailable or insufficient funds.', true);
    } else {
      ui.refresh(state);
    }
  }

  function handleFunding(round) {
    if (!unlockFunding) return;
    const success = unlockFunding(state, round);
    if (!success) {
      flashMessage('Funding already raised.', true);
    } else {
      ui.refresh(state);
    }
  }

  function handleStartResearch(category, index) {
    if (!startResearch) return;
    const result = startResearch(state, category, index);
    const success = result && result.success;
    const reason = result && result.reason;
    if (!success) {
      flashMessage(reason || 'Cannot start research.', true);
    } else {
      ui.refresh(state);
    }
  }

  function loadExistingState() {
    const data = loadGame ? loadGame() : null;
    if (!data) return createDefaultState ? createDefaultState() : {};
    return sanitizeState ? sanitizeState(data) : data;
  }

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.style.position = 'fixed';
  toast.style.bottom = '24px';
  toast.style.right = '24px';
  toast.style.padding = '0.75rem 1rem';
  toast.style.background = 'rgba(4, 14, 36, 0.95)';
  toast.style.border = '1px solid rgba(47, 184, 255, 0.4)';
  toast.style.borderRadius = '12px';
  toast.style.color = '#e6f3ff';
  toast.style.opacity = '0';
  toast.style.transition = 'opacity 250ms ease, transform 250ms ease';
  toast.style.transform = 'translateY(12px)';
  toast.style.pointerEvents = 'none';
  document.body.appendChild(toast);

  let toastTimeout;
  function flashMessage(message, isError = false) {
    toast.textContent = message;
    toast.style.borderColor = isError ? 'rgba(255, 90, 90, 0.7)' : 'rgba(47, 184, 255, 0.4)';
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px)';
    }, 2000);
  }
})(window);
