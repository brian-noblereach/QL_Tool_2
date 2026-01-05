// js/core/pipeline.js - Sequential analysis pipeline manager
// V02.1: Updated to support file uploads and short company description

class AnalysisPipeline {
  constructor() {
    this.phases = [
      { 
        name: 'Company Analysis',
        key: 'company',
        duration: 150,  // ~2.5 minutes
        status: 'pending',
        startTime: null,
        endTime: null,
        data: null,
        error: null
      },
      { 
        name: 'Team Analysis',
        key: 'team',
        duration: 70,   // ~1 minute
        status: 'pending',
        startTime: null,
        endTime: null,
        data: null,
        error: null
      },
      { 
        name: 'Funding Analysis',
        key: 'funding',
        duration: 60,   // ~1 minute
        status: 'pending',
        startTime: null,
        endTime: null,
        data: null,
        error: null
      },
      { 
        name: 'Competitive Analysis',
        key: 'competitive',
        duration: 160,  // ~2.7 minutes
        status: 'pending',
        startTime: null,
        endTime: null,
        data: null,
        error: null
      },
      { 
        name: 'Market Analysis',
        key: 'market',
        duration: 250,  // ~4 minutes
        status: 'pending',
        startTime: null,
        endTime: null,
        data: null,
        error: null
      },
      { 
        name: 'IP Risk Analysis',
        key: 'iprisk',
        duration: 60,   // ~1 minute
        status: 'pending',
        startTime: null,
        endTime: null,
        data: null,
        error: null
      }
    ];
    
    this.startTime = null;
    this.abortController = null;
    this.companyUrl = null;
    this.companyFile = null;
    this.companyDescription = null;  // Short description for other APIs
    this.callbacks = {};
    this.isRunning = false;
    this.activePhases = new Set();
    
    this.events = new EventTarget();
  }

  /**
   * Register callback functions
   */
  on(event, callback) {
    this.callbacks[event] = callback;
  }

  /**
   * Emit event to registered callback
   */
  emit(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event](data);
    }
    
    this.events.dispatchEvent(new CustomEvent(event, { detail: data }));
  }

  addEventListener(event, handler) {
    this.events.addEventListener(event, handler);
  }

  removeEventListener(event, handler) {
    this.events.removeEventListener(event, handler);
  }

  /**
   * Start the analysis pipeline
   * 
   * @param {Object} options - Input options
   * @param {string} options.url - Company website URL (optional)
   * @param {File} options.file - Uploaded document (optional)
   */
  async start({ url, file } = {}) {
    if (this.isRunning) {
      throw new Error('Analysis already in progress');
    }

    // Validate inputs - need at least one
    const hasUrl = url && typeof url === 'string' && url.trim().length > 0;
    const hasFile = file && file instanceof File;
    
    if (!hasUrl && !hasFile) {
      throw new Error('Either a company URL or document is required');
    }

    // Validate URL if provided
    if (hasUrl) {
      const validation = Validators.validateUrl(url);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
      this.companyUrl = validation.url;
    } else {
      this.companyUrl = null;
    }

    this.companyFile = hasFile ? file : null;
    this.companyDescription = null;
    this.startTime = Date.now();
    this.abortController = new AbortController();
    this.isRunning = true;
    this.activePhases.clear();
    
    this.phases.forEach(phase => {
      phase.status = 'pending';
      phase.startTime = null;
      phase.endTime = null;
      phase.data = null;
      phase.error = null;
      delete phase.promise;
    });

    this.emit('start', { 
      url: this.companyUrl, 
      hasFile: hasFile,
      fileName: hasFile ? file.name : null 
    });

    try {
      // Company analysis must complete first
      await this.executePhase('company');

      // Emit event for UI to show overview
      this.emit('overviewReady', {
        phase: 'company',
        data: this.phases.find(p => p.key === 'company')?.data
      });

      // Run remaining analyses in parallel
      const teamPromise = this.executePhase('team').catch(e => ({ error: e, phase: 'team' }));
      const fundingPromise = this.executePhase('funding').catch(e => ({ error: e, phase: 'funding' }));
      const competitivePromise = this.executePhase('competitive').catch(e => ({ error: e, phase: 'competitive' }));
      const ipRiskPromise = this.executePhase('iprisk').catch(e => ({ error: e, phase: 'iprisk' }));

      // Market depends on competitive
      const marketPromise = competitivePromise.then(result => {
        if (result?.error) {
          const phase = this.phases.find(p => p.key === 'market');
          phase.status = 'error';
          phase.error = new Error('Skipped: Competitive analysis failed');
          this.emit('phaseError', {
            phase: 'market',
            name: 'Market Analysis',
            error: 'Skipped: Competitive analysis required first',
            canRetry: false
          });
          return { error: result.error, phase: 'market' };
        }
        if (this.abortController?.signal.aborted) {
          return { error: new Error('Analysis cancelled'), phase: 'market' };
        }
        return this.executePhase('market').catch(e => ({ error: e, phase: 'market' }));
      });

      await Promise.all([teamPromise, fundingPromise, competitivePromise, ipRiskPromise, marketPromise]);

      const allSucceeded = this.phases.every(p => p.status === 'completed');
      
      if (allSucceeded) {
        this.emit('allComplete', this.getResults());
        this.emit('complete', this.getResults());
      } else {
        const failedPhases = this.phases.filter(p => p.status === 'error').map(p => p.key);
        this.emit('partialComplete', {
          results: this.getResults(),
          failedPhases
        });
      }
      
      return this.getResults();

    } catch (error) {
      if (this.abortController && !this.abortController.signal.aborted) {
        this.abortController.abort();
      }
      this.emit('error', error);
      throw error;
    } finally {
      this.isRunning = false;
      this.abortController = null;
      this.activePhases.clear();
    }
  }

  /**
   * Run a single phase
   */
  executePhase(key) {
    const phase = this.phases.find(p => p.key === key);
    if (!phase) {
      return Promise.reject(new Error(`Unknown phase: ${key}`));
    }

    if (phase.promise) {
      return phase.promise;
    }

    phase.status = 'active';
    phase.startTime = Date.now();
    phase.endTime = null;
    phase.error = null;
    this.activePhases.add(key);

    this.emit('phaseStart', {
      phase: phase.key,
      name: phase.name,
      estimatedDuration: phase.duration
    });

    const runPhase = async () => {
      try {
        let result;

        switch (phase.key) {
          case 'company':
            result = await this.runCompanyAnalysis();
            break;
          case 'team':
            result = await this.runTeamAnalysis();
            break;
          case 'competitive':
            result = await this.runCompetitiveAnalysis();
            break;
          case 'funding':
            result = await this.runFundingAnalysis();
            break;
          case 'market':
            result = await this.runMarketAnalysis();
            break;
          case 'iprisk':
            result = await this.runIpRiskAnalysis();
            break;
          default:
            throw new Error(`Unknown phase: ${phase.key}`);
        }

        phase.data = result;
        phase.status = 'completed';
        phase.endTime = Date.now();

        this.emit('phaseComplete', {
          phase: phase.key,
          name: phase.name,
          duration: (phase.endTime - phase.startTime) / 1000,
          data: result,
          completedCount: this.getCompletedCount(),
          totalCount: this.phases.length
        });

        return result;
      } catch (error) {
        phase.status = 'error';
        phase.error = error;
        phase.endTime = Date.now();

        this.emit('phaseError', {
          phase: phase.key,
          name: phase.name,
          error: error.message,
          canRetry: true
        });

        throw error;
      } finally {
        this.activePhases.delete(key);
        delete phase.promise;
      }
    };

    phase.promise = runPhase();
    return phase.promise;
  }

  getCompletedCount() {
    return this.phases.filter(p => p.status === 'completed').length;
  }

  getPartialResults() {
    const results = {};
    this.phases.forEach(phase => {
      if (phase.status === 'completed' && phase.data) {
        results[phase.key] = phase.data;
      }
    });
    return results;
  }

  async retryPhase(key) {
    const phase = this.phases.find(p => p.key === key);
    if (!phase) {
      throw new Error(`Unknown phase: ${key}`);
    }
    
    if (phase.status !== 'error') {
      throw new Error(`Phase ${key} is not in error state`);
    }
    
    if (!this.abortController) {
      this.abortController = new AbortController();
    }
    
    phase.status = 'pending';
    phase.error = null;
    delete phase.promise;
    
    return this.executePhase(key);
  }

  /**
   * Run company analysis - handles URL, file, or both
   */
  async runCompanyAnalysis() {
    const response = await CompanyAPI.analyze(
      { url: this.companyUrl, file: this.companyFile },
      this.abortController.signal
    );
    
    // Response now contains { full, short }
    // Validate the full output for display
    const validation = Validators.validateCompany(response.full || response);
    if (!validation.valid) {
      throw new Error(`Invalid company data: ${validation.error}`);
    }
    
    // Store short description for other APIs
    this.companyDescription = CompanyAPI.getShortDescription(response);
    
    console.log('[Pipeline] Company analysis complete, short description length:', this.companyDescription?.length);
    
    return response;
  }

  /**
   * Run team analysis - now uses company description
   */
  async runTeamAnalysis() {
    if (!this.companyDescription) {
      throw new Error('Company description not available');
    }

    const response = await TeamAPI.analyze(
      this.companyDescription,
      this.abortController.signal
    );

    const validation = Validators.validateTeam(response);
    if (!validation.valid) {
      throw new Error(`Invalid team data: ${validation.error}`);
    }

    return response;
  }

  /**
   * Run funding analysis - uses short company description
   */
  async runFundingAnalysis() {
    if (!this.companyDescription) {
      throw new Error('Company description not available');
    }

    const response = await FundingAPI.analyze(
      this.companyDescription,
      this.abortController.signal
    );

    const validation = Validators.validateFunding(response);
    if (!validation.valid) {
      throw new Error(`Invalid funding data: ${validation.error}`);
    }

    return response;
  }

  /**
   * Run competitive analysis - uses short company description
   */
  async runCompetitiveAnalysis() {
    if (!this.companyDescription) {
      throw new Error('Company description not available');
    }

    const response = await CompetitiveAPI.analyze(
      this.companyDescription,
      this.abortController.signal
    );
    
    const validation = Validators.validateCompetitive(response);
    if (!validation.valid) {
      throw new Error(`Invalid competitive data: ${validation.error}`);
    }
    
    return response;
  }

  /**
   * Run market analysis - uses company description + competitive output
   */
  async runMarketAnalysis() {
    if (!this.companyDescription) {
      throw new Error('Company description not available');
    }

    const competitiveData = this.phases.find(p => p.key === 'competitive')?.data;
    if (!competitiveData) {
      throw new Error('Competitive analysis not available');
    }

    const response = await MarketAPI.analyze(
      this.companyDescription,
      competitiveData.analysisText || competitiveData,
      this.abortController.signal
    );
    
    const validation = Validators.validateMarket(response);
    if (!validation.valid) {
      throw new Error(`Invalid market data: ${validation.error}`);
    }
    
    return response;
  }

  /**
   * Run IP risk analysis - uses short company description
   */
  async runIpRiskAnalysis() {
    if (!this.companyDescription) {
      throw new Error('Company description not available');
    }

    const response = await IPRiskAPI.analyze(
      this.companyDescription,
      this.abortController.signal
    );

    return response;
  }

  /**
   * Cancel the analysis
   */
  cancel() {
    if (this.abortController) {
      this.abortController.abort();
      const activeKeys = Array.from(this.activePhases);
      this.emit('cancelled', {
        phase: activeKeys.length > 0 ? activeKeys[0] : null
      });
    }
  }

  /**
   * Get current progress
   */
  getProgress() {
    const companyDuration = this.phases.find(p => p.key === 'company')?.duration || 150;
    const parallelPhases = ['team', 'funding', 'competitive', 'iprisk'];
    const maxParallelDuration = Math.max(
      ...parallelPhases.map(k => this.phases.find(p => p.key === k)?.duration || 60)
    );
    const marketDuration = this.phases.find(p => p.key === 'market')?.duration || 250;
    
    const effectiveTotalDuration = companyDuration + maxParallelDuration + marketDuration;
    
    const now = Date.now();
    const elapsed = this.startTime ? (now - this.startTime) / 1000 : 0;

    const companyPhase = this.phases.find(p => p.key === 'company');
    const marketPhase = this.phases.find(p => p.key === 'market');
    const competitivePhase = this.phases.find(p => p.key === 'competitive');
    
    let progressContribution = 0;
    
    if (companyPhase.status === 'completed') {
      progressContribution += companyDuration;
    } else if (companyPhase.status === 'active' && companyPhase.startTime) {
      const phaseElapsed = (now - companyPhase.startTime) / 1000;
      progressContribution += Math.min(phaseElapsed, companyDuration);
    }
    
    if (companyPhase.status === 'completed') {
      const parallelCompleted = parallelPhases.every(k => {
        const p = this.phases.find(ph => ph.key === k);
        return p.status === 'completed' || p.status === 'error';
      });
      
      if (parallelCompleted) {
        progressContribution += maxParallelDuration;
      } else if (competitivePhase.status === 'active' && competitivePhase.startTime) {
        const phaseElapsed = (now - competitivePhase.startTime) / 1000;
        progressContribution += Math.min(phaseElapsed, maxParallelDuration);
      }
    }
    
    if (marketPhase.status === 'completed') {
      progressContribution += marketDuration;
    } else if (marketPhase.status === 'active' && marketPhase.startTime) {
      const phaseElapsed = (now - marketPhase.startTime) / 1000;
      progressContribution += Math.min(phaseElapsed, marketDuration);
    } else if (marketPhase.status === 'error') {
      progressContribution += marketDuration;
    }

    const allCompleted = this.phases.every(phase => 
      phase.status === 'completed' || phase.status === 'error'
    );
    const percentage = allCompleted
      ? 100
      : Math.min(95, (progressContribution / effectiveTotalDuration) * 100);

    const remaining = Math.max(0, effectiveTotalDuration - elapsed);
    const activeNames = Array.from(this.activePhases)
      .map(key => this.phases.find(phase => phase.key === key)?.name)
      .filter(Boolean);

    return {
      percentage,
      elapsed,
      estimated: effectiveTotalDuration,
      remaining,
      currentPhase: activeNames.length > 0 ? activeNames.join(', ') : null,
      completedCount: this.getCompletedCount(),
      totalCount: this.phases.length
    };
  }

  /**
   * Get results
   */
  getResults() {
    const companyData = this.phases.find(p => p.key === 'company')?.data;
    
    return {
      // Return full company output for display
      company: companyData?.full || companyData || null,
      team: this.phases.find(p => p.key === 'team')?.data || null,
      funding: this.phases.find(p => p.key === 'funding')?.data || null,
      competitive: this.phases.find(p => p.key === 'competitive')?.data || null,
      market: this.phases.find(p => p.key === 'market')?.data || null,
      iprisk: this.phases.find(p => p.key === 'iprisk')?.data || null,
      companyDescription: this.companyDescription,
      duration: (Date.now() - this.startTime) / 1000
    };
  }

  isComplete() {
    return this.phases.every(phase => phase.status === 'completed');
  }

  getPhaseStatus(key) {
    const phase = this.phases.find(p => p.key === key);
    return phase ? phase.status : null;
  }

  reset() {
    if (this.abortController) {
      this.abortController.abort();
    }
    
    this.startTime = null;
    this.abortController = null;
    this.companyUrl = null;
    this.companyFile = null;
    this.companyDescription = null;
    this.isRunning = false;
    this.activePhases.clear();
    
    this.phases.forEach(phase => {
      phase.status = 'pending';
      phase.startTime = null;
      phase.endTime = null;
      phase.data = null;
      phase.error = null;
      delete phase.promise;
    });
  }
}

// Make available globally
window.AnalysisPipeline = AnalysisPipeline;
