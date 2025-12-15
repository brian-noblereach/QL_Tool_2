// js/api/company.js - Company analysis API (Proxied)

const CompanyAPI = {
  config: {
    timeout: 600000 // 10 minutes
  },

  async analyze(url, abortSignal = null) {
    if (!url || typeof url !== 'string') {
      throw new Error('Valid URL is required');
    }

    const payload = {
      'user_id': `company_${Date.now()}`,
      'in-0': url.trim()
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
    
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => controller.abort());
    }

    try {
      // Use proxy instead of direct API call
      const data = await window.StackProxy.call('company', payload, controller.signal);
      
      clearTimeout(timeoutId);
      return this.processResponse(data);

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Company analysis timeout or cancelled');
      }
      
      throw error;
    }
  },

  processResponse(data) {
    // Company output is at out-6
    const validation = Validators.validateApiResponse(data, ['out-6']);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const rawOutput = data.outputs['out-6'];
    let parsed;

    if (typeof rawOutput === 'string') {
      try {
        // Clean up potential markdown code blocks
        let cleaned = rawOutput.trim();
        if (cleaned.startsWith('```json')) {
          cleaned = cleaned.slice(7);
        }
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.slice(3);
        }
        if (cleaned.endsWith('```')) {
          cleaned = cleaned.slice(0, -3);
        }
        parsed = JSON.parse(cleaned.trim());
      } catch (error) {
        console.error('Failed to parse company data:', error);
        throw new Error('Invalid company data format');
      }
    } else {
      parsed = rawOutput;
    }

    // Ensure required structure
    if (!parsed.company_overview) {
      parsed.company_overview = {};
    }
    if (!parsed.technology) {
      parsed.technology = {};
    }
    if (!parsed.products_and_applications) {
      parsed.products_and_applications = {};
    }
    if (!parsed.market_context) {
      parsed.market_context = {};
    }

    return parsed;
  }
};

// Make available globally
window.CompanyAPI = CompanyAPI;
