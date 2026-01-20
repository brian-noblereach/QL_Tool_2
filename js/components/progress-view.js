// js/components/progress-view.js - Progress tracking display (V02)

class ProgressView {
  constructor() {
    this.pipeline = null;
    this.progressInterval = null;
    this.elements = {};
    this.isPartialComplete = false;
  }

  init() {
    this.elements = {
      fill: document.getElementById('progress-fill'),
      percentage: document.getElementById('progress-percentage'),
      time: document.getElementById('progress-time'),
      companyName: document.getElementById('progress-company-name')
    };
    console.log('ProgressView initialized');
  }

  start(pipeline) {
    this.pipeline = pipeline;
    this.isPartialComplete = false;
    this.startProgressUpdates();
  }

  startProgressUpdates() {
    this.progressInterval = setInterval(() => {
      if (!this.pipeline || this.isPartialComplete) return;
      
      const progress = this.pipeline.getProgress();
      this.updateDisplay(progress);
    }, 1000);
  }

  updateDisplay(progress) {
    if (this.elements.fill) {
      this.elements.fill.style.width = `${progress.percentage}%`;
    }
    
    if (this.elements.percentage) {
      this.elements.percentage.textContent = `${Math.round(progress.percentage)}%`;
    }
    
    if (this.elements.time) {
      const remaining = Math.max(0, Math.round(progress.remaining / 60));
      this.elements.time.textContent = remaining > 0 ? `~${remaining} min remaining` : 'Almost done...';
    }
  }

  /**
   * Show partial completion state with errors
   * @param {number} completedCount - Number of successfully completed phases
   * @param {number} failedCount - Number of failed phases
   */
  showPartialComplete(completedCount, failedCount) {
    this.isPartialComplete = true;
    this.stopProgressUpdates();
    
    const totalCount = completedCount + failedCount;
    
    // Update the main progress bar
    if (this.elements.fill) {
      this.elements.fill.style.width = '100%';
      this.elements.fill.classList.add('warning');
    }
    
    if (this.elements.percentage) {
      this.elements.percentage.textContent = `${completedCount} of ${totalCount} complete`;
      this.elements.percentage.classList.add('warning');
    }
    
    if (this.elements.time) {
      this.elements.time.textContent = `${failedCount} failed`;
      this.elements.time.classList.add('warning');
    }
  }

  /**
   * Update compact progress bar to show partial completion with errors
   * @param {number} completedCount - Number of successfully completed phases
   * @param {number} failedCount - Number of failed phases  
   */
  showCompactPartialComplete(completedCount, failedCount) {
    const compactProgress = document.getElementById('compact-progress');
    if (!compactProgress) return;
    
    const totalCount = completedCount + failedCount;
    
    // Show the compact progress bar
    compactProgress.classList.remove('hidden');
    compactProgress.classList.add('partial-complete');
    
    // Update the spinner icon to a warning icon
    const iconContainer = compactProgress.querySelector('.compact-progress-icon');
    if (iconContainer) {
      iconContainer.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      `;
    }
    
    // Update text
    const textEl = document.getElementById('compact-progress-text');
    if (textEl) {
      textEl.textContent = `${completedCount} of ${totalCount} complete (${failedCount} failed)`;
    }
    
    // Update progress bar fill
    const fillEl = document.getElementById('compact-progress-fill');
    if (fillEl) {
      fillEl.style.width = `${(completedCount / totalCount) * 100}%`;
      fillEl.classList.add('warning');
    }
    
    // Hide remaining time
    const timeEl = document.getElementById('compact-progress-time');
    if (timeEl) {
      timeEl.textContent = '';
    }
  }

  hide() {
    this.stopProgressUpdates();
    const section = document.getElementById('progress-section');
    if (section) section.classList.add('hidden');
  }

  stopProgressUpdates() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  reset() {
    this.stopProgressUpdates();
    this.pipeline = null;
    this.isPartialComplete = false;
    
    if (this.elements.fill) {
      this.elements.fill.style.width = '0%';
      this.elements.fill.classList.remove('warning');
    }
    if (this.elements.percentage) {
      this.elements.percentage.textContent = '0%';
      this.elements.percentage.classList.remove('warning');
    }
    if (this.elements.time) {
      this.elements.time.textContent = 'Estimated: ~10 min';
      this.elements.time.classList.remove('warning');
    }
    
    // Reset compact progress too
    const compactProgress = document.getElementById('compact-progress');
    if (compactProgress) {
      compactProgress.classList.remove('partial-complete');
      
      const iconContainer = compactProgress.querySelector('.compact-progress-icon');
      if (iconContainer) {
        iconContainer.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        `;
      }
      
      const fillEl = document.getElementById('compact-progress-fill');
      if (fillEl) {
        fillEl.classList.remove('warning');
      }
    }
  }
}

window.ProgressView = ProgressView;
