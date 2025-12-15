// js/api/base.js
// Sprint 3: Base API Class
//
// Common functionality for all API wrappers:
// - Fetch with timeout and abort signal
// - Response parsing
// - Error handling
// - Retry logic (future)

/**
 * API Error Class
 */
class APIError extends Error {
  constructor(message, statusCode = null, phase = null) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.phase = phase;
  }
}

/**
 * Base API Class
 * All API wrappers should extend this class
 */
class BaseAPI {
  constructor(config) {
    this.url = config.url;
    this.timeout = config.timeout || 480000; // 8 minutes default
    this.outputKeys = config.outputKeys || [];
    this.phaseName = config.phaseName || 'unknown';
    
    // API token - should be moved to backend in production
    this.token = 'e80f3814-a651-4de7-a7ba-8478b7a9047b';
  }

  /**
   * Get authorization headers
   * @returns {Object} Headers object
   */
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`
    };
  }

  /**
   * Build request payload
   * Override in subclasses for specific payload structures
   * @param {*} input - Input data
   * @returns {Object} Request payload
   */
  buildPayload(input) {
    // Default implementation - override in subclasses
    return { input };
  }

  /**
   * Process API response
   * Override in subclasses for specific response handling
   * @param {Object} data - Raw response data
   * @returns {Object} Processed data
   */
  processResponse(data) {
    // Default implementation - extract from output keys
    const outputs = data.outputs || {};
    
    // Find the first output key that has data
    for (const key of this.outputKeys) {
      if (outputs[key]) {
        return this.parseOutput(outputs[key]);
      }
    }
    
    throw new APIError('No output data found in response', null, this.phaseName);
  }

  /**
   * Parse output string as JSON
   * @param {string} output - Raw output string
   * @returns {Object} Parsed JSON
   */
  parseOutput(output) {
    try {
      // Handle string output
      if (typeof output === 'string') {
        // Clean up potential JSON issues
        let cleaned = output.trim();
        
        // Remove markdown code blocks if present
        if (cleaned.startsWith('```json')) {
          cleaned = cleaned.slice(7);
        }
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.slice(3);
        }
        if (cleaned.endsWith('```')) {
          cleaned = cleaned.slice(0, -3);
        }
        
        return JSON.parse(cleaned);
      }
      
      // Already an object
      return output;
    } catch (error) {
      console.error('Failed to parse output:', error);
      throw new APIError('Failed to parse API response', null, this.phaseName);
    }
  }

  /**
   * Normalize score to 1-9 range
   * @param {number} score - Raw score
   * @returns {number} Normalized score
   */
  normalizeScore(score) {
    if (typeof score !== 'number') {
      score = parseInt(score, 10);
    }
    
    if (isNaN(score)) return 5;
    
    return Math.max(1, Math.min(9, Math.round(score)));
  }

  /**
   * Execute API call
   * @param {*} input - Input data
   * @param {AbortSignal} abortSignal - Optional abort signal
   * @returns {Promise<Object>} API response
   */
  async analyze(input, abortSignal = null) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    // Link external abort signal
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => controller.abort());
    }
    
    try {
      const payload = this.buildPayload(input);
      
      const response = await fetch(this.url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new APIError(
          `API request failed: ${response.statusText}`,
          response.status,
          this.phaseName
        );
      }
      
      const data = await response.json();
      return this.processResponse(data);
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Handle abort
      if (error.name === 'AbortError') {
        throw new APIError('Request timed out or was cancelled', null, this.phaseName);
      }
      
      // Re-throw APIErrors
      if (error instanceof APIError) {
        throw error;
      }
      
      // Wrap other errors
      throw new APIError(error.message, null, this.phaseName);
    }
  }
}

// Export for use in other modules
window.BaseAPI = BaseAPI;
window.APIError = APIError;
