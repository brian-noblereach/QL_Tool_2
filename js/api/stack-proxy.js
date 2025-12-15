// js/api/stack-proxy.js - Stack AI Proxy Client
// Routes all Stack AI calls through Google Apps Script proxy to protect API keys

const StackProxy = {
  // Google Apps Script Web App URL - same as Smartsheet proxy
  proxyUrl: 'https://script.google.com/macros/s/AKfycbzt7wElvzQv0CNs-icg7QWpxjf4E5FGqWa6KpCY4zSa_thccGNWhw-THLTpnn8GJa2W/exec',
  
  /**
   * Call a Stack AI workflow through the proxy
   * 
   * @param {string} workflow - Workflow name (company, team, funding, competitive, market, iprisk)
   * @param {Object} payload - The payload to send to Stack AI
   * @param {AbortSignal} abortSignal - Optional abort signal
   * @returns {Promise<Object>} The Stack AI response
   */
  async call(workflow, payload, abortSignal = null) {
    const controller = new AbortController();
    
    // Link external abort signal
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => controller.abort());
    }
    
    try {
      console.log(`[StackProxy] Calling ${workflow} workflow`);
      
      const response = await fetch(this.proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'stackai',
          workflow: workflow,
          payload: payload
        }),
        signal: controller.signal,
        mode: 'cors'
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
      
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`${workflow} analysis cancelled`);
      }
      console.error(`[StackProxy] ${workflow} error:`, error);
      throw error;
    }
  },
  
  /**
   * Test proxy connection
   */
  async testConnection() {
    try {
      const response = await fetch(this.proxyUrl, {
        method: 'GET',
        mode: 'cors'
      });
      const data = await response.json();
      console.log('[StackProxy] Connection test:', data);
      return data.status === 'ok' && data.endpoints?.includes('stackai');
    } catch (error) {
      console.error('[StackProxy] Connection test failed:', error);
      return false;
    }
  }
};

// Make available globally
window.StackProxy = StackProxy;
