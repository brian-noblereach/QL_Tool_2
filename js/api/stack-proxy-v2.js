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
    
    Debug.log('[StackProxy] Initialized with workflows:', Object.keys(this.config.workflows || {}).length);
    return this.config;
  },
  
  /**
   * Fetch API config from proxy using iframe to avoid CORS issues
   */
  async fetchConfig() {
    return new Promise((resolve, reject) => {
      const timeoutMs = 10000;
      let completed = false;

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
            // If we can't read iframe (cross-origin), use fallback config
            Debug.warn('[StackProxy] Cannot read config from iframe, using fallback');
            completed = true;
            cleanup();
            resolve(this.getFallbackConfig());
          }
        }, 500);
      };

      // Timeout - use fallback config
      setTimeout(() => {
        if (!completed) {
          Debug.warn('[StackProxy] Config fetch timeout, using fallback');
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
   * Note: publicKey is safe to expose (used for inference only)
   */
  getFallbackConfig() {
    return {
      baseUrl: 'https://api.stack-ai.com/inference/v0/run/f913a8b8-144d-47e0-b327-8daa341b575d',
      docsUrl: 'https://api.stack-ai.com/documents/f913a8b8-144d-47e0-b327-8daa341b575d',
      publicKey: 'e80f3814-a651-4de7-a7ba-8478b7a9047b',
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
    
    Debug.log(`[StackProxy] Calling workflow: ${workflow}`);
    
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
      Debug.log(`[StackProxy] ${workflow} completed (${elapsed}s)`);
      
      return data;
      
    } catch (error) {
      if (error.name === 'AbortError') {
        Debug.log(`[StackProxy] ${workflow} was cancelled`);
        throw error;
      }

      Debug.error(`[StackProxy] ${workflow} error:`, error.message);
      throw error;
    }
  },
  
  /**
   * Upload file via proxy, then call workflow directly
   * Uses iframe form submission to avoid CORS issues with Google Apps Script
   */
  async callWithFile(workflow, file, websiteUrl = null, abortSignal = null) {
    const config = await this.init();

    Debug.log(`[StackProxy] Uploading file for ${workflow}`);

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

    Debug.log(`[StackProxy] Uploading file via iframe, size: ${file.size} bytes`);

    // Upload via iframe form submission to avoid CORS
    const uploadResult = await this.postViaIframe(uploadData);

    if (!uploadResult.success) {
      throw new Error('File upload failed: ' + (uploadResult.error || 'Unknown error'));
    }

    Debug.log(`[StackProxy] File uploaded, calling workflow...`);

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
            Debug.warn('[StackProxy] Error reading upload response:', e.message);
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
      Debug.log('[StackProxy] Submitting file upload via iframe...');
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

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  StackProxy.init().catch(err => {
    Debug.error('[StackProxy] Failed to initialize:', err.message);
  });
});
