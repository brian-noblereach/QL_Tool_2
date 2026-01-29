// js/core/state-manager.js
// State Persistence Component
//
// Manages localStorage operations for:
// - Checkpointing analysis progress
// - Recovering from interruptions
// - Multi-venture state isolation
// - Caching full assessments for reload
// - Tracking Smartsheet row IDs for updates

class StateManager {
  constructor() {
    this.storageKey = 'noblereach_qa_state';
    this.assessmentCacheKey = 'noblereach_assessments';
    this.version = '2.1'; // Bumped for new assessment caching
  }

  init() {
    console.log('StateManager initialized');
    // Migrate old data if needed
    this.migrateIfNeeded();
  }

  // ========== CURRENT SESSION STATE ==========

  checkpoint(phaseKey, phaseData) {
    const currentState = this.getState() || this.createEmptyState();
    
    currentState.completedPhases = currentState.completedPhases || {};
    currentState.completedPhases[phaseKey] = phaseData;
    currentState.timestamp = Date.now();
    currentState.status = 'in_progress';
    
    this.saveState(currentState);
    console.log('Checkpoint saved:', phaseKey);
  }

  hasIncompleteAnalysis() {
    const state = this.getState();
    if (!state) return false;
    
    // Check if status is in_progress and has some completed phases
    if (state.status !== 'in_progress') return false;
    
    const completedCount = Object.keys(state.completedPhases || {}).length;
    return completedCount > 0 && completedCount < 6;
  }

  getState() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (!saved) return null;
      
      const state = JSON.parse(saved);
      
      // Version check - allow 2.0 and 2.1
      if (state.version && !state.version.startsWith('2.')) {
        console.log('State version mismatch, clearing');
        this.clearState();
        return null;
      }
      
      return state;
    } catch (error) {
      console.error('Error reading state:', error);
      return null;
    }
  }

  saveState(state) {
    try {
      state.version = this.version;
      localStorage.setItem(this.storageKey, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving state:', error);
    }
  }

  clearState() {
    localStorage.removeItem(this.storageKey);
    console.log('State cleared');
  }

  createEmptyState() {
    return {
      version: this.version,
      timestamp: Date.now(),
      status: 'idle',
      companyInput: null,
      completedPhases: {},
      userScores: {},
      scaName: null,
      smartsheetRowId: null,
      assessmentKey: null,
      finalRecommendation: '',
      customVentureName: null
    };
  }

  setCompanyInput(url, scaName, fileName = null) {
    const state = this.getState() || this.createEmptyState();
    state.companyInput = { url, scaName, fileName };
    state.scaName = scaName;
    state.status = 'in_progress';
    state.timestamp = Date.now();
    state.assessmentKey = this.generateAssessmentKey(url, scaName, fileName);
    this.saveState(state);
  }

  getCompanyInput() {
    const state = this.getState();
    return state ? state.companyInput : null;
  }

  saveUserScore(dimension, scoreData) {
    const state = this.getState();
    if (!state) return;
    
    state.userScores = state.userScores || {};
    state.userScores[dimension] = scoreData;
    state.timestamp = Date.now();
    this.saveState(state);
  }

  getUserScores() {
    const state = this.getState();
    return state ? state.userScores : {};
  }

  /**
   * Save final recommendation text
   * @param {string} text - The recommendation text
   */
  saveFinalRecommendation(text) {
    const state = this.getState();
    if (!state) return;
    state.finalRecommendation = text;
    state.timestamp = Date.now();
    this.saveState(state);
  }

  /**
   * Get saved final recommendation text
   * @returns {string} The recommendation text or empty string
   */
  getFinalRecommendation() {
    const state = this.getState();
    return state?.finalRecommendation || '';
  }

  /**
   * Save custom venture name (user override of AI-generated name)
   * @param {string} name - The custom venture name
   */
  saveCustomVentureName(name) {
    const state = this.getState();
    if (!state) return;
    state.customVentureName = name || null;
    state.timestamp = Date.now();
    this.saveState(state);
  }

  /**
   * Get custom venture name if set
   * @returns {string|null} The custom name or null
   */
  getCustomVentureName() {
    const state = this.getState();
    return state?.customVentureName || null;
  }

  markComplete() {
    const state = this.getState();
    if (state) {
      state.status = 'complete';
      state.timestamp = Date.now();
      this.saveState(state);
    }
  }

  getProgressSummary() {
    const state = this.getState();
    if (!state) return null;
    
    const totalPhases = 6;
    const completedCount = Object.keys(state.completedPhases || {}).length;
    
    return {
      companyUrl: state.companyInput?.url || 'Unknown',
      scaName: state.companyInput?.scaName || state.scaName || '',
      completedCount,
      totalPhases,
      percentage: Math.round((completedCount / totalPhases) * 100),
      timestamp: state.timestamp,
      status: state.status,
      completedPhases: state.completedPhases || {},
      userScores: state.userScores || {}
    };
  }

  getCompletedPhases() {
    const state = this.getState();
    return state ? state.completedPhases || {} : {};
  }

  isPhaseComplete(phaseKey) {
    const state = this.getState();
    return state && state.completedPhases && !!state.completedPhases[phaseKey];
  }

  restoreFromState() {
    const state = this.getState();
    if (!state) return null;
    
    return {
      companyInput: state.companyInput,
      completedPhases: state.completedPhases || {},
      userScores: state.userScores || {}
    };
  }

  // ========== SMARTSHEET ROW ID TRACKING ==========

  /**
   * Save Smartsheet row ID for updates
   * @param {string} rowId - The Smartsheet row ID
   */
  saveSmartsheetRowId(rowId) {
    const state = this.getState();
    if (state) {
      state.smartsheetRowId = rowId;
      state.timestamp = Date.now();
      this.saveState(state);
      console.log('Smartsheet row ID saved:', rowId);
    }
  }

  /**
   * Get stored Smartsheet row ID
   * @returns {string|null} The row ID or null
   */
  getSmartsheetRowId() {
    const state = this.getState();
    return state ? state.smartsheetRowId : null;
  }

  // ========== ASSESSMENT KEY GENERATION ==========

  /**
   * Generate unique assessment key
   * @param {string} url - Company URL
   * @param {string} advisorName - Advisor name
   * @param {string} fileName - Optional file name
   * @returns {string} Unique key
   */
  generateAssessmentKey(url, advisorName, fileName = null) {
    // Normalize URL to domain
    let identifier = '';
    if (url) {
      try {
        const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
        identifier = parsed.hostname.replace('www.', '');
      } catch {
        identifier = url.toLowerCase().replace(/[^a-z0-9]/g, '');
      }
    } else if (fileName) {
      // Use file name without extension as identifier
      identifier = fileName.replace(/\.[^/.]+$/, '').toLowerCase().replace(/[^a-z0-9]/g, '-');
    }
    
    const advisor = (advisorName || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${identifier}_${advisor}`;
  }

  /**
   * Get the current assessment key
   * @returns {string|null} The assessment key
   */
  getAssessmentKey() {
    const state = this.getState();
    return state ? state.assessmentKey : null;
  }

  // ========== ASSESSMENT CACHING ==========

  /**
   * Cache a full assessment for later reload
   * @param {Object} data - Full assessment data including AI outputs
   */
  cacheFullAssessment(data) {
    try {
      const state = this.getState();
      if (!state || !state.assessmentKey) {
        console.warn('Cannot cache assessment: no assessment key');
        return;
      }

      const cache = this.getAssessmentCache();
      
      // Build cached assessment object
      const cachedAssessment = {
        key: state.assessmentKey,
        timestamp: Date.now(),
        companyInput: state.companyInput,
        smartsheetRowId: state.smartsheetRowId,
        userScores: state.userScores,
        aiData: {
          company: data.company || null,
          team: data.team || null,
          funding: data.funding || null,
          competitive: data.competitive || null,
          market: data.market || null,
          iprisk: data.iprisk || null
        },
        ventureName: data.ventureName || this.extractVentureName(data),
        advisorName: state.scaName || state.companyInput?.scaName || 'Unknown'
      };

      // Store in cache (keyed by assessment key)
      cache[state.assessmentKey] = cachedAssessment;
      
      // Keep only last 50 assessments to avoid localStorage limits
      const keys = Object.keys(cache);
      if (keys.length > 50) {
        // Remove oldest entries
        const sorted = keys.sort((a, b) => (cache[a].timestamp || 0) - (cache[b].timestamp || 0));
        for (let i = 0; i < keys.length - 50; i++) {
          delete cache[sorted[i]];
        }
      }

      this.saveAssessmentCache(cache);
      console.log('Assessment cached:', state.assessmentKey);
    } catch (error) {
      console.error('Error caching assessment:', error);
    }
  }

  /**
   * Extract venture name from data
   * @param {Object} data - Assessment data
   * @returns {string} Venture name
   */
  extractVentureName(data) {
    if (data.company?.company_overview?.name) {
      return data.company.company_overview.name;
    }
    const state = this.getState();
    if (state?.companyInput?.url) {
      try {
        const parsed = new URL(state.companyInput.url.startsWith('http') ? state.companyInput.url : `https://${state.companyInput.url}`);
        return parsed.hostname.replace('www.', '');
      } catch {
        return state.companyInput.url;
      }
    }
    if (state?.companyInput?.fileName) {
      return state.companyInput.fileName.replace(/\.[^/.]+$/, '');
    }
    return 'Unknown Venture';
  }

  /**
   * Get the assessment cache object
   * @returns {Object} Cache object
   */
  getAssessmentCache() {
    try {
      const saved = localStorage.getItem(this.assessmentCacheKey);
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.error('Error reading assessment cache:', error);
      return {};
    }
  }

  /**
   * Save the assessment cache
   * @param {Object} cache - Cache object to save
   */
  saveAssessmentCache(cache) {
    try {
      localStorage.setItem(this.assessmentCacheKey, JSON.stringify(cache));
    } catch (error) {
      console.error('Error saving assessment cache:', error);
      // If localStorage is full, try to clear oldest entries
      if (error.name === 'QuotaExceededError') {
        this.pruneAssessmentCache();
        try {
          localStorage.setItem(this.assessmentCacheKey, JSON.stringify(cache));
        } catch (e) {
          console.error('Still cannot save after pruning:', e);
        }
      }
    }
  }

  /**
   * Prune old assessments from cache
   */
  pruneAssessmentCache() {
    const cache = this.getAssessmentCache();
    const keys = Object.keys(cache);
    if (keys.length > 20) {
      const sorted = keys.sort((a, b) => (cache[a].timestamp || 0) - (cache[b].timestamp || 0));
      for (let i = 0; i < keys.length - 20; i++) {
        delete cache[sorted[i]];
      }
      this.saveAssessmentCache(cache);
    }
  }

  /**
   * List all cached assessments with metadata
   * @returns {Array} List of assessment summaries
   */
  listPastAssessments() {
    const cache = this.getAssessmentCache();
    const assessments = Object.values(cache).map(a => ({
      key: a.key,
      ventureName: a.ventureName || 'Unknown',
      advisorName: a.advisorName || 'Unknown',
      timestamp: a.timestamp,
      date: new Date(a.timestamp).toLocaleDateString(),
      hasFullData: !!(a.aiData && Object.values(a.aiData).some(v => v !== null)),
      companyUrl: a.companyInput?.url || '',
      fileName: a.companyInput?.fileName || '',
      smartsheetRowId: a.smartsheetRowId
    }));
    
    // Sort by most recent first
    return assessments.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }

  /**
   * Load a cached assessment by key
   * @param {string} key - Assessment key
   * @returns {Object|null} Full assessment data
   */
  loadAssessment(key) {
    const cache = this.getAssessmentCache();
    return cache[key] || null;
  }

  /**
   * Check if an assessment exists in cache
   * @param {string} key - Assessment key
   * @returns {boolean} True if exists
   */
  hasAssessment(key) {
    const cache = this.getAssessmentCache();
    return !!cache[key];
  }

  /**
   * Delete a cached assessment
   * @param {string} key - Assessment key
   */
  deleteAssessment(key) {
    const cache = this.getAssessmentCache();
    if (cache[key]) {
      delete cache[key];
      this.saveAssessmentCache(cache);
      console.log('Assessment deleted from cache:', key);
    }
  }

  // ========== MIGRATION ==========

  /**
   * Migrate old data format if needed
   */
  migrateIfNeeded() {
    const state = this.getState();
    if (state && state.version === '2.0') {
      // Migrate 2.0 to 2.1 - just add missing fields
      state.version = this.version;
      if (!state.smartsheetRowId) state.smartsheetRowId = null;
      if (!state.assessmentKey) state.assessmentKey = null;
      this.saveState(state);
      console.log('Migrated state from 2.0 to 2.1');
    }
  }
}

window.StateManager = StateManager;
