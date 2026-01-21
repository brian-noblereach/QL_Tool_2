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

      // Check for first-time user and show welcome modal
      await this.checkForFirstTimeUser();

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
    
    // Load Previous button
    const loadPreviousBtn = document.getElementById('load-previous-btn');
    if (loadPreviousBtn) {
      loadPreviousBtn.addEventListener('click', () => this.loadPreviousAssessment());
    }
    
    // File upload handling
    this.setupFileUploadListeners();
  }
  
  setupFileUploadListeners() {
    const fileInput = document.getElementById('company-file');
    const uploadZone = document.getElementById('file-upload-zone');
    const fileInfo = document.getElementById('file-selected-info');
    const fileName = document.getElementById('file-name');
    const removeBtn = document.getElementById('file-remove-btn');
    
    if (!fileInput || !uploadZone) return;
    
    // Store selected file reference
    this.selectedFile = null;
    
    // File selection via input
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.handleFileSelection(file);
      }
    });
    
    // Drag and drop events
    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadZone.classList.add('drag-over');
    });
    
    uploadZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadZone.classList.remove('drag-over');
    });
    
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadZone.classList.remove('drag-over');
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleFileSelection(files[0]);
      }
    });
    
    // Remove file button
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.clearFileSelection();
      });
    }
  }
  
  handleFileSelection(file) {
    const uploadZone = document.getElementById('file-upload-zone');
    const fileInfo = document.getElementById('file-selected-info');
    const fileNameEl = document.getElementById('file-name');
    const fileInput = document.getElementById('company-file');
    
    // Validate file type
    const validTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    const validExtensions = ['.pdf', '.doc', '.docx'];
    
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    const isValidType = validTypes.includes(file.type) || validExtensions.includes(fileExtension);
    
    if (!isValidType) {
      uploadZone.classList.add('error');
      this.toastManager?.error('Please upload a PDF or Word document');
      setTimeout(() => uploadZone.classList.remove('error'), 3000);
      return;
    }
    
    // Store file reference
    this.selectedFile = file;
    
    // Update UI
    uploadZone.classList.add('has-file');
    uploadZone.classList.remove('error');
    fileInfo.classList.remove('hidden');
    fileNameEl.textContent = file.name;
    
    console.log('[App] File selected:', file.name, file.type, file.size);
  }
  
  clearFileSelection() {
    const uploadZone = document.getElementById('file-upload-zone');
    const fileInfo = document.getElementById('file-selected-info');
    const fileInput = document.getElementById('company-file');
    
    this.selectedFile = null;
    
    if (fileInput) fileInput.value = '';
    if (uploadZone) uploadZone.classList.remove('has-file', 'error');
    if (fileInfo) fileInfo.classList.add('hidden');
    
    console.log('[App] File selection cleared');
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
        window.open('https://forms.osi.office365.us/r/kWXTaUrAAd', '_blank');
      });
    }
  }

  /**
   * Check if this is a first-time user and show welcome modal
   */
  async checkForFirstTimeUser() {
    // Don't show if user has dismissed it
    if (localStorage.getItem('welcome_modal_dismissed') === 'true') {
      return;
    }

    // Don't show if there's saved state (returning user)
    if (this.stateManager.hasIncompleteAnalysis()) {
      return;
    }

    // Show welcome modal
    await this.modalManager.showWelcomeModal();
  }

  async startAnalysis() {
    const urlInput = document.getElementById('company-url');
    const scaInput = document.getElementById('sca-name');
    
    if (!urlInput) return;
    
    const url = urlInput.value.trim();
    const scaName = scaInput?.value.trim() || '';
    const file = this.selectedFile;
    
    // Validate: need either URL or file
    const hasUrl = url.length > 0;
    const hasFile = file instanceof File;
    
    if (!hasUrl && !hasFile) {
      this.showValidationError(urlInput, 'Please enter a company website URL or upload a document');
      return;
    }
    
    // Validate URL if provided
    let validatedUrl = null;
    if (hasUrl) {
      const validation = Validators.validateUrl(url);
      if (!validation.valid) {
        this.showValidationError(urlInput, validation.error);
        return;
      }
      validatedUrl = validation.url;
    }
    
    // Save input to state
    this.stateManager.setCompanyInput(validatedUrl || 'Document Upload', scaName, hasFile ? file.name : null);
    
    // Clear Smartsheet row ID for new analysis (unless we're re-running a loaded assessment)
    // The row ID will be set if we're updating an existing assessment
    if (!this.stateManager.getSmartsheetRowId()) {
      window.SmartsheetIntegration?.clearCurrentRowId();
    }
    
    // Request notification permission
    await this.requestNotificationPermission();
    
    try {
      // Show progress section
      this.showSection('progress');
      
      // Update progress message based on input type
      let progressMessage = 'Analyzing: ';
      if (hasUrl && hasFile) {
        progressMessage += validatedUrl + ' + ' + file.name;
      } else if (hasFile) {
        progressMessage += file.name;
      } else {
        progressMessage += validatedUrl;
      }
      document.getElementById('progress-company-name').textContent = progressMessage;
      
      // Reset tab states
      this.tabManager.reset();
      
      // Start progress tracking
      this.progressView.start(this.pipeline);
      
      // Run analysis with URL and/or file
      await this.pipeline.start({ url: validatedUrl, file: file });
      
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
      
      // Company data might be { full, short } or just the data
      if (phase === 'company') {
        const companyData = data?.full || data;
        this.assessmentView.loadCompanyData(companyData);
      } else {
        this.loadPhaseData(phase, data);
      }
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
        // Company data comes as { full, short } - we need full for display
        const companyData = data?.full || data;
        console.log('[App] Loading company data, keys:', Object.keys(companyData || {}));
        this.assessmentView.loadCompanyData(companyData);
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
    
    // Cache the full assessment for later reload
    this.cacheCurrentAssessment(results);
    
    // Enable export button
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) exportBtn.disabled = false;
    
    // Desktop notification - company data might be { full, short } or just the data
    const companyFull = results.company?.full || results.company;
    const companyName = companyFull?.company_overview?.name || 'Company';
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

  /**
   * Cache the current assessment to localStorage for later reload
   * @param {Object} results - Full analysis results
   */
  cacheCurrentAssessment(results) {
    try {
      const companyFull = results.company?.full || results.company;
      const ventureName = companyFull?.company_overview?.name || 'Unknown';
      
      this.stateManager.cacheFullAssessment({
        company: companyFull,
        team: results.team,
        funding: results.funding,
        competitive: results.competitive,
        market: results.market,
        iprisk: results.iprisk,
        ventureName: ventureName
      });
      
      console.log('[App] Assessment cached for:', ventureName);
    } catch (error) {
      console.error('[App] Failed to cache assessment:', error);
    }
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
    
    // Hide main progress section
    this.progressView.hide();
    
    // Update compact progress to show partial completion with warning state
    this.progressView.showCompactPartialComplete(successCount, failedCount);
    
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
    
    // Clear Smartsheet row ID
    window.SmartsheetIntegration?.clearCurrentRowId();
    
    // Clear inputs
    const urlInput = document.getElementById('company-url');
    const scaInput = document.getElementById('sca-name');
    if (urlInput) urlInput.value = '';
    if (scaInput) scaInput.value = '';
    
    // Clear file selection
    this.clearFileSelection();
    
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
      Debug.warn('SmartsheetIntegration not loaded, skipping submission');
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

      const result = await window.SmartsheetIntegration.submitAllScores(allData, context);
      if (result?.success) {
        Debug.log('All scores submitted to Smartsheet');
      } else {
        // Submission returned but indicated failure
        throw new Error(result?.error || 'Submission returned unsuccessful');
      }

    } catch (error) {
      Debug.error('Failed to submit scores to Smartsheet:', error.message);
      // Notify user but don't fail the export
      this.toastManager?.warning(
        'Scores saved locally. Database sync failed - will retry on next export.',
        { duration: 6000 }
      );
    }
  }

  /**
   * Show final submit confirmation modal when all scores are entered
   * Called by AssessmentView when all 5 dimension scores are submitted
   * @param {Object} data - Score data and metadata
   */
  async showFinalSubmitModal(data) {
    const { scores, missingJustifications, avgAiScore, avgUserScore } = data;
    
    try {
      const action = await this.modalManager.showFinalSubmitModal(data);
      
      switch (action) {
        case 'submit':
          // Submit all scores to Smartsheet
          await this.submitFinalScores();
          this.toastManager.success('Final scores submitted to database');
          break;
          
        case 'addJustifications':
          // Navigate to the first dimension missing a justification
          if (missingJustifications && missingJustifications.length > 0) {
            const firstMissing = missingJustifications[0];
            this.tabManager.activateTab(firstMissing);
            // Focus the justification textarea
            setTimeout(() => {
              const textarea = document.getElementById(`${firstMissing}-justification`);
              if (textarea) textarea.focus();
            }, 100);
            this.toastManager.info(`Add justification for ${this.capitalize(firstMissing)} analysis`);
          }
          break;
          
        case 'cancel':
        default:
          // Do nothing, user can continue editing
          break;
      }
    } catch (error) {
      console.error('Error showing final submit modal:', error);
    }
  }

  /**
   * Submit final averaged scores to Smartsheet
   */
  async submitFinalScores() {
    try {
      await this.submitAllScoresToSmartsheet();
      
      // Enable export button if not already enabled
      const exportBtn = document.getElementById('export-btn');
      if (exportBtn) exportBtn.disabled = false;
      
    } catch (error) {
      console.error('Error submitting final scores:', error);
      this.toastManager.error('Failed to submit scores. Please try exporting the report.');
    }
  }

  /**
   * Retry a failed phase from the tab panel
   * @param {string} phase - Phase key to retry
   */
  async retryFromTab(phase) {
    try {
      await this.retryPhase(phase);
    } catch (error) {
      console.error('Retry from tab failed:', error);
      this.toastManager.error(`Retry failed: ${error.message}`);
    }
  }

  /**
   * Capitalize first letter of string
   */
  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Load a previous assessment from cache
   * Shows a modal with list of cached assessments
   */
  async loadPreviousAssessment() {
    try {
      // Get list of cached assessments
      const assessments = this.stateManager.listPastAssessments();
      
      // Show modal for selection
      const selected = await this.modalManager.showLoadPreviousModal(assessments);
      
      if (!selected) {
        // User cancelled
        return;
      }
      
      // Load the selected assessment
      const assessment = this.stateManager.loadAssessment(selected.key);
      
      if (!assessment) {
        this.toastManager.error('Could not load assessment data');
        return;
      }
      
      // Check if we have full data or just scores
      const hasFullData = assessment.aiData && 
        Object.values(assessment.aiData).some(v => v !== null);
      
      if (hasFullData) {
        // Restore full assessment
        await this.restoreFromCachedAssessment(assessment);
        this.toastManager.success(`Loaded assessment for ${selected.ventureName}`);
      } else {
        // Show notification that we only have scores
        const action = await this.modalManager.showScoresOnlyLoadedModal(selected.ventureName);
        
        if (action === 'rerun') {
          // Pre-fill URL and start new analysis
          const urlInput = document.getElementById('company-url');
          const scaInput = document.getElementById('sca-name');
          
          if (urlInput && assessment.companyInput?.url) {
            urlInput.value = assessment.companyInput.url;
          }
          if (scaInput && assessment.advisorName) {
            scaInput.value = assessment.advisorName;
          }
          
          // Store the row ID so we update the same row
          if (assessment.smartsheetRowId) {
            this.stateManager.saveSmartsheetRowId(assessment.smartsheetRowId);
            window.SmartsheetIntegration?.setCurrentRowId(assessment.smartsheetRowId);
          }
          
          this.toastManager.info('Ready to re-run analysis. Click "Start Assessment" when ready.');
        } else {
          // Just load scores for editing
          await this.restoreScoresOnly(assessment);
          this.toastManager.info(`Scores loaded for ${selected.ventureName}`);
        }
      }
      
    } catch (error) {
      console.error('[App] Error loading previous assessment:', error);
      this.toastManager.error('Failed to load assessment');
    }
  }

  /**
   * Restore a full cached assessment (with AI data)
   * @param {Object} assessment - Cached assessment data
   */
  async restoreFromCachedAssessment(assessment) {
    try {
      // Reset current state
      this.pipeline.reset();
      this.tabManager.reset();
      
      // Restore Smartsheet row ID if present
      if (assessment.smartsheetRowId) {
        this.stateManager.saveSmartsheetRowId(assessment.smartsheetRowId);
        window.SmartsheetIntegration?.setCurrentRowId(assessment.smartsheetRowId);
      }
      
      // Pre-fill URL input
      const urlInput = document.getElementById('company-url');
      const scaInput = document.getElementById('sca-name');
      
      if (urlInput && assessment.companyInput?.url && assessment.companyInput.url !== 'Document Upload') {
        urlInput.value = assessment.companyInput.url;
      }
      if (scaInput && assessment.advisorName) {
        scaInput.value = assessment.advisorName;
      }
      
      // Show results section
      this.showSection('results');
      
      // Load company data if available
      if (assessment.aiData.company) {
        this.tabManager.enableTab('overview');
        this.assessmentView.loadCompanyData(assessment.aiData.company);
      }
      
      // Load each dimension
      const dimensions = ['team', 'funding', 'competitive', 'market', 'iprisk'];
      
      dimensions.forEach(dim => {
        if (assessment.aiData[dim]) {
          this.tabManager.enableTab(dim);
          this.loadPhaseData(dim, assessment.aiData[dim]);
        }
      });
      
      // Restore user scores
      if (assessment.userScores) {
        Object.entries(assessment.userScores).forEach(([dim, scoreData]) => {
          if (scoreData) {
            this.assessmentView.setUserScore(dim, scoreData);
            
            // Mark as submitted if it was
            if (scoreData.score !== null) {
              this.assessmentView.userScores[dim].submitted = true;
              this.assessmentView.userScores[dim].timesSubmitted = 1;
              
              // Update submit button state
              const submitBtn = document.getElementById(`${dim}-submit-btn`);
              const scoringCard = document.getElementById(`${dim}-scoring-card`);
              
              if (submitBtn) {
                submitBtn.classList.add('update-mode');
                submitBtn.innerHTML = `
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Update Score
                `;
              }
              
              if (scoringCard) {
                scoringCard.classList.add('has-submission');
              }
            }
          }
        });
      }
      
      // Check if summary tab should be enabled
      if (this.tabManager.allReady()) {
        this.tabManager.enableTab('summary');
        
        // Update summary view
        this.summaryView.update({
          company: assessment.aiData.company,
          team: assessment.aiData.team,
          funding: assessment.aiData.funding,
          competitive: assessment.aiData.competitive,
          market: assessment.aiData.market,
          iprisk: assessment.aiData.iprisk
        });
      }
      
      // Activate first tab
      this.tabManager.activateTab('overview');
      
      // Enable export button
      const exportBtn = document.getElementById('export-btn');
      if (exportBtn) exportBtn.disabled = false;
      
      this.state = 'results';
      
    } catch (error) {
      console.error('[App] Error restoring cached assessment:', error);
      throw error;
    }
  }

  /**
   * Restore only scores (no AI data) - limited functionality
   * @param {Object} assessment - Cached assessment with user scores only
   */
  async restoreScoresOnly(assessment) {
    // This is a partial restore - we don't have AI data
    // User can view/edit scores but won't see AI evidence
    
    // Pre-fill URL input
    const urlInput = document.getElementById('company-url');
    const scaInput = document.getElementById('sca-name');
    
    if (urlInput && assessment.companyInput?.url && assessment.companyInput.url !== 'Document Upload') {
      urlInput.value = assessment.companyInput.url;
    }
    if (scaInput && assessment.advisorName) {
      scaInput.value = assessment.advisorName;
    }
    
    // Store the row ID for updates
    if (assessment.smartsheetRowId) {
      this.stateManager.saveSmartsheetRowId(assessment.smartsheetRowId);
      window.SmartsheetIntegration?.setCurrentRowId(assessment.smartsheetRowId);
    }
    
    // Note: Don't switch to results view since we don't have AI data to display
    // User needs to re-run analysis or just update scores via Smartsheet
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
