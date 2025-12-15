// js/core/state-manager.js
// State Persistence Component
//
// Manages localStorage operations for:
// - Checkpointing analysis progress
// - Recovering from interruptions
// - Multi-venture state isolation

class StateManager {
  constructor() {
    this.storageKey = 'noblereach_qa_state';
    this.version = '2.0';
  }

  init() {
    console.log('StateManager initialized');
  }

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
      
      // Version check
      if (state.version !== this.version) {
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
      scaName: null
    };
  }

  setCompanyInput(url, scaName) {
    const state = this.getState() || this.createEmptyState();
    state.companyInput = { url, scaName };
    state.scaName = scaName;
    state.status = 'in_progress';
    state.timestamp = Date.now();
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
}

window.StateManager = StateManager;
