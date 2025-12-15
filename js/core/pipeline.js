// js/core/pipeline.js - Sequential analysis pipeline manager
// V02: Updated with event emission for progressive display

class AnalysisPipeline {
  constructor() {
    this.phases = [
      { 
        name: 'Company Analysis',
        key: 'company',
        duration: 150,  // ~2.5 minutes (actual: 100-200s, runs first)
        status: 'pending',
        startTime: null,
        endTime: null,
        data: null,
        error: null
      },
      { 
        name: 'Team Analysis',
        key: 'team',
        duration: 70,   // ~1 minute (actual: 40-100s, runs parallel)
        status: 'pending',
        startTime: null,
        endTime: null,
        data: null,
        error: null
      },
      { 
        name: 'Funding Analysis',
        key: 'funding',
        duration: 60,   // ~1 minute estimate (runs parallel)
        status: 'pending',
        startTime: null,
        endTime: null,
        data: null,
        error: null
      },
      { 
        name: 'Competitive Analysis',
        key: 'competitive',
        duration: 160,  // ~2.7 minutes (actual: 120-200s, runs parallel)
        status: 'pending',
        startTime: null,
        endTime: null,
        data: null,
        error: null
      },
      { 
        name: 'Market Analysis',
        key: 'market',
        duration: 250,  // ~4 minutes (actual: 250s, waits for competitive)
        status: 'pending',
        startTime: null,
        endTime: null,
        data: null,
        error: null
      },
      { 
        name: 'IP Risk Analysis',
        key: 'iprisk',
        duration: 60,   // ~1 minute (actual: 50-70s, runs parallel)
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
    this.techDescription = null;
    this.callbacks = {};
    this.isRunning = false;
    this.activePhases = new Set();
    
    // V02: EventTarget for progressive display support
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
    
    // V02: Also dispatch to EventTarget for component listeners
    this.events.dispatchEvent(new CustomEvent(event, { detail: data }));
  }

  /**
   * V02: Subscribe to events via EventTarget
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  addEventListener(event, handler) {
    this.events.addEventListener(event, handler);
  }

  /**
   * V02: Unsubscribe from events
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  removeEventListener(event, handler) {
    this.events.removeEventListener(event, handler);
  }

  /**
   * Start the analysis pipeline
   */
  async start(companyUrl) {
    if (this.isRunning) {
      throw new Error('Analysis already in progress');
    }

    const validation = Validators.validateUrl(companyUrl);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    this.companyUrl = validation.url;
    this.techDescription = null;
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

    this.emit('start', { url: this.companyUrl });

    try {
      // Company analysis must complete first
      await this.executePhase('company');

      // V02: After company completes, emit event for UI to show overview
      this.emit('overviewReady', {
        phase: 'company',
        data: this.phases.find(p => p.key === 'company')?.data
      });

      // Run remaining analyses in parallel - use allSettled to prevent cascading failures
      const teamPromise = this.executePhase('team').catch(e => ({ error: e, phase: 'team' }));
      const fundingPromise = this.executePhase('funding').catch(e => ({ error: e, phase: 'funding' }));
      const competitivePromise = this.executePhase('competitive').catch(e => ({ error: e, phase: 'competitive' }));
      const ipRiskPromise = this.executePhase('iprisk').catch(e => ({ error: e, phase: 'iprisk' }));

      // Market depends on competitive - only run if competitive succeeds
      const marketPromise = competitivePromise.then(result => {
        if (result?.error) {
          // Competitive failed, skip market
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

      // Wait for all to complete (successes and failures)
      await Promise.all([teamPromise, fundingPromise, competitivePromise, ipRiskPromise, marketPromise]);

      // Check if all completed successfully
      const allSucceeded = this.phases.every(p => p.status === 'completed');
      
      if (allSucceeded) {
        this.emit('allComplete', this.getResults());
        this.emit('complete', this.getResults());
      } else {
        // Some phases failed - emit partial complete
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
   * Run a single phase (supports concurrent execution)
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

        // V02: Enhanced phaseComplete event with canRetry flag
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

        // V02: Enhanced phaseError event with canRetry flag
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

  /**
   * V02: Get count of completed phases
   */
  getCompletedCount() {
    return this.phases.filter(p => p.status === 'completed').length;
  }

  /**
   * V02: Get partial results (completed phases only)
   */
  getPartialResults() {
    const results = {};
    this.phases.forEach(phase => {
      if (phase.status === 'completed' && phase.data) {
        results[phase.key] = phase.data;
      }
    });
    return results;
  }

  /**
   * V02: Retry a failed phase
   */
  async retryPhase(key) {
    const phase = this.phases.find(p => p.key === key);
    if (!phase) {
      throw new Error(`Unknown phase: ${key}`);
    }
    
    if (phase.status !== 'error') {
      throw new Error(`Phase ${key} is not in error state`);
    }
    
    // Create new abort controller if needed (for retries after pipeline finished)
    if (!this.abortController) {
      this.abortController = new AbortController();
    }
    
    // Reset phase state
    phase.status = 'pending';
    phase.error = null;
    delete phase.promise;
    
    // Re-execute
    return this.executePhase(key);
  }

  /**
   * Run company analysis
   */
  async runCompanyAnalysis() {
    const response = await CompanyAPI.analyze(
      this.companyUrl,
      this.abortController.signal
    );
    
    const validation = Validators.validateCompany(response);
    if (!validation.valid) {
      throw new Error(`Invalid company data: ${validation.error}`);
    }
    
    this.techDescription = this.buildTechDescription(response);
    
    return response;
  }

  /**
   * Run team analysis
   */
  async runTeamAnalysis() {
    if (!this.companyUrl) {
      throw new Error('Company URL not available');
    }

    const response = await TeamAPI.analyze(
      this.companyUrl,
      this.abortController.signal
    );

    const validation = Validators.validateTeam(response);
    if (!validation.valid) {
      throw new Error(`Invalid team data: ${validation.error}`);
    }

    return response;
  }

  /**
   * Run funding analysis
   */
  async runFundingAnalysis() {
    if (!this.techDescription) {
      throw new Error('Tech description not available');
    }

    const response = await FundingAPI.analyze(
      this.techDescription,
      this.abortController.signal
    );

    const validation = Validators.validateFunding(response);
    if (!validation.valid) {
      throw new Error(`Invalid funding data: ${validation.error}`);
    }

    return response;
  }

  /**
   * Run competitive analysis
   */
  async runCompetitiveAnalysis() {
    if (!this.techDescription) {
      throw new Error('Tech description not available');
    }

    const response = await CompetitiveAPI.analyze(
      this.techDescription,
      this.abortController.signal
    );
    
    const validation = Validators.validateCompetitive(response);
    if (!validation.valid) {
      throw new Error(`Invalid competitive data: ${validation.error}`);
    }
    
    return response;
  }

  /**
   * Run market analysis
   */
  async runMarketAnalysis() {
    if (!this.techDescription) {
      throw new Error('Tech description not available');
    }

    const competitiveData = this.phases.find(p => p.key === 'competitive')?.data;
    if (!competitiveData) {
      throw new Error('Competitive analysis not available');
    }

    const response = await MarketAPI.analyze(
      this.techDescription,
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
   * Run IP risk analysis
   */
  async runIpRiskAnalysis() {
    if (!this.techDescription) {
      throw new Error('Tech description not available');
    }

    const response = await IPRiskAPI.analyze(
      this.techDescription,
      this.abortController.signal
    );

    // V02: Add IP risk validation
    // const validation = Validators.validateIpRisk(response);
    // if (!validation.valid) {
    //   throw new Error(`Invalid IP risk data: ${validation.error}`);
    // }

    return response;
  }

  /**
   * Build tech description from company data
   */
  buildTechDescription(company) {
    const parts = [];
    
    if (company.company_overview) {
      const o = company.company_overview;
      if (o.name) parts.push(`Company: ${o.name}`);
      if (o.mission_statement) parts.push(`Mission: ${o.mission_statement}`);
      if (o.company_description) parts.push(o.company_description);
    }
    
    if (company.technology) {
      const t = company.technology;
      if (t.core_technology) parts.push(`Core Technology: ${t.core_technology}`);
      if (t.technical_approach) parts.push(`Technical Approach: ${t.technical_approach}`);
      if (t.key_innovations && t.key_innovations.length > 0) {
        parts.push(`Key Innovations: ${t.key_innovations.slice(0, 3).join('; ')}`);
      }
    }
    
    if (company.products_and_applications) {
      const p = company.products_and_applications;
      if (p.primary_application) parts.push(`Primary Application: ${p.primary_application}`);
      if (p.target_industries && p.target_industries.length > 0) {
        parts.push(`Target Industries: ${p.target_industries.join(', ')}`);
      }
    }
    
    if (company.market_context) {
      const m = company.market_context;
      if (m.problem_addressed) parts.push(`Problem Addressed: ${m.problem_addressed}`);
      if (m.value_proposition) parts.push(`Value Proposition: ${m.value_proposition}`);
    }
    
    const description = parts.join('\n\n');
    
    if (description.length < 200) {
      parts.push('This company is developing innovative technology solutions for their target market.');
    }
    
    return parts.join('\n\n');
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
   * Time calculation:
   * - Company runs first: ~150s
   * - Then parallel: Team(70s), Funding(60s), Competitive(160s), IP Risk(60s)
   * - Market waits for Competitive, then runs: ~250s
   * - Effective total: Company(150s) + max(parallel phases) + Market(250s if competitive succeeds)
   * - Parallel max is Competitive(160s)
   * - Total effective time: ~150 + 160 + 250 = 560s (~9-10 minutes)
   */
  getProgress() {
    // Effective total considers parallelism:
    // Company (sequential) + max parallel batch + market (sequential after competitive)
    const companyDuration = this.phases.find(p => p.key === 'company')?.duration || 150;
    const parallelPhases = ['team', 'funding', 'competitive', 'iprisk'];
    const maxParallelDuration = Math.max(
      ...parallelPhases.map(k => this.phases.find(p => p.key === k)?.duration || 60)
    );
    const marketDuration = this.phases.find(p => p.key === 'market')?.duration || 250;
    
    // Total effective time considering parallel execution
    const effectiveTotalDuration = companyDuration + maxParallelDuration + marketDuration;
    
    const now = Date.now();
    const elapsed = this.startTime ? (now - this.startTime) / 1000 : 0;

    // Calculate progress based on completed phases
    const companyPhase = this.phases.find(p => p.key === 'company');
    const marketPhase = this.phases.find(p => p.key === 'market');
    const competitivePhase = this.phases.find(p => p.key === 'competitive');
    
    let progressContribution = 0;
    
    // Company phase contribution
    if (companyPhase.status === 'completed') {
      progressContribution += companyDuration;
    } else if (companyPhase.status === 'active' && companyPhase.startTime) {
      const phaseElapsed = (now - companyPhase.startTime) / 1000;
      progressContribution += Math.min(phaseElapsed, companyDuration);
    }
    
    // Parallel phases - count progress for the slowest one (competitive)
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
    
    // Market phase contribution
    if (marketPhase.status === 'completed') {
      progressContribution += marketDuration;
    } else if (marketPhase.status === 'active' && marketPhase.startTime) {
      const phaseElapsed = (now - marketPhase.startTime) / 1000;
      progressContribution += Math.min(phaseElapsed, marketDuration);
    } else if (marketPhase.status === 'error') {
      // Count as complete if it errored (won't run)
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
    return {
      company: this.phases.find(p => p.key === 'company')?.data || null,
      team: this.phases.find(p => p.key === 'team')?.data || null,
      funding: this.phases.find(p => p.key === 'funding')?.data || null,
      competitive: this.phases.find(p => p.key === 'competitive')?.data || null,
      market: this.phases.find(p => p.key === 'market')?.data || null,
      iprisk: this.phases.find(p => p.key === 'iprisk')?.data || null,
      techDescription: this.techDescription,
      duration: (Date.now() - this.startTime) / 1000
    };
  }

  /**
   * Check if all phases completed
   */
  isComplete() {
    return this.phases.every(phase => phase.status === 'completed');
  }

  /**
   * Get phase status
   */
  getPhaseStatus(key) {
    const phase = this.phases.find(p => p.key === key);
    return phase ? phase.status : null;
  }

  /**
   * Reset pipeline
   */
  reset() {
    if (this.abortController) {
      this.abortController.abort();
    }
    
    this.startTime = null;
    this.abortController = null;
    this.companyUrl = null;
    this.techDescription = null;
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
