// js/core/app.js - Main application controller (V02)
// Updated with progressive display, state persistence, and component integration

class App {
  constructor() {
    this.pipeline = null;
    this.progressView = null;
    this.assessmentView = null;
    this.summaryView = null;
    this.tabManager = null;
    this.toastManager = null;
    this.modalManager = null;
    this.stateManager = null;
    this.state = 'idle'; // idle, analyzing, results, error
  }

  async init() {
    try {
      console.log('Initializing Venture Assessment Platform v02...');
      
      // Initialize managers
      this.stateManager = new StateManager();
      this.stateManager.init();
      
      this.tabManager = new TabManager();
      this.tabManager.init();
      
      this.toastManager = new ToastManager();
      this.toastManager.init();
      
      this.modalManager = new ModalManager();
      this.modalManager.init();
      
      // Initialize views
      this.pipeline = new AnalysisPipeline();
      this.progressView = new ProgressView();
      this.assessmentView = new AssessmentView();
      this.summaryView = new SummaryView();
      
      this.progressView.init();
      this.assessmentView.init();
      this.summaryView.init();
      
      // Make accessible globally
      window.assessmentView = this.assessmentView;
      window.summaryView = this.summaryView;
      window.tabManager = this.tabManager;
      
      // Setup event listeners
      this.setupEventListeners();
      this.setupPipelineCallbacks();
      this.setupTabCallbacks();
      
      // Check for incomplete analysis
      await this.checkForIncompleteAnalysis();
      
      // Setup pilot banner
      this.setupPilotBanner();
      
      console.log('Application initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize application:', error);
      this.toastManager?.error('Failed to initialize application. Please refresh the page.');
    }
  }

  setupEventListeners() {
    // Form submission
    const form = document.getElementById('assessment-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.startAnalysis();
      });
    }
    
    // New assessment button
    const newBtn = document.getElementById('new-assessment-btn');
    if (newBtn) {
      newBtn.addEventListener('click', () => this.resetAnalysis());
    }
    
    // Export button
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportReport());
    }
    
    // Cancel button
    const cancelBtn = document.getElementById('cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.cancelAnalysis());
    }
  }

  setupPipelineCallbacks() {
    this.pipeline.on('start', (data) => {
      this.state = 'analyzing';
      console.log('Analysis started:', data.url);
    });
    
    this.pipeline.on('phaseStart', (data) => {
      this.tabManager.setLoading(data.phase === 'company' ? 'overview' : data.phase);
      this.updatePhaseUI(data.phase, 'active');
    });
    
    this.pipeline.on('phaseComplete', (data) => {
      const tabKey = data.phase === 'company' ? 'overview' : data.phase;
      
      // Enable tab
      this.tabManager.enableTab(tabKey);
      
      // Update phase list UI
      this.updatePhaseUI(data.phase, 'complete');
      
      // Save checkpoint
      this.stateManager.checkpoint(data.phase, data.data);
      
      // Load data into view
      this.loadPhaseData(data.phase, data.data);
      
      // Show toast notification
      const phaseNames = {
        company: 'Company Overview',
        team: 'Team Analysis',
        funding: 'Funding Analysis',
        competitive: 'Competitive Risk',
        market: 'Market Opportunity',
        iprisk: 'IP Risk'
      };
      
      this.toastManager.phaseComplete(phaseNames[data.phase], () => {
        this.tabManager.activateTab(tabKey);
      });
      
      // Update compact progress
      this.updateCompactProgress();
      
      // Check if all done
      if (this.tabManager.allReady()) {
        this.tabManager.enableTab('summary');
        this.updateCompactProgress(true);
      }
    });
    
    this.pipeline.on('phaseError', (data) => {
      const tabKey = data.phase === 'company' ? 'overview' : data.phase;
      this.tabManager.setError(tabKey);
      this.updatePhaseUI(data.phase, 'error');
      
      this.toastManager.phaseError(data.name, () => {
        this.retryPhase(data.phase);
      });
    });
    
    this.pipeline.on('overviewReady', (data) => {
      // Switch to results view after company analysis
      this.showSection('results');
      this.tabManager.activateTab('overview');
    });
    
    this.pipeline.on('complete', (results) => {
      this.handleAnalysisComplete(results);
    });
    
    this.pipeline.on('error', (error) => {
      this.handleAnalysisError(error);
    });
    
    this.pipeline.on('cancelled', () => {
      this.handleAnalysisCancelled();
    });
    
    this.pipeline.on('partialComplete', (data) => {
      this.handlePartialComplete(data);
    });
  }

  setupTabCallbacks() {
    this.tabManager.onStateChange((event, data) => {
      if (event === 'tabActivated') {
        // Update URL hash for deep linking (optional)
        // history.replaceState(null, '', '#' + data.tabId);
      }
    });
  }

  async checkForIncompleteAnalysis() {
    if (this.stateManager.hasIncompleteAnalysis()) {
      const savedState = this.stateManager.getState();
      const choice = await this.modalManager.showResumeModal(savedState);
      
      if (choice === 'resume') {
        await this.resumeAnalysis(savedState);
      } else {
        this.stateManager.clearState();
      }
    }
  }

  setupPilotBanner() {
    const closeBtn = document.getElementById('pilot-close');
    const feedbackBtn = document.getElementById('feedback-btn');
    const banner = document.getElementById('pilot-banner');
    
    if (closeBtn && banner) {
      closeBtn.addEventListener('click', () => {
        banner.style.display = 'none';
        localStorage.setItem('pilot_banner_closed', 'true');
      });
      
      // Check if previously closed
      if (localStorage.getItem('pilot_banner_closed') === 'true') {
        banner.style.display = 'none';
      }
    }
    
    if (feedbackBtn) {
      feedbackBtn.addEventListener('click', () => {
        // Open feedback form - placeholder URL
        window.open('https://forms.office.com/r/YOUR_FORM_ID', '_blank');
      });
    }
  }

  async startAnalysis() {
    const urlInput = document.getElementById('company-url');
    const scaInput = document.getElementById('sca-name');
    
    if (!urlInput) return;
    
    const url = urlInput.value.trim();
    const scaName = scaInput?.value.trim() || '';
    
    if (!url) {
      this.showValidationError(urlInput, 'Please enter a company website URL');
      return;
    }
    
    const validation = Validators.validateUrl(url);
    if (!validation.valid) {
      this.showValidationError(urlInput, validation.error);
      return;
    }
    
    // Save input to state
    this.stateManager.setCompanyInput(validation.url, scaName);
    
    // Request notification permission
    await this.requestNotificationPermission();
    
    try {
      // Show progress section
      this.showSection('progress');
      document.getElementById('progress-company-name').textContent = 'Analyzing: ' + validation.url;
      
      // Reset tab states
      this.tabManager.reset();
      
      // Start progress tracking
      this.progressView.start(this.pipeline);
      
      // Run analysis
      await this.pipeline.start(validation.url);
      
    } catch (error) {
      console.error('Analysis failed:', error);
      this.handleAnalysisError(error);
    }
  }

  async resumeAnalysis(savedState) {
    const completedPhases = savedState.completedPhases || {};
    const userScores = savedState.userScores || {};
    
    // Show results section
    this.showSection('results');
    
    // Load completed phases
    Object.entries(completedPhases).forEach(([phase, data]) => {
      const tabKey = phase === 'company' ? 'overview' : phase;
      this.tabManager.enableTab(tabKey);
      this.loadPhaseData(phase, data);
    });
    
    // Restore user scores
    Object.entries(userScores).forEach(([dimension, scoreData]) => {
      this.assessmentView.setUserScore(dimension, scoreData);
    });
    
    // Activate first available tab
    if (completedPhases.company) {
      this.tabManager.activateTab('overview');
    }
    
    // Update compact progress
    this.updateCompactProgress();
    
    // Show toast
    this.toastManager.info('Previous analysis restored. Some phases may need to be re-run.');
    
    // TODO: Option to continue remaining phases
  }

  loadPhaseData(phase, data) {
    switch (phase) {
      case 'company':
        this.assessmentView.loadCompanyData(data);
        break;
      case 'team':
        this.assessmentView.loadTeamData(data);
        break;
      case 'funding':
        this.assessmentView.loadFundingData(data);
        break;
      case 'competitive':
        this.assessmentView.loadCompetitiveData(data);
        break;
      case 'market':
        this.assessmentView.loadMarketData(data);
        break;
      case 'iprisk':
        this.assessmentView.loadIpRiskData(data);
        break;
    }
  }

  updatePhaseUI(phase, status) {
    const phaseItem = document.querySelector(`.phase-item[data-phase="${phase}"]`);
    if (!phaseItem) return;
    
    // Remove previous status classes
    phaseItem.classList.remove('pending', 'active', 'complete', 'error');
    phaseItem.classList.add(status);
    
    // Update status text
    const statusEl = phaseItem.querySelector('.phase-status');
    if (statusEl) {
      const statusText = {
        pending: 'Pending',
        active: 'In Progress...',
        complete: 'Complete',
        error: 'Failed'
      };
      statusEl.textContent = statusText[status] || status;
    }
    
    // Update icon
    const iconEl = phaseItem.querySelector('.phase-icon');
    if (iconEl) {
      if (status === 'active') {
        iconEl.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>';
      } else if (status === 'complete') {
        iconEl.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
      } else if (status === 'error') {
        iconEl.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
      }
    }
  }

  updateCompactProgress(allComplete = false) {
    const compactProgress = document.getElementById('compact-progress');
    if (!compactProgress) return;
    
    const readyCount = this.tabManager.getReadyCount();
    const totalCount = this.tabManager.getTotalCount();
    
    if (allComplete) {
      compactProgress.classList.add('hidden');
      return;
    }
    
    if (readyCount > 0 && readyCount < totalCount) {
      compactProgress.classList.remove('hidden');
      
      document.getElementById('compact-progress-text').textContent = `${readyCount} of ${totalCount} complete`;
      document.getElementById('compact-progress-fill').style.width = `${(readyCount / totalCount) * 100}%`;
      
      // More accurate remaining time estimate
      // After company completes, parallel phases take ~3 min, then market takes ~4 min
      const progress = this.pipeline?.getProgress();
      if (progress && progress.remaining > 0) {
        const remainingMin = Math.ceil(progress.remaining / 60);
        document.getElementById('compact-progress-time').textContent = `~${remainingMin} min remaining`;
      } else {
        document.getElementById('compact-progress-time').textContent = 'Almost done...';
      }
    }
  }

  async retryPhase(phase) {
    try {
      this.tabManager.setLoading(phase === 'company' ? 'overview' : phase);
      this.updatePhaseUI(phase, 'active');
      
      await this.pipeline.retryPhase(phase);
    } catch (error) {
      console.error('Retry failed:', error);
      this.toastManager.error(`Retry failed: ${error.message}`);
    }
  }

  handleAnalysisComplete(results) {
    this.state = 'results';
    
    // Mark state as complete
    this.stateManager.markComplete();
    
    // Enable export button
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) exportBtn.disabled = false;
    
    // Desktop notification
    const companyName = results.company?.company_overview?.name || 'Company';
    this.showDesktopNotification(
      'Analysis Complete!',
      `${companyName} assessment is ready for review`
    );
    
    // Update summary
    this.summaryView.update(results);
    
    // Hide compact progress
    const compactProgress = document.getElementById('compact-progress');
    if (compactProgress) compactProgress.classList.add('hidden');
    
    // Toast
    this.toastManager.success('All analyses complete! You can now export the report.');
  }

  handleAnalysisError(error) {
    this.state = 'error';
    this.progressView.hide();
    this.toastManager.error(error.message || 'An unexpected error occurred');
  }

  handleAnalysisCancelled() {
    this.state = 'idle';
    this.progressView.hide();
    this.showSection('input');
    this.toastManager.info('Analysis cancelled');
  }

  handlePartialComplete(data) {
    this.state = 'results';
    
    // Some phases failed, but we can still show partial results
    const failedCount = data.failedPhases.length;
    const successCount = this.tabManager.getReadyCount();
    
    // Enable export button for partial export
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) exportBtn.disabled = false;
    
    // Hide progress section
    this.progressView.hide();
    
    // Update compact progress to show completion (with failures)
    const compactProgress = document.getElementById('compact-progress');
    if (compactProgress) {
      document.getElementById('compact-progress-text').textContent = 
        `${successCount} of ${successCount + failedCount} complete (${failedCount} failed)`;
    }
    
    // Show warning toast
    this.toastManager.warning(
      `Analysis completed with ${failedCount} failed phase(s). You can retry failed phases or export partial results.`
    );
  }

  cancelAnalysis() {
    if (this.state !== 'analyzing') return;
    
    const confirmed = confirm('Are you sure you want to cancel the analysis?');
    if (confirmed) {
      this.pipeline.cancel();
    }
  }

  resetAnalysis() {
    if (this.state === 'analyzing') {
      const confirmed = confirm('Analysis in progress. Are you sure you want to start over?');
      if (!confirmed) return;
      this.pipeline.cancel();
    }
    
    // Clear state
    this.stateManager.clearState();
    this.state = 'idle';
    this.pipeline.reset();
    this.progressView.reset();
    this.tabManager.reset();
    
    // Clear inputs
    const urlInput = document.getElementById('company-url');
    const scaInput = document.getElementById('sca-name');
    if (urlInput) urlInput.value = '';
    if (scaInput) scaInput.value = '';
    
    // Disable export
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) exportBtn.disabled = true;
    
    // Show input section
    this.showSection('input');
  }

  async exportReport() {
    try {
      // Check if all phases complete
      if (!this.tabManager.allReady()) {
        const exportStatus = {};
        ['company', 'team', 'funding', 'competitive', 'market', 'iprisk'].forEach(phase => {
          const tabKey = phase === 'company' ? 'overview' : phase;
          exportStatus[phase] = this.tabManager.getState(tabKey) === TabState.READY ? 'complete' : 'pending';
        });
        
        const confirmed = await this.modalManager.showPartialExportModal(exportStatus);
        if (!confirmed) return;
      }
      
      if (!window.jspdf) {
        throw new Error('PDF library not loaded. Please refresh the page.');
      }
      
      const data = this.assessmentView.getExportData();
      
      this.showExportProgress();
      const filename = await ExportUtility.generateReport(data);
      this.hideExportProgress();
      
      // Submit all scores to Smartsheet on export
      await this.submitAllScoresToSmartsheet();
      
      this.toastManager.success(`Report exported: ${filename}`);
      
    } catch (error) {
      console.error('Export failed:', error);
      this.hideExportProgress();
      this.toastManager.error(`Export failed: ${error.message}`);
    }
  }

  showValidationError(input, message) {
    input.style.borderColor = 'var(--brand-error)';
    input.focus();
    
    let errorEl = input.parentElement.querySelector('.validation-error');
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.className = 'validation-error';
      errorEl.style.cssText = 'color: var(--brand-error); font-size: 12px; margin-top: 4px;';
      input.parentElement.appendChild(errorEl);
    }
    
    errorEl.textContent = message;
    
    setTimeout(() => {
      input.style.borderColor = '';
      if (errorEl) errorEl.remove();
    }, 5000);
  }

  showSection(section) {
    const sections = {
      input: document.getElementById('input-section'),
      progress: document.getElementById('progress-section'),
      results: document.getElementById('results-section')
    };
    
    Object.entries(sections).forEach(([key, el]) => {
      if (el) {
        el.classList.toggle('hidden', key !== section);
      }
    });
  }

  showExportProgress() {
    const overlay = document.createElement('div');
    overlay.id = 'exportOverlay';
    overlay.className = 'modal-overlay visible';
    overlay.innerHTML = '<div class="modal-content" style="text-align: center; padding: 40px;"><div class="spin" style="width: 40px; height: 40px; border: 3px solid var(--slate-200); border-top-color: var(--nr-teal-1); border-radius: 50%; margin: 0 auto 16px;"></div><p>Generating PDF report...</p></div>';
    document.body.appendChild(overlay);
  }

  hideExportProgress() {
    const overlay = document.getElementById('exportOverlay');
    if (overlay) overlay.remove();
  }

  async requestNotificationPermission() {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission !== "denied") {
      try {
        const permission = await Notification.requestPermission();
        return permission === "granted";
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  showDesktopNotification(title, body) {
    if (Notification.permission === "granted") {
      const notification = new Notification(title, {
        body,
        icon: 'assets/favicon.svg',
        tag: 'analysis-complete',
        requireInteraction: true
      });
      
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      
      setTimeout(() => notification.close(), 30000);
    }
  }

  /**
   * Submit all scores to Smartsheet on export
   */
  async submitAllScoresToSmartsheet() {
    if (!window.SmartsheetIntegration) {
      console.warn('SmartsheetIntegration not loaded, skipping Smartsheet submission');
      return;
    }

    try {
      const context = window.SmartsheetIntegration.getContext();
      
      const allData = {
        team: {
          aiScore: this.assessmentView.aiScores.team,
          userScore: this.assessmentView.userScores.team.score,
          justification: this.assessmentView.userScores.team.justification
        },
        funding: {
          aiScore: this.assessmentView.aiScores.funding,
          userScore: this.assessmentView.userScores.funding.score,
          justification: this.assessmentView.userScores.funding.justification
        },
        competitive: {
          aiScore: this.assessmentView.aiScores.competitive,
          userScore: this.assessmentView.userScores.competitive.score,
          justification: this.assessmentView.userScores.competitive.justification
        },
        market: {
          aiScore: this.assessmentView.aiScores.market,
          userScore: this.assessmentView.userScores.market.score,
          justification: this.assessmentView.userScores.market.justification
        },
        iprisk: {
          aiScore: this.assessmentView.aiScores.iprisk,
          userScore: this.assessmentView.userScores.iprisk.score,
          justification: this.assessmentView.userScores.iprisk.justification
        }
      };

      await window.SmartsheetIntegration.submitAllScores(allData, context);
      console.log('All scores submitted to Smartsheet on export');
      
    } catch (error) {
      console.error('Failed to submit scores to Smartsheet:', error);
      // Don't fail the export if Smartsheet submission fails
    }
  }
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
  window.app.init();
});

// Warn before leaving during analysis
window.addEventListener('beforeunload', (e) => {
  if (window.app && window.app.state === 'analyzing') {
    e.preventDefault();
    e.returnValue = 'Analysis in progress. Are you sure you want to leave?';
  }
});
