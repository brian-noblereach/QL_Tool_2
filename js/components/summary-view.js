// js/components/summary-view.js - Summary panel display (V02)
// Updated to handle actual API data structures

class SummaryView {
  constructor() {
    this.data = null;
    this.recommendationSubmitted = false;
  }

  init() {
    Debug.log('SummaryView initialized');
    this.setupFinalRecommendation();
    this.setupDatabaseSync();
  }

  /**
   * Set up event handlers for the Final Recommendation section
   */
  setupFinalRecommendation() {
    const section = document.getElementById('final-recommendation-section');
    const textarea = document.getElementById('final-recommendation-text');
    const charCount = document.getElementById('recommendation-char-count');
    const submitBtn = document.getElementById('submit-final-recommendation');

    if (!section || !textarea || !submitBtn) return;

    // Character counter and auto-save
    textarea.addEventListener('input', () => {
      const length = textarea.value.length;
      charCount.textContent = `${length} / 2000`;

      // Enable button only if there's content and all scores submitted
      const hasText = length > 0;
      const allSubmitted = this.allScoresSubmitted();
      submitBtn.disabled = !hasText || !allSubmitted;

      // Update button text to indicate what's needed
      if (hasText && !allSubmitted) {
        submitBtn.textContent = 'Submit scores first';
      } else if (!hasText) {
        submitBtn.textContent = 'Enter recommendation';
      } else {
        submitBtn.textContent = 'Submit Final Assessment';
      }

      // Auto-save to state
      window.app?.stateManager?.saveFinalRecommendation(textarea.value);
    });

    // Submit handler
    submitBtn.addEventListener('click', () => this.submitFinalRecommendation());

    // Load saved recommendation if exists
    const saved = window.app?.stateManager?.getFinalRecommendation();
    if (saved) {
      textarea.value = saved;
      charCount.textContent = `${saved.length} / 2000`;
    }
  }

  /**
   * Check if all 5 dimension scores have been submitted
   */
  allScoresSubmitted() {
    const scores = window.app?.assessmentView?.userScores || {};
    const dimensions = ['team', 'funding', 'competitive', 'market', 'iprisk'];
    return dimensions.every(d => scores[d]?.submitted);
  }

  /**
   * Check if all 5 sections have generated data (AI analysis complete)
   * This is different from allScoresSubmitted - we want to show the recommendation
   * field as soon as the sections have content, not after user submits scores
   */
  allSectionsGenerated() {
    const data = window.app?.assessmentView?.data;
    if (!data) return false;

    // Check if we have data for all 5 sections
    return !!(data.team && data.funding && data.competitive && data.market && data.iprisk);
  }

  /**
   * Submit the final recommendation to Smartsheet
   */
  async submitFinalRecommendation() {
    const textarea = document.getElementById('final-recommendation-text');
    const submitBtn = document.getElementById('submit-final-recommendation');
    const section = document.getElementById('final-recommendation-section');

    if (!textarea?.value.trim()) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
      await window.app.submitFinalAssessmentWithRecommendation(textarea.value);

      section.classList.add('submitted');
      submitBtn.textContent = '✓ Submitted';
      this.recommendationSubmitted = true;

      window.app?.toastManager?.success('Final assessment submitted successfully');
    } catch (error) {
      Debug.error('[SummaryView] Failed to submit recommendation:', error.message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Final Assessment';
      window.app?.toastManager?.error('Failed to submit. Please try again.');
    }
  }

  /**
   * Show or hide the recommendation section based on whether sections have data
   * The section is visible once all AI analyses are complete (sections generated)
   * The submit button is only enabled once all scores are submitted
   */
  showRecommendationSection() {
    const section = document.getElementById('final-recommendation-section');
    if (!section) return;

    // Show section once all sections have generated data
    if (this.allSectionsGenerated()) {
      section.classList.remove('hidden');

      // Enable submit button only if all scores submitted AND there's text
      const textarea = document.getElementById('final-recommendation-text');
      const submitBtn = document.getElementById('submit-final-recommendation');
      if (textarea && submitBtn && !this.recommendationSubmitted) {
        const hasText = textarea.value.length > 0;
        const allSubmitted = this.allScoresSubmitted();
        submitBtn.disabled = !hasText || !allSubmitted;

        // Update button text to indicate what's needed
        if (hasText && !allSubmitted) {
          submitBtn.textContent = 'Submit scores first';
        } else if (!hasText) {
          submitBtn.textContent = 'Enter recommendation';
        } else {
          submitBtn.textContent = 'Submit Final Assessment';
        }
      }
    } else {
      section.classList.add('hidden');
    }
  }

  /**
   * Set up event handlers for the Database Sync section
   */
  setupDatabaseSync() {
    const checkBtn = document.getElementById('check-sync-status');
    const forceSyncBtn = document.getElementById('force-sync-btn');

    if (checkBtn) {
      checkBtn.addEventListener('click', () => this.checkSyncStatus());
    }

    if (forceSyncBtn) {
      forceSyncBtn.addEventListener('click', () => this.forceSyncAllData());
    }
  }

  /**
   * Check the current sync status and display it
   */
  async checkSyncStatus() {
    const statusContent = document.getElementById('sync-status-content');
    const checkBtn = document.getElementById('check-sync-status');

    if (!statusContent) return;

    checkBtn.disabled = true;
    checkBtn.textContent = 'Checking...';

    try {
      // Get current row ID if exists
      const rowId = window.SmartsheetIntegration?.getCurrentRowId();

      // Get submitted scores
      const scores = window.app?.assessmentView?.userScores || {};
      const dimensions = ['team', 'funding', 'competitive', 'market', 'iprisk'];

      const statusItems = dimensions.map(dim => {
        const dimScore = scores[dim];
        const isSubmitted = dimScore?.submitted;
        const label = this.formatDimensionName(dim);

        if (!isSubmitted) {
          return `<li><span class="status-icon pending">○</span> ${label}: Not scored yet</li>`;
        }

        // If we have a row ID, assume it's synced (we can't easily verify without API call)
        if (rowId) {
          return `<li><span class="status-icon synced">✓</span> ${label}: Score ${dimScore.score}/9 - Synced</li>`;
        }

        return `<li><span class="status-icon not-synced">✗</span> ${label}: Score ${dimScore.score}/9 - Not synced</li>`;
      });

      // Check final recommendation
      const finalRec = window.app?.stateManager?.getFinalRecommendation();
      if (finalRec) {
        if (rowId && this.recommendationSubmitted) {
          statusItems.push(`<li><span class="status-icon synced">✓</span> Final Recommendation: Synced</li>`);
        } else {
          statusItems.push(`<li><span class="status-icon not-synced">✗</span> Final Recommendation: Not synced</li>`);
        }
      }

      const rowIdStatus = rowId
        ? `<p style="font-size: 12px; color: var(--slate-500); margin-top: 8px;">Database Row ID: ${rowId}</p>`
        : `<p style="font-size: 12px; color: var(--brand-warning); margin-top: 8px;">No database record found. Click "Force Sync" to create one.</p>`;

      statusContent.innerHTML = `
        <ul class="sync-status-list">
          ${statusItems.join('')}
        </ul>
        ${rowIdStatus}
      `;

    } catch (error) {
      Debug.error('[SummaryView] Error checking sync status:', error.message);
      statusContent.innerHTML = `
        <div class="sync-result error">
          Error checking status: ${error.message}
        </div>
      `;
    } finally {
      checkBtn.disabled = false;
      checkBtn.textContent = 'Check Status';
    }
  }

  /**
   * Force sync all data to the database
   */
  async forceSyncAllData() {
    const forceSyncBtn = document.getElementById('force-sync-btn');
    const statusContent = document.getElementById('sync-status-content');

    if (!forceSyncBtn) return;

    forceSyncBtn.disabled = true;
    forceSyncBtn.textContent = 'Syncing...';

    try {
      // Get final recommendation if any
      const finalRecommendation = window.app?.stateManager?.getFinalRecommendation() || '';

      // Get context
      const context = window.SmartsheetIntegration.getContext();
      if (finalRecommendation) {
        context.finalRecommendation = finalRecommendation;
      }

      // Gather all score data
      const av = window.app?.assessmentView;
      const allData = {
        team: {
          aiScore: av?.aiScores?.team,
          userScore: av?.userScores?.team?.score,
          justification: av?.userScores?.team?.justification
        },
        funding: {
          aiScore: av?.aiScores?.funding,
          userScore: av?.userScores?.funding?.score,
          justification: av?.userScores?.funding?.justification
        },
        competitive: {
          aiScore: av?.aiScores?.competitive,
          userScore: av?.userScores?.competitive?.score,
          justification: av?.userScores?.competitive?.justification
        },
        market: {
          aiScore: av?.aiScores?.market,
          userScore: av?.userScores?.market?.score,
          justification: av?.userScores?.market?.justification
        },
        iprisk: {
          aiScore: av?.aiScores?.iprisk,
          userScore: av?.userScores?.iprisk?.score,
          justification: av?.userScores?.iprisk?.justification
        }
      };

      // Submit to Smartsheet
      const result = await window.SmartsheetIntegration.submitAllScores(allData, context);

      if (result?.success) {
        statusContent.innerHTML = `
          <div class="sync-result success">
            All data synced successfully!
            ${result.rowId ? `<br>Row ID: ${result.rowId}` : ''}
          </div>
        `;
        window.app?.toastManager?.success('All data synced to database');

        // Refresh status display after a short delay
        setTimeout(() => this.checkSyncStatus(), 1500);
      } else {
        throw new Error(result?.error || 'Sync failed');
      }

    } catch (error) {
      Debug.error('[SummaryView] Force sync failed:', error.message);
      statusContent.innerHTML = `
        <div class="sync-result error">
          Sync failed: ${error.message}<br>
          <small>Please try again or contact support if the issue persists.</small>
        </div>
      `;
      window.app?.toastManager?.error('Sync failed. Please try again.');
    } finally {
      forceSyncBtn.disabled = false;
      forceSyncBtn.textContent = 'Force Sync All Data';
    }
  }

  /**
   * Format dimension name for display
   */
  formatDimensionName(dim) {
    const names = {
      team: 'Team',
      funding: 'Funding',
      competitive: 'Competitive Risk',
      market: 'Market Opportunity',
      iprisk: 'IP Risk'
    };
    return names[dim] || dim;
  }

  update(results) {
    this.data = results;
    
    const container = document.getElementById('summary-content');
    if (!container) {
      console.error('Summary container not found');
      return;
    }
    
    const scores = this.calculateScores(results);
    const statusInfo = this.getStatusInfo(results);
    
    container.innerHTML = `
      ${statusInfo.hasFailures ? `
        <div class="summary-warning">
          <span class="warning-icon">⚠️</span>
          <span>${statusInfo.failedCount} assessment(s) failed. Partial results shown below.</span>
        </div>
      ` : ''}
      
      <div class="summary-header">
        <div class="company-summary-info">
          <h3>${this.escape(window.app?.getVentureName() || results.company?.company_overview?.name || 'Unknown Company')}</h3>
          <p>${this.escape(results.company?.company_overview?.company_description || results.company?.company_overview?.mission_statement || 'No description available.')}</p>
        </div>
        <div class="overall-score-display">
          <div class="overall-score-value ${this.getScoreClass(scores.overall)}">${scores.overall}</div>
          <div class="overall-score-label">Average AI Score</div>
          ${scores.userOverall !== '-' ? `
            <div class="user-overall">
              <span class="user-overall-value">${scores.userOverall}</span>
              <span class="user-overall-label">Your Average</span>
            </div>
          ` : ''}
        </div>
      </div>
      
      <div class="summary-scores-grid">
        ${this.renderScoreCard('Team', 'team', results.team)}
        ${this.renderScoreCard('Funding', 'funding', results.funding)}
        ${this.renderScoreCard('Competitive Risk', 'competitive', results.competitive)}
        ${this.renderScoreCard('Market Opportunity', 'market', results.market)}
        ${this.renderScoreCard('IP Risk', 'iprisk', results.iprisk)}
      </div>
      
      <div class="summary-actions">
        <p class="submission-status">
          ${statusInfo.submittedCount} of 5 assessments submitted
          ${statusInfo.submittedCount < 5 && !statusInfo.hasFailures ?
            '<span class="status-hint">• Submit assessments in each tab before exporting</span>' : ''}
        </p>
      </div>
    `;

    // Show/hide the final recommendation section based on submission status
    this.showRecommendationSection();
  }

  // Extract AI score from various data structures
  getAIScore(data, dimension) {
    if (!data) return null;
    
    // Handle array format (info + scoring)
    if (Array.isArray(data)) {
      const scoringObj = data[1] || data[0];
      if (dimension === 'funding') {
        return scoringObj?.funding_score || scoringObj?.score;
      }
      return scoringObj?.score;
    }
    
    // Handle object format with various score locations
    if (dimension === 'competitive') {
      return data.score || data.assessment?.score;
    }
    if (dimension === 'market') {
      return data.score || data.scoring?.score;
    }
    if (dimension === 'funding') {
      return data.funding_score || data.score;
    }
    
    return data.score;
  }

  calculateScores(results) {
    const aiScores = [
      this.getAIScore(results.team, 'team'),
      this.getAIScore(results.funding, 'funding'),
      this.getAIScore(results.competitive, 'competitive'),
      this.getAIScore(results.market, 'market'),
      this.getAIScore(results.iprisk, 'iprisk')
    ].filter(s => typeof s === 'number');
    
    const userScores = [];
    if (window.assessmentView) {
      const av = window.assessmentView;
      ['team', 'funding', 'competitive', 'market', 'iprisk'].forEach(dim => {
        if (av.userScores[dim]?.submitted && typeof av.userScores[dim].score === 'number') {
          userScores.push(av.userScores[dim].score);
        }
      });
    }
    
    const overall = aiScores.length > 0 
      ? (aiScores.reduce((a, b) => a + b, 0) / aiScores.length).toFixed(1)
      : '-';
    
    const userOverall = userScores.length > 0 
      ? (userScores.reduce((a, b) => a + b, 0) / userScores.length).toFixed(1)
      : '-';
    
    return { overall, userOverall };
  }

  getStatusInfo(results) {
    let failedCount = 0;
    let submittedCount = 0;
    
    // Check for failed phases
    if (!results.team) failedCount++;
    if (!results.funding) failedCount++;
    if (!results.competitive) failedCount++;
    if (!results.market) failedCount++;
    if (!results.iprisk) failedCount++;
    
    // Check submitted assessments
    if (window.assessmentView) {
      const av = window.assessmentView;
      ['team', 'funding', 'competitive', 'market', 'iprisk'].forEach(dim => {
        if (av.userScores[dim]?.submitted) submittedCount++;
      });
    }
    
    return {
      hasFailures: failedCount > 0,
      failedCount,
      submittedCount
    };
  }

  renderScoreCard(label, dimension, data) {
    // Check if phase failed
    if (!data) {
      return `
        <div class="summary-score-card failed">
          <h4>${label}</h4>
          <div class="score-row">
            <div class="ai-score-display">
              <span class="score-label">AI Score</span>
              <span class="score-value failed">—</span>
            </div>
            <div class="user-score-display">
              <span class="score-label">Your Score</span>
              <span class="score-value">—</span>
            </div>
          </div>
          <div class="card-status failed">Analysis failed</div>
        </div>
      `;
    }
    
    // Get AI score using helper
    const aiScore = this.getAIScore(data, dimension);
    
    // Get user score from assessmentView
    let userScore = null;
    let isSubmitted = false;
    let justification = '';
    
    if (window.assessmentView) {
      const userScoreData = window.assessmentView.userScores[dimension];
      if (userScoreData?.submitted) {
        userScore = userScoreData.score;
        isSubmitted = true;
        justification = userScoreData.justification || '';
      }
    }
    
    const aiScoreClass = this.getScoreClass(aiScore);
    const userScoreClass = this.getScoreClass(userScore);
    const hasDeviation = isSubmitted && aiScore !== null && userScore !== null && Math.abs(aiScore - userScore) >= 2;
    
    return `
      <div class="summary-score-card ${isSubmitted ? 'submitted' : 'pending'}">
        <h4>${label}</h4>
        <div class="score-row">
          <div class="ai-score-display">
            <span class="score-label">AI Score</span>
            <span class="score-value ${aiScoreClass}">${aiScore !== null ? aiScore : '—'}</span>
          </div>
          <div class="user-score-display">
            <span class="score-label">Your Score</span>
            <span class="score-value ${isSubmitted ? userScoreClass : ''}">${isSubmitted ? userScore : '—'}</span>
          </div>
        </div>
        ${hasDeviation ? `<div class="deviation-note">Differs from AI by ${Math.abs(aiScore - userScore)}</div>` : ''}
        ${isSubmitted && justification ? `
          <div class="justification-preview">
            <strong>Your rationale:</strong> ${this.escape(this.truncate(justification, 100))}
          </div>
        ` : ''}
        <div class="card-status ${isSubmitted ? 'submitted' : 'pending'}">
          ${isSubmitted ? '✓ Submitted' : 'Not submitted'}
        </div>
      </div>
    `;
  }

  getScoreClass(score) {
    if (typeof score !== 'number') return '';
    if (score <= 3) return 'low';
    if (score <= 6) return 'medium';
    return 'high';
  }

  truncate(str, maxLength) {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
  }

  escape(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }
}

window.SummaryView = SummaryView;
