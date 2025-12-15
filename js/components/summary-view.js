// js/components/summary-view.js - Summary panel display (V02)
// Updated to handle actual API data structures

class SummaryView {
  constructor() {
    this.data = null;
  }

  init() {
    console.log('SummaryView initialized');
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
          <h3>${this.escape(results.company?.company_overview?.name || 'Unknown Company')}</h3>
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
