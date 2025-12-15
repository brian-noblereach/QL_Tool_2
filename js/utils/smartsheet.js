// js/utils/smartsheet.js - Smartsheet Integration for Venture Assessment Platform V02
// Submits scores to Smartsheet via Google Apps Script proxy

const SmartsheetIntegration = {
  // Google Apps Script Web App URL
  proxyUrl: 'https://script.google.com/macros/s/AKfycbzt7wElvzQv0CNs-icg7QWpxjf4E5FGqWa6KpCY4zSa_thccGNWhw-THLTpnn8GJa2W/exec',
  
  // Track submission state
  state: {
    lastSubmission: null,
    isSubmitting: false
  },

  /**
   * Submit a single metric score to Smartsheet
   * Called when advisor clicks "Submit Assessment" on any tab
   * 
   * @param {string} metric - The metric being submitted (team, funding, competitive, market, iprisk)
   * @param {Object} scoreData - Score data for this metric
   * @param {Object} context - Venture and advisor context
   * @returns {Promise<Object>} Submission result
   */
  async submitScore(metric, scoreData, context) {
    if (this.state.isSubmitting) {
      console.log('Submission already in progress, queuing...');
      return { success: false, message: 'Please wait for current submission to complete' };
    }

    this.state.isSubmitting = true;

    try {
      // Build payload with all available data
      const payload = this.buildPayload(metric, scoreData, context);
      
      console.log(`Submitting ${metric} score to Smartsheet:`, payload);

      const response = await fetch(this.proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        mode: 'cors'
      });

      // Google Apps Script returns text that we need to parse
      const responseText = await response.text();
      let result;
      
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response:', responseText);
        throw new Error('Invalid response from server');
      }

      if (result.success) {
        this.state.lastSubmission = {
          metric,
          timestamp: new Date().toISOString(),
          rowId: result.rowId,
          action: result.action
        };
        
        // Show success toast using ToastManager
        this.showToast(`${this.formatMetricName(metric)} score saved to database`, 'success');
        
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
   * 
   * @param {Object} allData - All assessment data
   * @param {Object} context - Venture and advisor context
   * @returns {Promise<Object>} Submission result
   */
  async submitAllScores(allData, context) {
    if (this.state.isSubmitting) {
      return { success: false, message: 'Please wait for current submission to complete' };
    }

    this.state.isSubmitting = true;

    try {
      const payload = this.buildFullPayload(allData, context);
      
      console.log('Submitting all scores to Smartsheet:', payload);

      const response = await fetch(this.proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        mode: 'cors'
      });

      const responseText = await response.text();
      let result;
      
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response:', responseText);
        throw new Error('Invalid response from server');
      }

      if (result.success) {
        this.showToast('All scores saved to database', 'success');
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
   * Build payload for single metric submission
   */
  buildPayload(metric, scoreData, context) {
    const payload = {
      // Required fields
      ventureName: context.ventureName || 'Unknown Venture',
      ventureUrl: context.ventureUrl || '',
      advisorName: context.advisorName || 'Unknown Advisor',
      portfolio: context.portfolio || ''
    };

    // Add metric-specific scores
    const metricMap = {
      team: {
        aiKey: 'teamScoreAi',
        userKey: 'teamScoreUser',
        justificationKey: 'teamJustification'
      },
      funding: {
        aiKey: 'fundingScoreAi',
        userKey: 'fundingScoreUser',
        justificationKey: 'fundingJustification'
      },
      competitive: {
        aiKey: 'competitiveScoreAi',
        userKey: 'competitiveScoreUser',
        justificationKey: 'competitiveJustification'
      },
      market: {
        aiKey: 'marketScoreAi',
        userKey: 'marketScoreUser',
        justificationKey: 'marketJustification'
      },
      iprisk: {
        aiKey: 'ipRiskScoreAi',
        userKey: 'ipRiskScoreUser',
        justificationKey: 'ipRiskJustification'
      }
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
   * Show toast notification - uses app's ToastManager if available
   */
  showToast(message, type = 'info') {
    // Try to use the app's toast manager
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

    // Fallback: create simple toast
    console.log(`[${type.toUpperCase()}] ${message}`);
  },

  /**
   * Get context from current app state
   * Call this to gather venture/advisor info before submission
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
    // Try state manager first
    if (window.app?.stateManager?.getCompanyData) {
      const companyData = window.app.stateManager.getCompanyData();
      if (companyData?.company_overview?.name) {
        return companyData.company_overview.name;
      }
    }
    // Try assessment view data
    if (window.app?.assessmentView?.data?.company?.company_overview?.name) {
      return window.app.assessmentView.data.company.company_overview.name;
    }
    // Try progress company name element
    const progressName = document.getElementById('progress-company-name');
    if (progressName && progressName.textContent && !progressName.textContent.includes('Analyzing')) {
      return progressName.textContent;
    }
    return 'Unknown Venture';
  },

  /**
   * Get venture URL from app state or DOM
   */
  getVentureUrl() {
    // Try state manager
    if (window.app?.stateManager?.getCompanyUrl) {
      const url = window.app.stateManager.getCompanyUrl();
      if (url) return url;
    }
    // Try input field
    const urlInput = document.getElementById('company-url');
    if (urlInput && urlInput.value) {
      return urlInput.value.trim();
    }
    // Try company data
    if (window.app?.assessmentView?.data?.company?.company_overview?.website) {
      return window.app.assessmentView.data.company.company_overview.website;
    }
    return '';
  },

  /**
   * Get advisor name from DOM or localStorage
   */
  getAdvisorName() {
    // Try input field (v02 uses sca-name)
    const nameInput = document.getElementById('sca-name');
    if (nameInput && nameInput.value) {
      return nameInput.value.trim();
    }
    // Try localStorage
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
    // Try portfolio input if it exists
    const portfolioInput = document.getElementById('portfolio');
    if (portfolioInput && portfolioInput.value) {
      return portfolioInput.value.trim();
    }
    return '';
  },

  /**
   * Test connection to proxy
   */
  async testConnection() {
    try {
      const response = await fetch(this.proxyUrl, {
        method: 'GET',
        mode: 'cors'
      });
      const data = await response.json();
      console.log('Smartsheet proxy status:', data);
      return data.status === 'ok';
    } catch (error) {
      console.error('Smartsheet proxy connection failed:', error);
      return false;
    }
  }
};

// Make available globally
window.SmartsheetIntegration = SmartsheetIntegration;
