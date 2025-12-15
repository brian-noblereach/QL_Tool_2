// js/components/progress-view.js - Progress tracking display (V02)

class ProgressView {
  constructor() {
    this.pipeline = null;
    this.progressInterval = null;
    this.elements = {};
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
    this.startProgressUpdates();
  }

  startProgressUpdates() {
    this.progressInterval = setInterval(() => {
      if (!this.pipeline) return;
      
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
    
    if (this.elements.fill) this.elements.fill.style.width = '0%';
    if (this.elements.percentage) this.elements.percentage.textContent = '0%';
    if (this.elements.time) this.elements.time.textContent = 'Estimated: ~10 min';
  }
}

window.ProgressView = ProgressView;
