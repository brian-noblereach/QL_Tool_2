// js/api/stack-proxy.js - Stack AI Proxy Client
// Routes all Stack AI calls through Google Apps Script proxy to protect API keys
// Supports file uploads for company analysis

const StackProxy = {
  // Google Apps Script Web App URL
  proxyUrl: 'https://script.google.com/macros/s/AKfycbzt7wElvzQv0CNs-icg7QWpxjf4E5FGqWa6KpCY4zSa_thccGNWhw-THLTpnn8GJa2W/exec',
  
  // Maximum URL length for GET requests
  maxUrlLength: 6000,
  
  // Maximum payload text length for inputs
  maxInputLength: 4000,
  
  // Session user ID (unique per browser session to avoid file conflicts)
  userId: null,
  
  /**
   * Get or generate session user ID
   */
  getUserId() {
    if (!this.userId) {
      this.userId = 'qual_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    }
    return this.userId;
  },
  
  /**
   * Call a Stack AI workflow through the proxy (no file upload)
   * 
   * @param {string} workflow - Workflow name
   * @param {Object} payload - The payload to send to Stack AI
   * @param {AbortSignal} abortSignal - Optional abort signal
   * @returns {Promise<Object>} The Stack AI response
   */
  async call(workflow, payload, abortSignal = null) {
    try {
      console.log(`[StackProxy] Calling ${workflow} workflow`);
      
      // Ensure user_id is set
      if (!payload.user_id) {
        payload.user_id = this.getUserId();
      }
      
      // Truncate long input fields to prevent URI too long errors
      const safePayload = this.truncatePayload(payload);
      
      // Build request data
      const requestData = {
        action: 'stackai',
        workflow: workflow,
        payload: safePayload
      };
      
      const jsonData = JSON.stringify(requestData);
      const encodedData = encodeURIComponent(jsonData);
      const url = `${this.proxyUrl}?data=${encodedData}`;
      
      // Check if URL is too long
      if (url.length > this.maxUrlLength) {
        console.warn(`[StackProxy] URL length ${url.length} exceeds max ${this.maxUrlLength}, further truncating payload`);
        const shorterPayload = this.truncatePayload(payload, 2000);
        shorterPayload.user_id = payload.user_id;
        const shorterRequestData = {
          action: 'stackai',
          workflow: workflow,
          payload: shorterPayload
        };
        const shorterUrl = `${this.proxyUrl}?data=${encodeURIComponent(JSON.stringify(shorterRequestData))}`;
        
        if (shorterUrl.length > this.maxUrlLength) {
          throw new Error(`Payload too large for ${workflow} workflow. Please try with a shorter description.`);
        }
        
        return await this.executeRequest(shorterUrl, abortSignal, workflow);
      }
      
      return await this.executeRequest(url, abortSignal, workflow);
      
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`${workflow} analysis cancelled`);
      }
      console.error(`[StackProxy] ${workflow} error:`, error);
      throw error;
    }
  },
  
  /**
   * Call a Stack AI workflow with file upload
   * Uses hidden iframe form submission to bypass CORS restrictions
   * 
   * @param {string} workflow - Workflow name (company_file or company_both)
   * @param {File} file - The file to upload
   * @param {string} websiteUrl - Optional website URL (for company_both)
   * @param {AbortSignal} abortSignal - Optional abort signal
   * @returns {Promise<Object>} The Stack AI response
   */
  async callWithFile(workflow, file, websiteUrl = null, abortSignal = null) {
    try {
      console.log(`[StackProxy] Calling ${workflow} workflow with file: ${file.name}`);
      
      // Convert file to base64
      const fileBase64 = await this.fileToBase64(file);
      
      console.log(`[StackProxy] File size: ${file.size} bytes, base64 length: ${fileBase64.length}`);
      
      // Build request data
      const requestData = {
        action: 'stackai_upload',
        workflow: workflow,
        userId: this.getUserId(),
        fileName: file.name,
        fileBase64: fileBase64,
        mimeType: file.type || this.getMimeType(file.name),
        websiteUrl: websiteUrl || ''
      };
      
      // Use iframe form submission to bypass CORS
      const result = await this.postViaIframe(requestData, abortSignal);
      
      if (result.success) {
        console.log(`[StackProxy] ${workflow} workflow with file completed successfully`);
        return result.data;
      } else {
        throw new Error(result.error || result.details || 'File upload request failed');
      }
      
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`${workflow} analysis cancelled`);
      }
      console.error(`[StackProxy] ${workflow} file upload error:`, error);
      throw error;
    }
  },
  
  /**
   * POST data via hidden iframe to bypass CORS
   * Google Apps Script allows form submissions without CORS issues
   */
  async postViaIframe(data, abortSignal = null) {
    return new Promise((resolve, reject) => {
      // Google Apps Script has a 6-minute timeout for web apps
      // Stack AI workflows can take 5-8 minutes for file processing
      // We set a slightly longer timeout to account for this
      const timeoutMs = 420000; // 7 minutes
      let timeoutId;
      let completed = false;
      let pollInterval;
      
      // Create unique ID for this request
      const requestId = 'upload_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
      
      // Create hidden iframe
      const iframe = document.createElement('iframe');
      iframe.name = requestId;
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      
      // Create form
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = this.proxyUrl;
      form.target = requestId;
      form.style.display = 'none';
      
      // Add data as hidden input
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'data';
      input.value = JSON.stringify(data);
      form.appendChild(input);
      
      document.body.appendChild(form);
      
      // Cleanup function
      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (pollInterval) clearInterval(pollInterval);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        if (form.parentNode) form.parentNode.removeChild(form);
        window.removeEventListener('message', messageHandler);
      };
      
      // Handle response via postMessage (Apps Script can send this)
      const messageHandler = (event) => {
        // Verify origin is from Google
        if (!event.origin.includes('script.google.com') && !event.origin.includes('googleusercontent.com')) {
          return;
        }
        
        try {
          const response = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (response && response._requestId === requestId) {
            completed = true;
            cleanup();
            resolve(response);
          }
        } catch (e) {
          // Not our message, ignore
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      // Function to try reading iframe content
      const tryReadIframe = () => {
        if (completed) return false;
        
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc && iframeDoc.body) {
            const responseText = iframeDoc.body.innerText || iframeDoc.body.textContent;
            if (responseText && responseText.trim()) {
              // Check if it looks like JSON
              const trimmed = responseText.trim();
              if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                const result = JSON.parse(trimmed);
                completed = true;
                cleanup();
                resolve(result);
                return true;
              }
            }
          }
        } catch (e) {
          // Cross-origin or parse error - continue waiting
        }
        return false;
      };
      
      // Handle iframe load
      iframe.onload = () => {
        if (completed) return;
        
        // Try to read immediately
        if (tryReadIframe()) return;
        
        // If we can't read it, log and wait
        console.log('[StackProxy] Iframe loaded but cannot read content (cross-origin), waiting...');
      };
      
      // Poll the iframe periodically in case we missed the load event
      pollInterval = setInterval(() => {
        tryReadIframe();
      }, 2000);
      
      // Handle abort signal
      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          if (!completed) {
            completed = true;
            cleanup();
            reject(new Error('Upload cancelled'));
          }
        });
      }
      
      // Timeout with helpful error message
      timeoutId = setTimeout(() => {
        if (!completed) {
          completed = true;
          cleanup();
          reject(new Error(
            'File analysis timed out. Large documents may take longer than the server allows. ' +
            'Please try with a smaller file or use a website URL instead.'
          ));
        }
      }, timeoutMs);
      
      // Submit form
      console.log('[StackProxy] Submitting file upload via iframe form...');
      form.submit();
    });
  },
  
  /**
   * Convert a File to base64 string
   */
  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },
  
  /**
   * Get MIME type from filename
   */
  getMimeType(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    const mimeTypes = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  },
  
  /**
   * Execute a GET request
   */
  async executeRequest(url, abortSignal, workflow) {
    const response = await fetch(url, {
      method: 'GET',
      signal: abortSignal
    });
    
    const responseText = await response.text();
    let result;
    
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('[StackProxy] Failed to parse response:', responseText);
      throw new Error('Invalid response from proxy server');
    }
    
    if (result.success) {
      console.log(`[StackProxy] ${workflow} workflow completed successfully`);
      return result.data;
    } else {
      throw new Error(result.error || result.details || 'Proxy request failed');
    }
  },
  
  /**
   * Truncate long text fields in payload to prevent URI too long errors
   */
  truncatePayload(payload, maxLength = null) {
    const limit = maxLength || this.maxInputLength;
    const safePayload = { ...payload };
    
    for (const key of Object.keys(safePayload)) {
      if (typeof safePayload[key] === 'string' && safePayload[key].length > limit) {
        console.log(`[StackProxy] Truncating ${key} from ${safePayload[key].length} to ${limit} chars`);
        safePayload[key] = safePayload[key].substring(0, limit) + '... [truncated]';
      }
    }
    
    return safePayload;
  },
  
  /**
   * Test proxy connection
   */
  async testConnection() {
    try {
      const response = await fetch(this.proxyUrl, {
        method: 'GET'
      });
      const data = await response.json();
      console.log('[StackProxy] Connection test:', data);
      return data.status === 'ok';
    } catch (error) {
      console.error('[StackProxy] Connection test failed:', error);
      return false;
    }
  }
};

// Make available globally
window.StackProxy = StackProxy;
