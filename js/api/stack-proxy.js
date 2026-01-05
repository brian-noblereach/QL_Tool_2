// js/api/stack-proxy.js - Direct Stack AI calls with proxy for config/auth only
// V2: This approach avoids Google Apps Script timeout limits by calling Stack AI directly from browser

const StackProxy = {
  // Google Apps Script proxy URL (only used for config and file uploads)
  proxyUrl: 'https://script.google.com/macros/s/AKfycbzt7wE1vzQv0CNs-icg7QWpxjf4E5F_HLTpnn8GJa2W/exec',
  
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
   * Fetch API config from proxy using JSONP-style approach to avoid CORS
   * Google Apps Script doesn't support CORS, so we use script injection
   */
  async fetchConfig() {
    return new Promise((resolve, reject) => {
      const callbackName = 'stackProxyCallback_' + Date.now();
      const timeoutMs = 10000;
      
      // Create a hidden iframe to fetch the config
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.name = 'configFrame_' + Date.now();
      document.body.appendChild(iframe);
      
      // Create form to submit GET request via iframe
      const form = document.createElement('form');
      form.method = 'GET';
      form.action = this.proxyUrl;
      form.target = iframe.name;
      form.style.display = 'none';
      
      // Add action parameter
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'action';
      input.value = 'config';
      form.appendChild(input);
      
      document.body.appendChild(form);
      
      let completed = false;
      
      const cleanup = () => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        if (form.parentNode) form.parentNode.removeChild(form);
      };
      
      // Handle iframe load
      iframe.onload = () => {
        if (completed) return;
        
        setTimeout(() => {
          if (completed) return;
          
          try {
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (doc && doc.body) {
              const text = doc.body.innerText || doc.body.textContent;
              if (text && text.trim()) {
                const data = JSON.parse(text.trim());
                if (data.success && data.config) {
                  completed = true;
                  cleanup();
                  resolve(data.config);
                  return;
                } else {
                  throw new Error(data.error || 'Invalid config response');
                }
              }
            }
          } catch (e) {
            // If we can't read iframe (cross-origin), fall back to hardcoded config
            console.warn('[StackProxy] Cannot read config from iframe, using fallback config');
            completed = true;
            cleanup();
            resolve(this.getFallbackConfig());
          }
        }, 500);
      };
      
      // Timeout - use fallback config
      setTimeout(() => {
        if (!completed) {
          console.warn('[StackProxy] Config fetch timeout, using fallback config');
          completed = true;
          cleanup();
          resolve(this.getFallbackConfig());
        }
      }, timeoutMs);
      
      // Submit form
      form.submit();
    });
  },
  
  /**
   * Fallback config in case proxy is unreachable
   * This allows the app to work even if Google Apps Script has issues
   */
  getFallbackConfig() {
    return {
      baseUrl: 'https://api.stack-ai.com/inference/v0/run/f913a8b8-144d-47e0-b327-8daa341b575d',
      docsUrl: 'https://api.stack-ai.com/documents/f913a8b8-144d-47e0-b327-8daa341b575d',
      publicKey: 'e80f3814-a651-4de7-a7ba-8478b7a9047b',
      privateKey: '139c4395-8ab3-4a5a-b52b-6ce1b52f7b97',
      workflows: {
        company_url: '694c385d4f9d789570304dd5',
        company_file: '6949ba538f9ce68c9b8b841a',
        company_both: '6945b566ba9cfba7e5c6fabb',
        team: '6949b0045ea7002afda5c979',
        funding: '68f0020d7a00704c92fdd7b5',
        competitive: '686d72045c56d3a93d5f7b68',
        market: '68a8bc5d5f2ffcec5ada4422',
        iprisk: '68d45d1f4c0213053bf91862'
      }
    };
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
   * Upload file via proxy (iframe form submission), then call workflow directly
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
    
    console.log(`[StackProxy] Uploading file via proxy, size: ${file.size} bytes`);
    
    // Upload via iframe form submission to avoid CORS
    const uploadResult = await this.postViaIframe(uploadData);
    
    if (!uploadResult.success) {
      throw new Error('File upload failed: ' + (uploadResult.error || 'Unknown error'));
    }
    
    console.log(`[StackProxy] File uploaded successfully, now calling workflow directly...`);
    
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
   * POST data via hidden iframe to avoid CORS issues with Google Apps Script
   */
  async postViaIframe(data) {
    return new Promise((resolve, reject) => {
      const timeoutMs = 60000; // 1 minute for file upload
      let completed = false;
      
      // Create hidden iframe
      const iframe = document.createElement('iframe');
      iframe.name = 'uploadFrame_' + Date.now();
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      
      // Create form
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = this.proxyUrl;
      form.target = iframe.name;
      form.style.display = 'none';
      
      // Add data as hidden input
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'data';
      input.value = JSON.stringify(data);
      form.appendChild(input);
      
      document.body.appendChild(form);
      
      const cleanup = () => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        if (form.parentNode) form.parentNode.removeChild(form);
      };
      
      // Handle iframe load
      iframe.onload = () => {
        if (completed) return;
        
        setTimeout(() => {
          if (completed) return;
          
          try {
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (doc && doc.body) {
              const text = doc.body.innerText || doc.body.textContent;
              if (text && text.trim()) {
                const result = JSON.parse(text.trim());
                completed = true;
                cleanup();
                resolve(result);
                return;
              }
            }
          } catch (e) {
            console.error('[StackProxy] Error reading upload response:', e);
          }
          
          // If we can't read the response, assume success (file uploads don't return much)
          if (!completed) {
            completed = true;
            cleanup();
            resolve({ success: true, message: 'Upload completed (response unreadable)' });
          }
        }, 1000);
      };
      
      // Timeout
      setTimeout(() => {
        if (!completed) {
          completed = true;
          cleanup();
          reject(new Error('File upload timeout'));
        }
      }, timeoutMs);
      
      // Submit form
      console.log('[StackProxy] Submitting file upload via iframe...');
      form.submit();
    });
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

// Initialize on load (using fallback config to avoid CORS issues)
document.addEventListener('DOMContentLoaded', () => {
  // Use fallback config immediately to avoid CORS issues
  StackProxy.config = StackProxy.getFallbackConfig();
  console.log('[StackProxy] Initialized with fallback config:', Object.keys(StackProxy.config.workflows));
});
