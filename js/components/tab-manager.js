// js/components/tab-manager.js
// Tab State Management Component
// 
// Manages the state of assessment tabs:
// - Pending: Tab not yet loaded, grayed out
// - Loading: API call in progress, shows spinner
// - Ready: Data available, tab clickable
// - Error: API call failed, shows retry option

/**
 * Tab states enum
 */
const TabState = {
  PENDING: 'pending',
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error'
};

/**
 * Tab Manager Class
 * Manages the visual state and interactivity of assessment tabs
 */
class TabManager {
  constructor() {
    this.tabs = {
      overview: TabState.PENDING,
      team: TabState.PENDING,
      funding: TabState.PENDING,
      competitive: TabState.PENDING,
      market: TabState.PENDING,
      iprisk: TabState.PENDING,
      summary: TabState.PENDING
    };
    
    this.activeTab = null;
    this.listeners = [];
    this.tabButtons = {};
    this.tabPanels = {};
  }

  /**
   * Initialize tab manager
   */
  init() {
    // Cache DOM elements
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const tabId = btn.dataset.tab;
      this.tabButtons[tabId] = btn;
      
      // Add click handler
      btn.addEventListener('click', () => this.handleTabClick(tabId));
    });
    
    document.querySelectorAll('.tab-panel').forEach(panel => {
      const tabId = panel.id.replace('panel-', '');
      this.tabPanels[tabId] = panel;
    });
    
    // Apply initial states
    this.updateAllVisuals();
    
    console.log('TabManager initialized');
  }

  /**
   * Handle tab click
   * @param {string} tabId - Tab identifier
   */
  handleTabClick(tabId) {
    if (this.tabs[tabId] !== TabState.READY) {
      return; // Only allow clicking ready tabs
    }
    
    this.activateTab(tabId);
  }

  /**
   * Activate a specific tab
   * @param {string} tabId - Tab identifier
   */
  activateTab(tabId) {
    if (this.activeTab === tabId) return;
    
    // Deactivate current tab
    if (this.activeTab && this.tabButtons[this.activeTab]) {
      this.tabButtons[this.activeTab].setAttribute('aria-selected', 'false');
    }
    if (this.activeTab && this.tabPanels[this.activeTab]) {
      this.tabPanels[this.activeTab].hidden = true;
    }
    
    // Activate new tab
    this.activeTab = tabId;
    
    if (this.tabButtons[tabId]) {
      this.tabButtons[tabId].setAttribute('aria-selected', 'true');
    }
    if (this.tabPanels[tabId]) {
      this.tabPanels[tabId].hidden = false;
    }
    
    // Notify listeners
    this.notifyListeners('tabActivated', { tabId });
  }

  /**
   * Set tab state
   * @param {string} tabId - Tab identifier
   * @param {string} state - New state from TabState enum
   */
  setState(tabId, state) {
    if (!this.tabs.hasOwnProperty(tabId)) {
      console.warn(`Unknown tab: ${tabId}`);
      return;
    }
    
    const previousState = this.tabs[tabId];
    this.tabs[tabId] = state;
    
    this.updateTabVisual(tabId);
    
    // Notify listeners
    this.notifyListeners('stateChange', { 
      tabId, 
      previousState, 
      newState: state 
    });
    
    // Auto-activate first ready tab if none active
    if (state === TabState.READY && !this.activeTab) {
      this.activateTab(tabId);
    }
  }

  /**
   * Enable a tab (set to ready state)
   * @param {string} tabId - Tab identifier
   */
  enableTab(tabId) {
    this.setState(tabId, TabState.READY);
  }

  /**
   * Set tab to loading state
   * @param {string} tabId - Tab identifier
   */
  setLoading(tabId) {
    this.setState(tabId, TabState.LOADING);
  }

  /**
   * Set tab to error state
   * @param {string} tabId - Tab identifier
   */
  setError(tabId) {
    this.setState(tabId, TabState.ERROR);
  }

  /**
   * Get current tab states
   * @returns {Object} Current state of all tabs
   */
  getStates() {
    return { ...this.tabs };
  }

  /**
   * Get state of a specific tab
   * @param {string} tabId - Tab identifier
   * @returns {string} Tab state
   */
  getState(tabId) {
    return this.tabs[tabId];
  }

  /**
   * Check if all required tabs are ready
   * @returns {boolean} True if all assessment tabs are ready
   */
  allReady() {
    const required = ['overview', 'team', 'funding', 'competitive', 'market', 'iprisk'];
    return required.every(tab => this.tabs[tab] === TabState.READY);
  }

  /**
   * Get count of ready tabs
   * @returns {number} Number of ready tabs
   */
  getReadyCount() {
    const assessmentTabs = ['overview', 'team', 'funding', 'competitive', 'market', 'iprisk'];
    return assessmentTabs.filter(tab => this.tabs[tab] === TabState.READY).length;
  }

  /**
   * Get total assessment tab count
   * @returns {number} Total number of assessment tabs
   */
  getTotalCount() {
    return 6; // overview, team, funding, competitive, market, iprisk
  }

  /**
   * Subscribe to state changes
   * @param {Function} callback - Function to call on state change
   */
  onStateChange(callback) {
    this.listeners.push(callback);
  }

  /**
   * Notify all listeners
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Tab listener error:', error);
      }
    });
  }

  /**
   * Reset all tabs to pending state
   */
  reset() {
    this.activeTab = null;
    
    Object.keys(this.tabs).forEach(tab => {
      this.tabs[tab] = TabState.PENDING;
    });
    
    this.updateAllVisuals();
    
    // Hide all panels
    Object.values(this.tabPanels).forEach(panel => {
      panel.hidden = true;
    });
  }

  /**
   * Update visual appearance of all tabs
   */
  updateAllVisuals() {
    Object.keys(this.tabs).forEach(tabId => {
      this.updateTabVisual(tabId);
    });
  }

  /**
   * Update visual appearance of a single tab
   * @param {string} tabId - Tab identifier
   */
  updateTabVisual(tabId) {
    const btn = this.tabButtons[tabId];
    if (!btn) return;
    
    const state = this.tabs[tabId];
    const statusEl = btn.querySelector('.tab-status');
    
    // Update disabled state
    btn.disabled = state !== TabState.READY;
    
    // Update status indicator with appropriate icon
    if (statusEl) {
      statusEl.className = 'tab-status ' + state;
      
      // Add spinning indicator for loading state
      if (state === TabState.LOADING) {
        statusEl.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="tab-spinner">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        `;
        statusEl.style.width = 'auto';
        statusEl.style.height = 'auto';
        statusEl.style.background = 'none';
      } else {
        statusEl.innerHTML = '';
        statusEl.style.width = '';
        statusEl.style.height = '';
        statusEl.style.background = '';
      }
    }
    
    // Add/remove CSS classes
    btn.classList.remove('pending', 'loading', 'ready', 'error');
    btn.classList.add(state);
  }

  /**
   * Enable summary tab when all assessments are complete
   */
  checkSummaryReady() {
    if (this.allReady()) {
      this.enableTab('summary');
    }
  }
}

// Export for use in other modules
window.TabManager = TabManager;
window.TabState = TabState;
