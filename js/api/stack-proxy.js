// js/api/stack-proxy.js - Stack AI Proxy Client
// Routes all Stack AI calls through Google Apps Script proxy to protect API keys
// Handles large payloads by chunking or limiting data size

const StackProxy = {
  // Google Apps Script Web App URL - same as Smartsheet proxy
  proxyUrl: 'https://script.google.com/macros/s/AKfycbzt7wElvzQv0CNs-icg7QWpxjf4E5FGqWa6KpCY4zSa_thccGNWhw-THLTpnn8GJa2W/exec',
  
  // Maximum URL length to stay safe across browsers
  maxUrlLength: 6000,
  
  // Maximum payload text length for inputs
  maxInputLength: 4000,
  
  /**
   * Call a Stack AI workflow through the proxy
   * 
   * @param {string} workflow - Workflow name (company, team, funding, competitive, market, iprisk)
   * @param {Object} payload - The payload to send to Stack AI
   * @param {AbortSignal} abortSignal - Optional abort signal
   * @returns {Promise<Object>} The Stack AI response
   */
  async call(workflow, payload, abortSignal = null) {
    try {
      console.log(`[StackProxy] Calling ${workflow} workflow`);
      
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
        // Further truncate and retry
        const shorterPayload = this.truncatePayload(payload, 2000);
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
   * Execute the actual fetch request
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
    
    // Truncate any string field that's too long
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
