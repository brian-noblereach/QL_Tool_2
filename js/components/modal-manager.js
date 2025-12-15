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
