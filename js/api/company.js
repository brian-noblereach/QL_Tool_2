// js/api/company.js - Company analysis API (Proxied)
// Supports three input modes: URL only, file only, or both
// Returns both full output (for display) and short output (for other APIs)

const CompanyAPI = {
  config: {
    timeout: 600000 // 10 minutes
  },

  /**
   * Analyze a company using URL, file, or both
   * 
   * @param {Object} options - Input options
   * @param {string} options.url - Company website URL (optional)
   * @param {File} options.file - Uploaded document (optional)
   * @returns {Promise<Object>} - { full: {...}, short: {...} }
   */
  async analyze({ url, file } = {}, abortSignal = null) {
    // Validate inputs - need at least one
    const hasUrl = url && typeof url === 'string' && url.trim().length > 0;
    const hasFile = file && file instanceof File;
    
    if (!hasUrl && !hasFile) {
      throw new Error('Either a company URL or document is required');
    }

    // Determine which workflow to use
    let workflow;
    if (hasUrl && hasFile) {
      workflow = 'company_both';
    } else if (hasFile) {
      workflow = 'company_file';
    } else {
      workflow = 'company_url';
    }

    console.log(`[CompanyAPI] Using workflow: ${workflow}, hasUrl: ${hasUrl}, hasFile: ${hasFile}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
    
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => controller.abort());
    }

    try {
      let data;
      
      if (hasFile) {
        // Use file upload method
        data = await window.StackProxy.callWithFile(
          workflow,
          file,
          hasUrl ? url.trim() : null,
          controller.signal
        );
      } else {
        // URL-only workflow
        const payload = {
          'user_id': `company_${Date.now()}`,
          'in-0': url.trim()
        };
        data = await window.StackProxy.call(workflow, payload, controller.signal);
      }
      
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

  /**
   * Process API response - extract both full and short outputs
   * out-6 = full output (for display)
   * out-7 = short output (for other APIs)
   */
  processResponse(data) {
    // Validate response has required outputs
    const outputs = data?.outputs || {};
    
    if (!outputs['out-6'] && !outputs['out-7']) {
      throw new Error('Company API did not return expected outputs (out-6 or out-7)');
    }

    // Parse full output (out-6)
    const fullOutput = this.parseOutput(outputs['out-6'], 'full company data');
    
    // Parse short output (out-7)
    const shortOutput = this.parseOutput(outputs['out-7'], 'short company data');

    if (!fullOutput && !shortOutput) {
      throw new Error('Failed to parse company data');
    }

    // Ensure required structure in full output
    const full = this.ensureStructure(fullOutput || {});
    
    // Short output is passed as-is to other APIs (it's already formatted correctly)
    const short = shortOutput || this.createShortFromFull(full);

    console.log('[CompanyAPI] Processed outputs:', {
      fullKeys: Object.keys(full),
      shortKeys: Object.keys(short)
    });

    return { full, short };
  },

  /**
   * Parse output that may be string or object
   */
  parseOutput(rawOutput, label = 'output') {
    if (!rawOutput) return null;

    // Handle object with text property
    if (typeof rawOutput === 'object' && rawOutput.text) {
      return this.parseOutput(rawOutput.text, label);
    }

    // Already an object
    if (typeof rawOutput === 'object') {
      return rawOutput;
    }

    // Parse string
    if (typeof rawOutput === 'string') {
      try {
        let cleaned = rawOutput.trim();
        
        // Remove markdown code blocks
        if (cleaned.startsWith('```json')) {
          cleaned = cleaned.slice(7);
        }
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.slice(3);
        }
        if (cleaned.endsWith('```')) {
          cleaned = cleaned.slice(0, -3);
        }
        
        return JSON.parse(cleaned.trim());
      } catch (error) {
        console.error(`[CompanyAPI] Failed to parse ${label}:`, error);
        return null;
      }
    }

    return null;
  },

  /**
   * Ensure full output has required structure for display
   * Normalizes different API response formats to a consistent structure
   * Handles multiple schema variations from Stack AI
   */
  ensureStructure(data) {
    // Handle case where data is wrapped in company_profile
    if (data.company_profile && !data.company_overview) {
      const profile = data.company_profile;
      
      // Schema variant 1: company_profile.basic_information.company_name
      // Schema variant 2: company_profile.name (direct)
      const basicInfo = profile.basic_information || {};
      const companyName = basicInfo.company_name || profile.name || '';
      const website = basicInfo.website || profile.website || '';
      const headquarters = basicInfo.headquarters || 
                          (typeof profile.headquarters === 'object' ? profile.headquarters?.address : profile.headquarters) || '';
      const founded = basicInfo.founded || profile.founded_year || '';
      const industry = basicInfo.industry || '';
      
      // Get technology info - may be in profile.core_technology or data.core_technology
      const coreTech = profile.core_technology || data.core_technology || {};
      
      data.company_overview = {
        name: companyName,
        company_name: companyName,
        website: website,
        headquarters: headquarters,
        founded_year: founded,
        industry: industry,
        business_model: basicInfo.business_model || '',
        company_stage: profile.company_stage?.stage || data.company_stage?.stage || '',
        stage_description: profile.company_stage?.description || profile.company_stage?.stage_description || '',
        stage_evidence: profile.company_stage?.evidence || '',
        company_description: coreTech.technology_description || profile.operating_status || ''
      };
      
      data.technology = {
        core_technology: coreTech.technology_name || coreTech.primary_innovation || coreTech.technology_category || '',
        technology_description: coreTech.technology_description || '',
        problem_solved: coreTech.problem_solved || '',
        key_components: coreTech.key_technical_components || coreTech.key_technical_features || {},
        specifications: coreTech.performance_specifications || data.product_specifications || {},
        differentiation: coreTech.differentiation || '',
        applications: coreTech.technology_applications || []
      };
      
      // Handle technology_applications or market_opportunity
      const techApps = profile.technology_applications || data.market_opportunity || {};
      data.products_and_applications = {
        primary_markets: techApps.primary_markets || techApps.target_markets || [],
        use_cases: techApps.use_cases || [],
        market_opportunity: techApps.market_opportunity || techApps.market_size_context || ''
      };
      
      // Handle competitive_landscape
      const compLandscape = profile.competitive_landscape || data.competitive_landscape || {};
      data.market_context = {
        market_position: compLandscape.market_position || '',
        competitors: compLandscape.key_competitors || compLandscape.direct_competitors || [],
        competitive_advantages: compLandscape.competitive_advantages || compLandscape.oceancomm_differentiation || [],
        market_trends: compLandscape.market_trends || ''
      };
      
      data.funding = profile.funding_and_investors || data.funding_history || {};
      data.team = profile.team_and_leadership || data.founders_and_leadership || {};
      data.recent_activities = profile.recent_activities_and_milestones || data.recent_activities_and_milestones || {};
      data.intellectual_property = profile.intellectual_property || data.technology_validation?.patents_and_ip || {};
      data.data_quality = profile.data_quality_and_gaps || data.data_quality || {};
    }
    
    // Also handle case where core_technology is at root level (schema variant 2)
    if (data.core_technology && !data.technology) {
      const coreTech = data.core_technology;
      data.technology = {
        core_technology: coreTech.technology_name || coreTech.primary_innovation || coreTech.technology_category || '',
        technology_description: coreTech.technology_description || '',
        problem_solved: coreTech.problem_solved || '',
        key_components: coreTech.key_technical_components || coreTech.key_technical_features || {},
        specifications: coreTech.performance_specifications || data.product_specifications || {},
        differentiation: coreTech.differentiation || '',
        applications: coreTech.technology_applications || []
      };
    }
    
    // Ensure required sections exist (even if empty)
    if (!data.company_overview) {
      data.company_overview = {};
    }
    if (!data.technology) {
      data.technology = {};
    }
    if (!data.products_and_applications) {
      data.products_and_applications = {};
    }
    if (!data.market_context) {
      data.market_context = {};
    }
    
    return data;
  },

  /**
   * Create a short version from full output if short output is missing
   * This is a fallback - normally the API provides both
   */
  createShortFromFull(full) {
    const overview = full.company_overview || {};
    const tech = full.technology || {};
    const market = full.market_context || {};
    
    return {
      company_name: overview.name || overview.company_name || '',
      website: overview.website || '',
      headquarters: overview.headquarters || overview.location || '',
      founded: overview.founded_year || overview.founded || '',
      company_type: overview.company_type || 'Privately Held',
      industry: overview.industry || market.industry || '',
      employee_count: overview.employee_count || '',
      status: overview.company_stage || 'Early-stage venture',
      description: overview.company_description || overview.mission_statement || '',
      core_technology: tech.core_technology || '',
      key_capabilities: tech.key_innovations || [],
      founding_team: full.team?.members || [],
      funding_status: 'Not publicly disclosed',
      market_opportunity: market.value_proposition || ''
    };
  },

  /**
   * Get display-ready company name from response
   */
  getCompanyName(companyData) {
    if (!companyData) return 'Unknown Company';
    
    // Check both full and short formats
    const full = companyData.full || companyData;
    const short = companyData.short || {};
    
    // Try short format first (most reliable)
    if (short.company_name) return short.company_name;
    
    // Try full format with company_profile structure
    if (full.company_profile?.basic_information?.company_name) {
      return full.company_profile.basic_information.company_name;
    }
    
    // Try normalized company_overview structure
    if (full.company_overview?.name) return full.company_overview.name;
    if (full.company_overview?.company_name) return full.company_overview.company_name;
    
    // Fallback to top-level fields
    if (full.company_name) return full.company_name;
    if (full.name) return full.name;
    
    return 'Unknown Company';
  },

  /**
   * Get short description for passing to other APIs
   */
  getShortDescription(companyData) {
    if (!companyData) return '';
    
    const short = companyData.short;
    if (short) {
      // Return as JSON string for API input
      return JSON.stringify(short);
    }
    
    // Fallback: create from full
    const full = companyData.full || companyData;
    return JSON.stringify(this.createShortFromFull(full));
  }
};

// Make available globally
window.CompanyAPI = CompanyAPI;
