// js/components/progress-view.js - Progress tracking display (V02)

class ProgressView {
  constructor() {
    this.pipeline = null;
    this.progressInterval = null;
    this.elapsedInterval = null;
    this.startTime = null;
    this.elements = {};
    this.isPartialComplete = false;
    this.lastMessageThreshold = 0;
  }

  init() {
    this.elements = {
      fill: document.getElementById('progress-fill'),
      percentage: document.getElementById('progress-percentage'),
      time: document.getElementById('progress-time'),
      companyName: document.getElementById('progress-company-name'),
      elapsed: document.getElementById('progress-elapsed'),
      message: document.getElementById('progress-message')
    };
    Debug.log('ProgressView initialized');
  }

  start(pipeline) {
    this.pipeline = pipeline;
    this.isPartialComplete = false;
    this.startTime = Date.now();
    this.lastMessageThreshold = 0;
    this.startProgressUpdates();
    this.startElapsedTimer();
  }

  startProgressUpdates() {
    this.progressInterval = setInterval(() => {
      if (!this.pipeline || this.isPartialComplete) return;

      const progress = this.pipeline.getProgress();
      this.updateDisplay(progress);
    }, 1000);
  }

  /**
   * Start elapsed time timer and show reassurance messages
   */
  startElapsedTimer() {
    this.elapsedInterval = setInterval(() => {
      if (!this.startTime) return;

      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      this.updateElapsedDisplay(elapsed);
      this.showReassuranceMessage(elapsed);
    }, 1000);
  }

  /**
   * Update elapsed time display
   */
  updateElapsedDisplay(elapsedSeconds) {
    if (!this.elements.elapsed) return;

    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    this.elements.elapsed.textContent = `Elapsed: ${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Show contextual reassurance messages based on elapsed time
   */
  showReassuranceMessage(elapsedSeconds) {
    if (!this.elements.message) return;

    // Define message thresholds (in seconds)
    const messages = [
      { threshold: 120, text: 'Analysis in progress...' },
      { threshold: 180, text: 'AI is analyzing multiple data sources. This can take several minutes.' },
      { threshold: 300, text: 'Still working. Complex analyses may take 5-10 minutes.' },
      { threshold: 420, text: 'Taking longer than usual. You may cancel and retry if needed.' },
      { threshold: 540, text: 'Approaching timeout limit. Consider canceling if no progress.' }
    ];

    // Find the appropriate message
    let currentMessage = '';
    for (const msg of messages) {
      if (elapsedSeconds >= msg.threshold && msg.threshold > this.lastMessageThreshold) {
        currentMessage = msg.text;
        this.lastMessageThreshold = msg.threshold;
      }
    }

    if (currentMessage) {
      this.elements.message.textContent = currentMessage;
      this.elements.message.classList.remove('hidden');

      // Add warning styling for later messages
      if (elapsedSeconds >= 420) {
        this.elements.message.classList.add('warning');
      }
    }
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
    this.stopAllTimers();
    const section = document.getElementById('progress-section');
    if (section) section.classList.add('hidden');
  }

  stopProgressUpdates() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  stopAllTimers() {
    this.stopProgressUpdates();
    if (this.elapsedInterval) {
      clearInterval(this.elapsedInterval);
      this.elapsedInterval = null;
    }
    this.startTime = null;
  }

  reset() {
    this.stopAllTimers();
    this.pipeline = null;
    this.isPartialComplete = false;
    this.lastMessageThreshold = 0;

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
    if (this.elements.elapsed) {
      this.elements.elapsed.textContent = '';
    }
    if (this.elements.message) {
      this.elements.message.textContent = '';
      this.elements.message.classList.add('hidden');
      this.elements.message.classList.remove('warning');
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
