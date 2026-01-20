// js/components/modal-manager.js
// Modal Management Component

class ModalManager {
  constructor() {
    this.activeModal = null;
    this.overlay = null;
    this.content = null;
    this.resolvePromise = null;
  }

  init() {
    this.overlay = document.getElementById('modal-overlay');
    this.content = document.getElementById('modal-content');
    
    if (!this.overlay) {
      console.error('Modal overlay not found');
      return;
    }
    
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeModal) {
        this.close();
      }
    });
    
    console.log('ModalManager initialized');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  showResumeModal(savedState) {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      
      const companyUrl = savedState.companyInput?.url || 'Unknown';
      const completedPhases = savedState.completedPhases || {};
      const completedCount = Object.keys(completedPhases).length;
      const timestamp = savedState.timestamp ? new Date(savedState.timestamp).toLocaleString() : 'Unknown';
      
      const phases = ['company', 'team', 'funding', 'competitive', 'market', 'iprisk'];
      const phaseNames = {
        company: 'Company Overview',
        team: 'Team Analysis',
        funding: 'Funding Analysis',
        competitive: 'Competitive Risk',
        market: 'Market Opportunity',
        iprisk: 'IP Risk'
      };
      
      let checklistHtml = '';
      phases.forEach(phase => {
        const isComplete = !!completedPhases[phase];
        const iconClass = isComplete ? 'check-icon' : 'pending-icon';
        const iconPath = isComplete 
          ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
          : '<circle cx="12" cy="12" r="10"/>';
        checklistHtml += '<li><svg class="' + iconClass + '" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + iconPath + '</svg> ' + phaseNames[phase] + '</li>';
      });
      
      const modalHtml = '<div class="modal-header"><h3><svg class="modal-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Incomplete Analysis Found</h3></div>' +
        '<div class="modal-body">' +
        '<p>You have an incomplete assessment. Would you like to resume or start fresh?</p>' +
        '<div class="modal-info">' +
        '<div class="modal-info-row"><span class="modal-info-label">Company URL</span><span class="modal-info-value">' + this.escapeHtml(companyUrl) + '</span></div>' +
        '<div class="modal-info-row"><span class="modal-info-label">Progress</span><span class="modal-info-value">' + completedCount + ' of 6 complete</span></div>' +
        '<div class="modal-info-row"><span class="modal-info-label">Last Updated</span><span class="modal-info-value">' + timestamp + '</span></div>' +
        '</div>' +
        '<ul class="modal-checklist">' + checklistHtml + '</ul>' +
        '</div>' +
        '<div class="modal-footer">' +
        '<button class="btn outline" data-action="new">Start New</button>' +
        '<button class="btn primary" data-action="resume">Resume Analysis</button>' +
        '</div>';
      
      this.show(modalHtml, (action) => {
        resolve(action === 'resume' ? 'resume' : 'new');
      });
    });
  }

  showPartialExportModal(exportStatus) {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      
      const phases = ['company', 'team', 'funding', 'competitive', 'market', 'iprisk'];
      const phaseNames = {
        company: 'Company Overview',
        team: 'Team Analysis',
        funding: 'Funding Analysis',
        competitive: 'Competitive Risk',
        market: 'Market Opportunity',
        iprisk: 'IP Risk'
      };
      
      let checklistHtml = '';
      let completeCount = 0;
      
      phases.forEach(phase => {
        const isComplete = exportStatus[phase] === 'complete' || exportStatus[phase] === true;
        if (isComplete) completeCount++;
        
        const iconClass = isComplete ? 'check-icon' : 'pending-icon';
        const iconPath = isComplete 
          ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
          : '<circle cx="12" cy="12" r="10"/>';
        const status = isComplete ? '' : ' (not included)';
        checklistHtml += '<li><svg class="' + iconClass + '" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + iconPath + '</svg> ' + phaseNames[phase] + status + '</li>';
      });
      
      const modalHtml = '<div class="modal-header"><h3><svg class="modal-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Partial Export</h3></div>' +
        '<div class="modal-body">' +
        '<p>' + completeCount + ' of 6 assessments are complete. The PDF will indicate missing sections.</p>' +
        '<ul class="modal-checklist">' + checklistHtml + '</ul>' +
        '</div>' +
        '<div class="modal-footer">' +
        '<button class="btn outline" data-action="cancel">Cancel</button>' +
        '<button class="btn primary" data-action="export">Export Partial PDF</button>' +
        '</div>';
      
      this.show(modalHtml, (action) => {
        resolve(action === 'export');
      });
    });
  }

  showErrorModal(phase, error) {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      
      const modalHtml = '<div class="modal-header"><h3><svg class="modal-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>Analysis Error</h3></div>' +
        '<div class="modal-body">' +
        '<p>The ' + this.escapeHtml(phase) + ' analysis encountered an error:</p>' +
        '<div class="modal-info"><p style="color: var(--brand-error);">' + this.escapeHtml(error.message || 'Unknown error') + '</p></div>' +
        '</div>' +
        '<div class="modal-footer">' +
        '<button class="btn outline" data-action="skip">Skip</button>' +
        '<button class="btn outline danger" data-action="cancel">Cancel All</button>' +
        '<button class="btn primary" data-action="retry">Retry</button>' +
        '</div>';
      
      this.show(modalHtml, resolve);
    });
  }

  /**
   * Show final submit confirmation modal when all scores are entered
   * @param {Object} data - Scores data and metadata
   * @param {Object} data.scores - Score data for each dimension
   * @param {Array} data.missingJustifications - Dimensions missing justifications
   * @param {string} data.avgAiScore - Average AI score
   * @param {string} data.avgUserScore - Average user score
   * @returns {Promise<string>} - 'submit', 'addJustifications', or 'cancel'
   */
  showFinalSubmitModal(data) {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      
      const { scores, missingJustifications, avgAiScore, avgUserScore } = data;
      const hasMissingJustifications = missingJustifications && missingJustifications.length > 0;
      
      const dimensionNames = {
        team: 'Team Analysis',
        funding: 'Funding Analysis',
        competitive: 'Competitive Risk',
        market: 'Market Opportunity',
        iprisk: 'IP Risk'
      };
      
      // Build missing justifications list
      let missingListHtml = '';
      if (hasMissingJustifications) {
        missingListHtml = '<div class="modal-warning">' +
          '<div class="warning-icon">⚠️</div>' +
          '<div class="warning-content">' +
          '<strong>Missing justifications:</strong>' +
          '<ul class="missing-list">' +
          missingJustifications.map(dim => '<li>' + dimensionNames[dim] + '</li>').join('') +
          '</ul>' +
          '<p class="warning-note">You can add justifications now or submit without them.</p>' +
          '</div>' +
          '</div>';
      }
      
      const modalHtml = '<div class="modal-header">' +
        '<h3>' +
        '<svg class="modal-icon success" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
        '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>' +
        '<polyline points="22 4 12 14.01 9 11.01"/>' +
        '</svg>' +
        'All Assessments Complete' +
        '</h3>' +
        '</div>' +
        '<div class="modal-body">' +
        '<p>Ready to submit final scores to the database. Scores can be updated later if needed.</p>' +
        '<div class="modal-info">' +
        '<div class="modal-info-row">' +
        '<span class="modal-info-label">Average AI Score</span>' +
        '<span class="modal-info-value score-value">' + avgAiScore + '</span>' +
        '</div>' +
        '<div class="modal-info-row">' +
        '<span class="modal-info-label">Average User Score</span>' +
        '<span class="modal-info-value score-value">' + avgUserScore + '</span>' +
        '</div>' +
        '</div>' +
        missingListHtml +
        '</div>' +
        '<div class="modal-footer">' +
        '<button class="btn outline" data-action="cancel">Cancel</button>' +
        (hasMissingJustifications ? '<button class="btn outline" data-action="addJustifications">Add Justifications</button>' : '') +
        '<button class="btn primary" data-action="submit">' + (hasMissingJustifications ? 'Submit Anyway' : 'Submit Final Scores') + '</button>' +
        '</div>';
      
      this.show(modalHtml, resolve);
    });
  }

  /**
   * Show Load Previous Assessment modal with searchable list
   * @param {Array} assessments - List of cached assessments
   * @returns {Promise<Object|null>} - Selected assessment or null if cancelled
   */
  showLoadPreviousModal(assessments) {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.selectedAssessment = null;
      
      // Build assessment list HTML
      const listHtml = assessments.length > 0 
        ? assessments.map((a, i) => `
          <div class="assessment-list-item" data-key="${this.escapeHtml(a.key)}" data-index="${i}">
            <div class="assessment-item-main">
              <span class="assessment-venture-name">${this.escapeHtml(a.ventureName)}</span>
              <span class="assessment-date">${a.date}</span>
            </div>
            <div class="assessment-item-meta">
              <span class="assessment-advisor">${this.escapeHtml(a.advisorName)}</span>
              ${a.hasFullData ? '<span class="assessment-badge full-data">Full Data</span>' : '<span class="assessment-badge scores-only">Scores Only</span>'}
            </div>
          </div>
        `).join('')
        : '<div class="no-assessments-message">No previous assessments found.<br><br>Complete an assessment to see it here.</div>';
      
      const modalHtml = `
        <div class="modal-header">
          <h3>
            <svg class="modal-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            Load Previous Assessment
          </h3>
        </div>
        <div class="modal-body">
          <p>Select a previous assessment to load. Assessments with "Full Data" include all AI evidence.</p>
          <div class="assessment-search-container">
            <input type="text" id="assessment-search" class="assessment-search" placeholder="Search by venture name..." autocomplete="off">
          </div>
          <div class="assessment-list" id="assessment-list">
            ${listHtml}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn outline" data-action="cancel">Cancel</button>
          <button class="btn primary" data-action="load" id="load-assessment-btn" disabled>Load Assessment</button>
        </div>
      `;
      
      this.show(modalHtml, (action) => {
        if (action === 'load' && this.selectedAssessment !== null) {
          resolve(assessments[this.selectedAssessment]);
        } else {
          resolve(null);
        }
      });
      
      // Set up search and selection handlers
      this.setupLoadPreviousHandlers(assessments);
    });
  }

  /**
   * Set up event handlers for Load Previous modal
   * @param {Array} assessments - List of assessments
   */
  setupLoadPreviousHandlers(assessments) {
    const searchInput = document.getElementById('assessment-search');
    const listContainer = document.getElementById('assessment-list');
    const loadBtn = document.getElementById('load-assessment-btn');
    
    if (!searchInput || !listContainer || !loadBtn) return;
    
    // Search handler
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase().trim();
      const items = listContainer.querySelectorAll('.assessment-list-item');
      
      items.forEach(item => {
        const ventureName = item.querySelector('.assessment-venture-name')?.textContent?.toLowerCase() || '';
        const advisorName = item.querySelector('.assessment-advisor')?.textContent?.toLowerCase() || '';
        const matches = !query || ventureName.includes(query) || advisorName.includes(query);
        item.style.display = matches ? '' : 'none';
      });
    });
    
    // Selection handler
    listContainer.addEventListener('click', (e) => {
      const item = e.target.closest('.assessment-list-item');
      if (!item) return;
      
      // Deselect previous
      listContainer.querySelectorAll('.assessment-list-item').forEach(i => {
        i.classList.remove('selected');
      });
      
      // Select this item
      item.classList.add('selected');
      this.selectedAssessment = parseInt(item.dataset.index, 10);
      
      // Enable load button
      loadBtn.disabled = false;
    });
    
    // Double-click to load immediately
    listContainer.addEventListener('dblclick', (e) => {
      const item = e.target.closest('.assessment-list-item');
      if (!item) return;
      
      this.selectedAssessment = parseInt(item.dataset.index, 10);
      loadBtn.click();
    });
    
    // Focus search input
    searchInput.focus();
  }

  /**
   * Show notification that only scores were loaded (no full AI data)
   * @param {string} ventureName - Name of the venture
   * @returns {Promise<string>} - 'continue' or 'rerun'
   */
  showScoresOnlyLoadedModal(ventureName) {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      
      const modalHtml = `
        <div class="modal-header">
          <h3>
            <svg class="modal-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            Scores Loaded
          </h3>
        </div>
        <div class="modal-body">
          <p>Previous scores for <strong>${this.escapeHtml(ventureName)}</strong> have been loaded.</p>
          <div class="modal-info">
            <p style="margin: 0;">The full AI analysis data is not available. You can:</p>
            <ul style="margin: 12px 0 0 20px; padding: 0;">
              <li style="margin-bottom: 8px;">Continue with just the scores (update them as needed)</li>
              <li>Re-run the full analysis to regenerate AI evidence</li>
            </ul>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn outline" data-action="rerun">Re-run Analysis</button>
          <button class="btn primary" data-action="continue">Continue with Scores</button>
        </div>
      `;
      
      this.show(modalHtml, resolve);
    });
  }

  show(html, onAction) {
    if (!this.content || !this.overlay) return;
    
    this.content.innerHTML = html;
    this.activeModal = true;
    this.overlay.classList.add('visible');
    
    // Add button handlers
    this.content.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        this.close();
        if (onAction) onAction(action);
      });
    });
    
    // Focus first button
    const firstBtn = this.content.querySelector('button');
    if (firstBtn) firstBtn.focus();
  }

  close() {
    if (!this.overlay) return;
    
    this.overlay.classList.remove('visible');
    this.activeModal = null;
    
    if (this.content) {
      setTimeout(() => {
        this.content.innerHTML = '';
      }, 200);
    }
  }
}

window.ModalManager = ModalManager;
