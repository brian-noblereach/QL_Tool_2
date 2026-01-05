// js/utils/validators.js - Schema validation utilities (V02)
// Added validateIpRisk for completeness

const Validators = {
  validateCompany(data) {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid company data structure' };
    }

    // Log what we received for debugging
    console.log('[Validators] Company data keys:', Object.keys(data));

    // Check for company_overview section (required by schema)
    const overview = data.company_overview || {};
    
    if (overview && Object.keys(overview).length > 0) {
      console.log('[Validators] Overview keys:', Object.keys(overview));
    }

    // Get company name from various possible locations
    const companyName = overview.name || 
                        overview.company_name ||
                        data.company_profile?.basic_information?.company_name ||
                        data.company_profile?.name ||
                        data.company_name ||
                        data.name;
    
    // Get website from various possible locations
    const website = overview.website ||
                    data.company_profile?.basic_information?.website ||
                    data.company_profile?.website ||
                    data.website;

    // Get description from various possible locations
    const description = overview.company_description ||
                        overview.mission_statement ||
                        data.technology?.core_technology ||
                        data.company_profile?.core_technology?.technology_description;

    // Only require that we have SOME identifying info
    if (!companyName && !website && !description) {
      return { valid: false, error: 'Company data missing identifying information (name, website, or description)' };
    }

    // Website validation is optional - only validate format if present
    if (website && typeof website === 'string') {
      try {
        const urlToTest = website.startsWith('http') ? website : 'https://' + website;
        new URL(urlToTest);
      } catch {
        console.warn('[Validators] Website URL may be invalid:', website);
      }
    }

    return { valid: true };
  },

  validateCompetitive(data) {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid competitive data structure' };
    }

    if (!data.analysis || !data.assessment) {
      return { valid: false, error: 'Missing competitive analysis or assessment' };
    }

    const analysis = data.analysis;
    const assessment = data.assessment;

    if (!analysis.market_overview || !analysis.competitors || !analysis.competitive_analysis) {
      return { valid: false, error: 'Invalid competitive analysis structure' };
    }

    if (!Number.isInteger(assessment.score) || assessment.score < 1 || assessment.score > 9) {
      return { valid: false, error: `Invalid competitive score: ${assessment.score}` };
    }

    if (!assessment.competitor_count || typeof assessment.competitor_count !== 'object') {
      return { valid: false, error: 'Missing competitor count data' };
    }

    return { valid: true };
  },

  validateMarket(data) {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid market data structure' };
    }

    if (!data.analysis || !data.scoring) {
      return { valid: false, error: 'Missing market analysis or scoring' };
    }

    const analysis = data.analysis;
    const scoring = data.scoring;

    if (!analysis.markets || !analysis.primary_market) {
      return { valid: false, error: 'Invalid market analysis structure' };
    }

    if (analysis.primary_market.tam_usd === undefined || analysis.primary_market.cagr_percent === undefined) {
      return { valid: false, error: 'Primary market missing TAM or CAGR' };
    }

    if (!Number.isInteger(scoring.score) || scoring.score < 1 || scoring.score > 9) {
      return { valid: false, error: `Invalid market score: ${scoring.score}` };
    }

    if (typeof scoring.confidence !== 'number' || scoring.confidence < 0 || scoring.confidence > 1) {
      return { valid: false, error: 'Invalid confidence value' };
    }

    return { valid: true };
  },

  validateTeam(data) {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid team data structure' };
    }

    if (!data.team || !Array.isArray(data.team.team_members)) {
      return { valid: false, error: 'Missing team roster' };
    }

    if (!data.scoring || typeof data.scoring !== 'object') {
      return { valid: false, error: 'Missing team scoring details' };
    }

    if (!Number.isInteger(data.score) || data.score < 1 || data.score > 9) {
      return { valid: false, error: `Invalid team score: ${data.score}` };
    }

    return { valid: true };
  },

  validateFunding(data) {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid funding data structure' };
    }

    if (!data.analysis || typeof data.analysis !== 'object') {
      return { valid: false, error: 'Missing funding analysis payload' };
    }

    if (!data.assessment || typeof data.assessment !== 'object') {
      return { valid: false, error: 'Missing funding assessment payload' };
    }

    if (!Number.isInteger(data.score) || data.score < 1 || data.score > 9) {
      return { valid: false, error: `Invalid funding score: ${data.score}` };
    }

    const analysis = data.analysis;

    if (!analysis.venture_funding || typeof analysis.venture_funding !== 'object') {
      return { valid: false, error: 'Funding analysis missing venture_funding data' };
    }

    if (!Array.isArray(analysis.venture_funding.funding_rounds)) {
      return { valid: false, error: 'Funding rounds must be an array' };
    }

    if (!Array.isArray(analysis.market_deals)) {
      return { valid: false, error: 'Market deals must be an array' };
    }

    return { valid: true };
  },

  // V02: Added IP Risk validation
  validateIpRisk(data) {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid IP risk data structure' };
    }

    if (!Number.isInteger(data.score) || data.score < 1 || data.score > 9) {
      return { valid: false, error: `Invalid IP risk score: ${data.score}` };
    }

    if (!data.formatted || typeof data.formatted !== 'object') {
      return { valid: false, error: 'Missing formatted IP risk data' };
    }

    return { valid: true };
  },

  validateUrl(url) {
    if (!url || typeof url !== 'string') {
      return { valid: false, error: 'URL is required' };
    }

    const trimmed = url.trim();
    
    if (!trimmed) {
      return { valid: false, error: 'URL cannot be empty' };
    }

    let validUrl = trimmed;
    if (!validUrl.match(/^https?:\/\//i)) {
      validUrl = 'https://' + validUrl;
    }

    try {
      const urlObj = new URL(validUrl);
      
      if (!urlObj.hostname || urlObj.hostname.indexOf('.') === -1) {
        return { valid: false, error: 'Invalid domain name' };
      }

      return { valid: true, url: validUrl };
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }
  },

  validateAssessment(score, justification) {
    const errors = [];

    if (!Number.isInteger(score) || score < 1 || score > 9) {
      errors.push('Score must be between 1 and 9');
    }

    if (!justification || typeof justification !== 'string') {
      errors.push('Justification is required');
    } else {
      const trimmed = justification.trim();
      if (trimmed.length < 20) {
        errors.push('Justification must be at least 20 characters');
      }
      if (trimmed.length > 2000) {
        errors.push('Justification must be less than 2000 characters');
      }
    }

    return { valid: errors.length === 0, errors };
  },

  sanitizeText(text) {
    if (!text) return '';
    
    return String(text)
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  },

  validateApiResponse(response, expectedOutputs = []) {
    if (!response || typeof response !== 'object') {
      return { valid: false, error: 'Invalid API response structure' };
    }

    if (!response.outputs || typeof response.outputs !== 'object') {
      return { valid: false, error: 'Missing outputs in API response' };
    }

    for (const key of expectedOutputs) {
      if (!(key in response.outputs)) {
        return { valid: false, error: `Missing expected output: ${key}` };
      }
    }

    return { valid: true };
  },

  checkScoreDeviation(aiScore, userScore) {
    if (aiScore === null || userScore === null) {
      return { hasDeviation: false };
    }

    const deviation = Math.abs(aiScore - userScore);
    
    return {
      hasDeviation: deviation > 2,
      deviation,
      message: deviation > 2 
        ? `Your score differs by ${deviation} points from the AI assessment (${aiScore}).`
        : null
    };
  },

  validateExportData(state) {
    const errors = [];

    if (!state.company) errors.push('Company data is missing');
    if (!state.team || state.team.score === undefined) errors.push('Team assessment is incomplete');
    if (!state.competitive || !state.competitive.assessment) errors.push('Competitive assessment is incomplete');
    if (!state.market || !state.market.scoring) errors.push('Market assessment is incomplete');
    if (!state.iprisk || state.iprisk.score === undefined) errors.push('IP risk assessment is incomplete');

    return { valid: errors.length === 0, errors };
  },

  parseNumber(value, defaultValue = 0) {
    if (value === null || value === undefined) return defaultValue;
    const num = parseFloat(value);
    return isNaN(num) ? defaultValue : num;
  },

  validateStringArray(arr, fieldName) {
    if (!Array.isArray(arr)) {
      return { valid: false, error: `${fieldName} must be an array` };
    }

    const invalidItems = arr.filter(item => typeof item !== 'string');
    if (invalidItems.length > 0) {
      return { valid: false, error: `${fieldName} contains non-string items` };
    }

    return { valid: true, data: arr.filter(item => item.trim()) };
  }
};

window.Validators = Validators;
