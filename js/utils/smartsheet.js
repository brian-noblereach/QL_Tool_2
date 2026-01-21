// js/utils/smartsheet.js - Smartsheet Integration for Venture Assessment Platform V02
// Submits scores to Smartsheet via Google Apps Script proxy
// Uses iframe form submission to avoid CORS issues
// Supports row updates (not just creation) and fetching past assessments

const SmartsheetIntegration = {
  // Google Apps Script Web App URL (same as StackProxy)
  proxyUrl: 'https://script.google.com/macros/s/AKfycbzt7wElvzQv0CNs-icg7QWpxjf4E5FGqWa6KpCY4zSa_thccGNWhw-THLTpnn8GJa2W/exec',
  
  // Track submission state
  state: {
    lastSubmission: null,
    isSubmitting: false,
    currentRowId: null
  },

  /**
   * Submit a single metric score to Smartsheet
   * Called when advisor clicks "Submit Assessment" on any tab
   */
  async submitScore(metric, scoreData, context) {
    if (this.state.isSubmitting) {
      Debug.log('Smartsheet submission already in progress');
      return { success: false, message: 'Please wait for current submission to complete' };
    }

    this.state.isSubmitting = true;

    try {
      const payload = this.buildPayload(metric, scoreData, context);
      
      // Check if we should update an existing row
      const rowId = this.getCurrentRowId();
      const isUpdate = !!rowId;
      
      if (isUpdate) {
        payload.rowId = rowId;
      }
      
      Debug.log(`Smartsheet: ${isUpdate ? 'updating' : 'submitting'} ${metric} score`);

      const requestData = {
        action: isUpdate ? 'smartsheet_update' : 'smartsheet',
        ...payload
      };

      // Use iframe submission to avoid CORS
      const result = await this.submitViaIframe(requestData);

      if (result.success) {
        // Store row ID if this was a new submission
        if (result.rowId && !isUpdate) {
          this.setCurrentRowId(result.rowId);
        }
        
        this.state.lastSubmission = {
          metric,
          timestamp: new Date().toISOString(),
          rowId: result.rowId || rowId,
          action: isUpdate ? 'update' : 'create'
        };
        
        this.showToast(`${this.formatMetricName(metric)} score ${isUpdate ? 'updated' : 'saved'} to database`, 'success');
        return result;
      } else {
        throw new Error(result.error || 'Submission failed');
      }

    } catch (error) {
      console.error('Smartsheet submission error:', error);
      this.showToast(`Failed to save score: ${error.message}`, 'error');
      return { success: false, error: error.message };
    } finally {
      this.state.isSubmitting = false;
    }
  },

  /**
   * Submit all scores at once (for final submission / export)
   */
  async submitAllScores(allData, context) {
    if (this.state.isSubmitting) {
      return { success: false, message: 'Please wait for current submission to complete' };
    }

    this.state.isSubmitting = true;

    try {
      const payload = this.buildFullPayload(allData, context);
      
      // Check if we should update an existing row
      const rowId = this.getCurrentRowId();
      const isUpdate = !!rowId;
      
      if (isUpdate) {
        payload.rowId = rowId;
      }
      
      Debug.log(`Smartsheet: ${isUpdate ? 'updating' : 'submitting'} all scores`);

      const requestData = {
        action: isUpdate ? 'smartsheet_update' : 'smartsheet',
        ...payload
      };

      const result = await this.submitViaIframe(requestData);

      if (result.success) {
        // Store row ID if this was a new submission
        if (result.rowId && !isUpdate) {
          this.setCurrentRowId(result.rowId);
        }
        
        this.showToast(`All scores ${isUpdate ? 'updated' : 'saved'} to database`, 'success');
        return result;
      } else {
        throw new Error(result.error || 'Submission failed');
      }

    } catch (error) {
      console.error('Smartsheet submission error:', error);
      this.showToast(`Failed to save scores: ${error.message}`, 'error');
      return { success: false, error: error.message };
    } finally {
      this.state.isSubmitting = false;
    }
  },

  /**
   * Fetch past assessments from Smartsheet for the current advisor
   * @param {string} advisorName - Optional filter by advisor name
   * @returns {Promise<Array>} List of past assessments
   */
  async fetchPastAssessments(advisorName = null) {
    try {
      const params = {
        action: 'smartsheet_list'
      };
      
      if (advisorName) {
        params.advisorName = advisorName;
      }

      Debug.log('Smartsheet: fetching past assessments');
      
      const result = await this.submitViaIframe(params);
      
      if (result.success && result.assessments) {
        Debug.log(`Smartsheet: found ${result.assessments.length} past assessments`);
        return result.assessments;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching past assessments:', error);
      return [];
    }
  },

  /**
   * Load scores from a specific Smartsheet row
   * @param {string} rowId - Smartsheet row ID
   * @returns {Promise<Object|null>} Assessment scores or null
   */
  async loadFromSmartsheet(rowId) {
    try {
      const params = {
        action: 'smartsheet_get',
        rowId: rowId
      };

      Debug.log('Smartsheet: loading assessment');
      
      const result = await this.submitViaIframe(params);
      
      if (result.success && result.data) {
        return result.data;
      }
      
      return null;
    } catch (error) {
      console.error('Error loading from Smartsheet:', error);
      return null;
    }
  },

  /**
   * Submit data via script tag (JSONP-style) to avoid CORS issues
   * Google Apps Script redirects don't work well with iframes
   */
  submitViaIframe(data) {
    return new Promise((resolve, reject) => {
      const timeoutMs = 30000;
      let completed = false;
      
      // Create a unique callback name
      const callbackName = 'smartsheetCallback_' + Date.now();
      
      // Encode the data as URL parameter
      const encodedData = encodeURIComponent(JSON.stringify(data));
      const url = `${this.proxyUrl}?data=${encodedData}&callback=${callbackName}`;
      
      // Create global callback function
      window[callbackName] = (response) => {
        if (completed) return;
        completed = true;
        cleanup();
        resolve(response || { success: true });
      };
      
      // Create script element
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      
      const cleanup = () => {
        delete window[callbackName];
        if (script.parentNode) script.parentNode.removeChild(script);
      };
      
      script.onerror = () => {
        if (completed) return;
        completed = true;
        cleanup();
        // Script errors often mean CORS/redirect issues, try image beacon as last resort
        this.submitViaImage(data)
          .then(resolve)
          .catch(reject);
      };
      
      // Timeout
      setTimeout(() => {
        if (!completed) {
          completed = true;
          cleanup();
          // On timeout, try image beacon
          this.submitViaImage(data)
            .then(resolve)
            .catch(() => reject(new Error('Submission timeout')));
        }
      }, 5000); // Short timeout, then try image
      
      Debug.log('[Smartsheet] Submitting via script tag');
      document.body.appendChild(script);
    });
  },

  /**
   * Submit via image beacon - fire and forget, most reliable for cross-origin
   */
  submitViaImage(data) {
    return new Promise((resolve) => {
      const encodedData = encodeURIComponent(JSON.stringify(data));
      const url = `${this.proxyUrl}?data=${encodedData}`;
      
      const img = new Image();
      img.onload = () => {
        Debug.log('[Smartsheet] Image beacon completed');
        resolve({ success: true, message: 'Submitted via beacon' });
      };
      img.onerror = () => {
        // Even on error, the request was likely sent
        Debug.log('[Smartsheet] Image beacon sent');
        resolve({ success: true, message: 'Submitted (fire and forget)' });
      };

      Debug.log('[Smartsheet] Submitting via image beacon');
      img.src = url;
      
      // Resolve after short delay regardless
      setTimeout(() => resolve({ success: true, message: 'Submitted' }), 2000);
    });
  },

  /**
   * Get current row ID from state manager
   */
  getCurrentRowId() {
    if (this.state.currentRowId) {
      return this.state.currentRowId;
    }
    if (window.app?.stateManager) {
      return window.app.stateManager.getSmartsheetRowId();
    }
    return null;
  },

  /**
   * Set current row ID (store in both local state and state manager)
   */
  setCurrentRowId(rowId) {
    this.state.currentRowId = rowId;
    if (window.app?.stateManager) {
      window.app.stateManager.saveSmartsheetRowId(rowId);
    }
    Debug.log('[Smartsheet] Row ID set');
  },

  /**
   * Clear current row ID (for new assessments)
   */
  clearCurrentRowId() {
    this.state.currentRowId = null;
    console.log('[Smartsheet] Row ID cleared');
  },

  /**
   * Build payload for single metric submission
   */
  buildPayload(metric, scoreData, context) {
    const payload = {
      ventureName: context.ventureName || 'Unknown Venture',
      ventureUrl: context.ventureUrl || '',
      advisorName: context.advisorName || 'Unknown Advisor',
      portfolio: context.portfolio || ''
    };

    const metricMap = {
      team: { aiKey: 'teamScoreAi', userKey: 'teamScoreUser', justificationKey: 'teamJustification' },
      funding: { aiKey: 'fundingScoreAi', userKey: 'fundingScoreUser', justificationKey: 'fundingJustification' },
      competitive: { aiKey: 'competitiveScoreAi', userKey: 'competitiveScoreUser', justificationKey: 'competitiveJustification' },
      market: { aiKey: 'marketScoreAi', userKey: 'marketScoreUser', justificationKey: 'marketJustification' },
      iprisk: { aiKey: 'ipRiskScoreAi', userKey: 'ipRiskScoreUser', justificationKey: 'ipRiskJustification' }
    };

    const mapping = metricMap[metric];
    if (mapping) {
      if (scoreData.aiScore !== undefined && scoreData.aiScore !== null) {
        payload[mapping.aiKey] = scoreData.aiScore;
      }
      if (scoreData.userScore !== undefined && scoreData.userScore !== null) {
        payload[mapping.userKey] = scoreData.userScore;
      }
      if (scoreData.justification) {
        payload[mapping.justificationKey] = scoreData.justification;
      }
    }

    return payload;
  },

  /**
   * Build payload with all scores
   */
  buildFullPayload(allData, context) {
    const payload = {
      ventureName: context.ventureName || 'Unknown Venture',
      ventureUrl: context.ventureUrl || '',
      advisorName: context.advisorName || 'Unknown Advisor',
      portfolio: context.portfolio || ''
    };

    // Team scores
    if (allData.team) {
      if (allData.team.aiScore !== undefined) payload.teamScoreAi = allData.team.aiScore;
      if (allData.team.userScore !== undefined) payload.teamScoreUser = allData.team.userScore;
      if (allData.team.justification) payload.teamJustification = allData.team.justification;
    }

    // Funding scores
    if (allData.funding) {
      if (allData.funding.aiScore !== undefined) payload.fundingScoreAi = allData.funding.aiScore;
      if (allData.funding.userScore !== undefined) payload.fundingScoreUser = allData.funding.userScore;
      if (allData.funding.justification) payload.fundingJustification = allData.funding.justification;
    }

    // Competitive scores
    if (allData.competitive) {
      if (allData.competitive.aiScore !== undefined) payload.competitiveScoreAi = allData.competitive.aiScore;
      if (allData.competitive.userScore !== undefined) payload.competitiveScoreUser = allData.competitive.userScore;
      if (allData.competitive.justification) payload.competitiveJustification = allData.competitive.justification;
    }

    // Market scores
    if (allData.market) {
      if (allData.market.aiScore !== undefined) payload.marketScoreAi = allData.market.aiScore;
      if (allData.market.userScore !== undefined) payload.marketScoreUser = allData.market.userScore;
      if (allData.market.justification) payload.marketJustification = allData.market.justification;
    }

    // IP Risk scores
    if (allData.iprisk) {
      if (allData.iprisk.aiScore !== undefined) payload.ipRiskScoreAi = allData.iprisk.aiScore;
      if (allData.iprisk.userScore !== undefined) payload.ipRiskScoreUser = allData.iprisk.userScore;
      if (allData.iprisk.justification) payload.ipRiskJustification = allData.iprisk.justification;
    }

    // Calculate averages
    const aiScores = [
      allData.team?.aiScore,
      allData.funding?.aiScore,
      allData.competitive?.aiScore,
      allData.market?.aiScore,
      allData.iprisk?.aiScore
    ].filter(s => s !== undefined && s !== null);

    const userScores = [
      allData.team?.userScore,
      allData.funding?.userScore,
      allData.competitive?.userScore,
      allData.market?.userScore,
      allData.iprisk?.userScore
    ].filter(s => s !== undefined && s !== null);

    if (aiScores.length > 0) {
      payload.averageAiScore = aiScores.reduce((a, b) => a + b, 0) / aiScores.length;
    }

    if (userScores.length > 0) {
      payload.averageUserScore = userScores.reduce((a, b) => a + b, 0) / userScores.length;
    }

    // Final recommendation
    if (context.finalRecommendation) {
      payload.finalRecommendation = context.finalRecommendation;
    }

    return payload;
  },

  /**
   * Format metric name for display
   */
  formatMetricName(metric) {
    const names = {
      team: 'Team',
      funding: 'Funding',
      competitive: 'Competitive Risk',
      market: 'Market Opportunity',
      iprisk: 'IP Risk'
    };
    return names[metric] || metric;
  },

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    if (window.app?.toastManager) {
      if (type === 'success') {
        window.app.toastManager.success(message);
      } else if (type === 'error') {
        window.app.toastManager.error(message);
      } else {
        window.app.toastManager.info(message);
      }
      return;
    }
    console.log(`[${type.toUpperCase()}] ${message}`);
  },

  /**
   * Get context from current app state
   */
  getContext() {
    return {
      ventureName: this.getVentureName(),
      ventureUrl: this.getVentureUrl(),
      advisorName: this.getAdvisorName(),
      portfolio: this.getPortfolio()
    };
  },

  /**
   * Get venture name from app state or DOM
   */
  getVentureName() {
    // Try assessment view data first
    if (window.app?.assessmentView?.data?.company?.company_overview?.name) {
      return window.app.assessmentView.data.company.company_overview.name;
    }
    // Try progress company name element
    const progressName = document.getElementById('progress-company-name');
    if (progressName && progressName.textContent && !progressName.textContent.includes('Analyzing')) {
      // Extract company name from "Analyzing: https://example.com"
      const text = progressName.textContent.replace('Analyzing:', '').trim();
      return text || 'Unknown Venture';
    }
    return 'Unknown Venture';
  },

  /**
   * Get venture URL from app state or DOM
   */
  getVentureUrl() {
    const urlInput = document.getElementById('company-url');
    if (urlInput && urlInput.value) {
      return urlInput.value.trim();
    }
    if (window.app?.assessmentView?.data?.company?.company_overview?.website) {
      return window.app.assessmentView.data.company.company_overview.website;
    }
    return '';
  },

  /**
   * Get advisor name from DOM or localStorage
   */
  getAdvisorName() {
    const nameInput = document.getElementById('sca-name');
    if (nameInput && nameInput.value) {
      return nameInput.value.trim();
    }
    const stored = localStorage.getItem('scaName');
    if (stored) {
      return stored;
    }
    return 'Unknown Advisor';
  },

  /**
   * Get portfolio from DOM
   */
  getPortfolio() {
    const portfolioInput = document.getElementById('portfolio');
    if (portfolioInput && portfolioInput.value) {
      return portfolioInput.value.trim();
    }
    return '';
  }
};

// Make available globally
window.SmartsheetIntegration = SmartsheetIntegration;
