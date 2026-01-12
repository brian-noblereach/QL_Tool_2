// js/api/stack-proxy-v2.js - Direct Stack AI calls with proxy for config/auth only
// This approach avoids Google Apps Script timeout limits by calling Stack AI directly from browser

const StackProxy = {
  // Google Apps Script proxy URL (only used for config and file uploads)
  proxyUrl: 'https://script.google.com/macros/s/AKfycbzt7wElvzQv0CNs-icg7QWpxjf4E5FGqWa6KpCY4zSa_thccGNWhw-THLTpnn8GJa2W/exec',
  
  // Cached config from proxy
  config: null,
  configPromise: null,
  
  /**
   * Initialize - fetch config from proxy
   */
  async init() {
    if (this.config) return this.config;
    
    // Avoid multiple simultaneous config fetches
    if (this.configPromise) return this.configPromise;
    
    this.configPromise = this.fetchConfig();
    this.config = await this.configPromise;
    this.configPromise = null;
    
    console.log('[StackProxy] Initialized with config:', Object.keys(this.config.workflows || {}));
    return this.config;
  },
  
  /**
   * Fetch API config from proxy
   */
  async fetchConfig() {
    const url = `${this.proxyUrl}?action=config&origin=${encodeURIComponent(window.location.origin)}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (!data.success || !data.config) {
        throw new Error(data.error || 'Failed to fetch config');
      }
      
      return data.config;
      
    } catch (error) {
      console.error('[StackProxy] Failed to fetch config:', error);
      throw new Error('Failed to connect to API proxy: ' + error.message);
    }
  },
  
  /**
   * Call a Stack AI workflow directly (no proxy for inference)
   */
  async call(workflow, payload, abortSignal = null) {
    // Ensure config is loaded
    const config = await this.init();
    
    const workflowId = config.workflows[workflow];
    if (!workflowId) {
      throw new Error(`Unknown workflow: ${workflow}`);
    }
    
    const url = `${config.baseUrl}/${workflowId}`;
    
    console.log(`[StackProxy] Calling ${workflow} directly at ${url}`);
    
    const startTime = Date.now();
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.publicKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: abortSignal
      });
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[StackProxy] ${workflow} failed (${elapsed}s):`, response.status, errorText);
        throw new Error(`API error ${response.status}: ${errorText.slice(0, 200)}`);
      }
      
      const data = await response.json();
      console.log(`[StackProxy] ${workflow} completed successfully (${elapsed}s)`);
      
      return data;
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log(`[StackProxy] ${workflow} was cancelled`);
        throw error;
      }
      
      console.error(`[StackProxy] ${workflow} error:`, error);
      throw error;
    }
  },
  
  /**
   * Upload file via proxy, then call workflow directly
   */
  async callWithFile(workflow, file, websiteUrl = null, abortSignal = null) {
    const config = await this.init();
    
    console.log(`[StackProxy] Uploading file for ${workflow}: ${file.name}`);
    
    // Step 1: Upload file via proxy (needs private key)
    const fileBase64 = await this.fileToBase64(file);
    const userId = this.getUserId();
    
    const uploadData = {
      action: 'upload_file',
      workflow: workflow,
      userId: userId,
      fileName: file.name,
      fileBase64: fileBase64,
      mimeType: file.type || this.getMimeType(file.name)
    };
    
    // Upload via proxy
    const uploadResponse = await fetch(this.proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(uploadData),
      signal: abortSignal
    });
    
    const uploadResult = await uploadResponse.json();
    
    if (!uploadResult.success) {
      throw new Error('File upload failed: ' + (uploadResult.error || 'Unknown error'));
    }
    
    console.log(`[StackProxy] File uploaded, now calling workflow directly...`);
    
    // Step 2: Wait a moment for file to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 3: Call the workflow directly (no proxy needed)
    const payload = {
      user_id: userId,
      'doc-0': null  // Indicates uploaded document exists
    };
    
    // Add website URL if this is the "both" workflow
    if (websiteUrl && workflow === 'company_both') {
      payload['in-0'] = websiteUrl;
    }
    
    return this.call(workflow, payload, abortSignal);
  },
  
  /**
   * Convert File to base64
   */
  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  },
  
  /**
   * Get/generate user ID for file uploads
   */
  getUserId() {
    let userId = sessionStorage.getItem('stack_user_id');
    if (!userId) {
      userId = 'qual_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
      sessionStorage.setItem('stack_user_id', userId);
    }
    return userId;
  },
  
  /**
   * Get MIME type from filename
   */
  getMimeType(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const mimeTypes = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
};

// Make available globally
window.StackProxy = StackProxy;

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  StackProxy.init().catch(err => {
    console.error('[StackProxy] Failed to initialize:', err);
  });
});
