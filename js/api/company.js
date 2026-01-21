// js/api/company.js - Company analysis API (Proxied)
// Supports three input modes: URL only, file only, or both
// Returns both full output (for display) and short output (for other APIs)
// Full output follows the venture-extraction-schema JSON schema
// Short output is treated as TEXT (not JSON) for passing to other APIs

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
   * @returns {Promise<Object>} - { full: {...}, short: "..." }
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

    Debug.log(`[CompanyAPI] Using workflow: ${workflow}`);

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
   * out-6 = full output (JSON for display)
   * out-7 = short output (TEXT for other APIs - do NOT parse as JSON)
   */
  processResponse(data) {
    // Validate response has required outputs
    const outputs = data?.outputs || {};
    
    Debug.log('[CompanyAPI] Processing response outputs');
    
    if (!outputs['out-6'] && !outputs['out-7']) {
      throw new Error('Company API did not return expected outputs (out-6 or out-7)');
    }

    // Parse full output (out-6) - this IS JSON
    const fullOutput = this.parseOutput(outputs['out-6'], 'full company data');
    
    Debug.log('[CompanyAPI] Parsed full output');
    
    // Get short output (out-7) - treat as TEXT, not JSON
    const shortOutput = this.extractTextOutput(outputs['out-7']);

    if (!fullOutput && !shortOutput) {
      throw new Error('Failed to parse company data');
    }

    // Ensure required structure in full output (follows venture-extraction-schema)
    const full = this.ensureStructure(fullOutput || {});
    
    // Short output is kept as text string for passing to other APIs
    const short = shortOutput || '';

    Debug.log('[CompanyAPI] Processing complete:', full.company_overview?.name || 'Unknown');

    return { full, short };
  },

  /**
   * Extract text output - keeps as string, does NOT parse as JSON
   * The short output should be passed as text to subsequent APIs
   */
  extractTextOutput(rawOutput) {
    if (!rawOutput) return '';

    // Handle object with text property
    if (typeof rawOutput === 'object' && rawOutput.text) {
      return rawOutput.text;
    }

    // Already a string - return as-is (don't parse)
    if (typeof rawOutput === 'string') {
      return rawOutput;
    }

    // If it's an object without text property, stringify it
    if (typeof rawOutput === 'object') {
      return JSON.stringify(rawOutput);
    }

    return String(rawOutput);
  },

  /**
   * Parse output that may be string or object (for full output only)
   * Handles multiple wrapper structures from Stack AI
   */
  parseOutput(rawOutput, label = 'output') {
    if (!rawOutput) return null;

    Debug.log(`[CompanyAPI] parseOutput ${label}`);

    // Handle object with text property (Stack AI wrapper)
    if (typeof rawOutput === 'object' && rawOutput.text) {
      Debug.log(`[CompanyAPI] parseOutput ${label}: unwrapping`);
      return this.parseOutput(rawOutput.text, label);
    }

    // Already an object with expected schema properties
    if (typeof rawOutput === 'object') {
      // Check if it has the expected schema structure
      if (rawOutput.company_overview || rawOutput.technology || rawOutput.company_profile) {
        Debug.log(`[CompanyAPI] parseOutput ${label}: found schema structure`);
        return rawOutput;
      }
      // Otherwise might be wrapped differently
      Debug.log(`[CompanyAPI] parseOutput ${label}: non-standard structure`);
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
        
        const parsed = JSON.parse(cleaned.trim());
        Debug.log(`[CompanyAPI] parseOutput ${label}: parsed JSON`);
        return parsed;
      } catch (error) {
        Debug.error(`[CompanyAPI] Failed to parse ${label}:`, error.message);
        return null;
      }
    }

    return null;
  },

  /**
   * Ensure full output has required structure for display
   * Normalizes to match venture-extraction-schema
   */
  ensureStructure(data) {
    // The new schema has these top-level sections:
    // company_overview, technology, products_and_applications, team,
    // funding_and_investors, traction_and_metrics, recent_activity,
    // market_context, data_quality_assessment

    // Handle legacy company_profile wrapper
    if (data.company_profile && !data.company_overview) {
      const profile = data.company_profile;
      
      // Map to new schema structure
      const basicInfo = profile.basic_information || {};
      const companyName = basicInfo.company_name || profile.name || '';
      const website = basicInfo.website || profile.website || '';
      const headquarters = basicInfo.headquarters || 
                          (typeof profile.headquarters === 'object' ? profile.headquarters?.address : profile.headquarters) || null;
      const founded = basicInfo.founded || profile.founded_year || null;
      
      // Get technology info
      const coreTech = profile.core_technology || data.core_technology || {};
      
      // Build company_overview following schema
      data.company_overview = {
        name: companyName,
        website: website,
        founded_year: typeof founded === 'number' ? founded : (parseInt(founded) || null),
        headquarters: headquarters,
        company_stage: profile.company_stage?.stage || data.company_stage?.stage || null,
        employee_count: profile.employee_count || basicInfo.employee_count || null,
        mission_statement: profile.mission_statement || coreTech.problem_solved || '',
        company_description: coreTech.technology_description || profile.operating_status || ''
      };
      
      // Build technology section following schema
      data.technology = {
        core_technology: coreTech.technology_description || coreTech.technology_name || '',
        technology_category: coreTech.technology_category || basicInfo.industry || '',
        technical_approach: coreTech.technical_approach || '',
        key_innovations: coreTech.key_technical_features?.map(f => 
          typeof f === 'object' ? `${f.feature}: ${f.description}` : f
        ) || [],
        intellectual_property: {
          patents_filed: null,
          patents_granted: null,
          patent_descriptions: [],
          trade_secrets_mentioned: false
        }
      };
      
      // Build products_and_applications following schema
      const techApps = profile.technology_applications || data.market_opportunity || {};
      data.products_and_applications = {
        primary_application: techApps.primary_markets?.[0] || '',
        products: (data.product_specifications ? [{
          name: data.product_specifications.flagship_product || 'Primary Product',
          description: data.product_specifications.data_rate?.description || '',
          status: 'commercial',
          target_market: techApps.target_markets?.[0]?.market || '',
          launch_date: null
        }] : []),
        use_cases: coreTech.technology_applications || techApps.use_cases || [],
        target_industries: techApps.target_markets?.map(m => typeof m === 'object' ? m.market : m) || 
                          techApps.primary_markets || []
      };
      
      // Build team section following schema
      const teamData = profile.team_and_leadership || data.founders_and_leadership || {};
      data.team = {
        founders: (teamData.founders || teamData || []).filter(f => f.name).map(f => ({
          name: f.name || '',
          role: f.title || f.role || '',
          background: f.background || null,
          linkedin: f.linkedin || null
        })),
        key_executives: (teamData.key_team_members || teamData.key_executives || []).map(e => ({
          name: e.name || '',
          role: e.role || e.title || '',
          background: e.background || e.expertise || null
        })),
        advisors: (teamData.advisors || []).map(a => ({
          name: a.name || '',
          expertise: a.expertise || null
        }))
      };
      
      // Build funding_and_investors following schema
      const fundingData = profile.funding_and_investors || data.funding_history || {};
      data.funding_and_investors = {
        total_funding: this.parseAmount(fundingData.total_funding_disclosed || fundingData.total_funding),
        funding_rounds: (fundingData.funding_rounds || []).map(r => ({
          round_type: r.type || r.round_type || '',
          amount: r.amount_usd || r.amount || null,
          date: r.date || null,
          lead_investors: r.lead_investor ? [r.lead_investor] : (r.lead_investors || []),
          other_investors: r.other_investors || [],
          valuation: r.valuation || null
        })),
        government_grants: (fundingData.sbir_funding?.notable_projects || fundingData.government_grants || []).map(g => ({
          source: g.sponsor || g.source || 'Government',
          amount: g.award_amount_usd || g.amount || null,
          date: g.date || null,
          purpose: g.description || g.purpose || null
        }))
      };
      
      // Build traction_and_metrics following schema
      const recentData = profile.recent_activities_and_milestones || data.recent_activities_and_milestones || {};
      data.traction_and_metrics = {
        customers: {
          notable_customers: [],
          customer_count: null,
          customer_type: null
        },
        revenue: null,
        growth_metrics: null,
        partnerships: (recentData.partnerships_and_collaborations || []).map(p => ({
          partner_name: p.partner || '',
          partnership_type: p.type || '',
          announcement_date: p.date || null
        })),
        achievements: recentData.recognition_and_awards?.map(a => 
          typeof a === 'object' ? a.award : a
        ) || recentData.market_recognition || []
      };
      
      // Build recent_activity following schema
      data.recent_activity = {
        last_12_months: (recentData.recent_news_and_announcements || recentData.technology_milestones || []).map(n => ({
          date: n.date || n.source || '',
          activity_type: 'news',
          description: n.announcement || n.milestone || n.description || '',
          source_url: n.url || null
        })),
        upcoming_milestones: []
      };
      
      // Build market_context following schema
      const compLandscape = profile.competitive_landscape || data.competitive_landscape || {};
      data.market_context = {
        industry: basicInfo.industry || compLandscape.market_position || '',
        sub_sector: null,
        problem_addressed: coreTech.problem_solved || '',
        value_proposition: coreTech.differentiation || compLandscape.oceancomm_differentiation?.[0] || '',
        business_model: basicInfo.business_model || data.business_model_and_revenue?.revenue_model || null
      };
      
      // Build data_quality_assessment following schema
      const qualityData = profile.data_quality_and_gaps || data.data_quality || {};
      data.data_quality_assessment = {
        extraction_date: new Date().toISOString().split('T')[0],
        primary_sources: qualityData.sources_used || data.sources?.primary_sources?.map(s => s.source) || [],
        information_completeness: qualityData.information_completeness || 'medium',
        missing_critical_information: qualityData.information_gaps || qualityData.critical_gaps || [],
        data_freshness: qualityData.data_recency ? 'recent' : 'mixed',
        confidence_notes: qualityData.source_reliability || qualityData.information_verification || ''
      };
    }

    // Also handle case where core_technology is at root level
    if (data.core_technology && !data.technology) {
      const coreTech = data.core_technology;
      data.technology = {
        core_technology: coreTech.technology_description || coreTech.technology_name || '',
        technology_category: coreTech.technology_category || '',
        technical_approach: coreTech.technical_approach || '',
        key_innovations: coreTech.key_technical_features?.map(f => 
          typeof f === 'object' ? `${f.feature}: ${f.description}` : f
        ) || [],
        intellectual_property: {
          patents_filed: null,
          patents_granted: null,
          patent_descriptions: [],
          trade_secrets_mentioned: false
        }
      };
    }
    
    // Ensure all required top-level sections exist (per schema)
    const requiredSections = [
      'company_overview',
      'technology', 
      'products_and_applications',
      'team',
      'funding_and_investors',
      'traction_and_metrics',
      'recent_activity',
      'market_context',
      'data_quality_assessment'
    ];
    
    for (const section of requiredSections) {
      if (!data[section]) {
        data[section] = this.getDefaultSection(section);
      }
    }
    
    return data;
  },

  /**
   * Get default empty section following schema
   */
  getDefaultSection(section) {
    const defaults = {
      company_overview: {
        name: '',
        website: '',
        founded_year: null,
        headquarters: null,
        company_stage: null,
        employee_count: null,
        mission_statement: '',
        company_description: ''
      },
      technology: {
        core_technology: '',
        technology_category: '',
        technical_approach: '',
        key_innovations: [],
        intellectual_property: {
          patents_filed: null,
          patents_granted: null,
          patent_descriptions: [],
          trade_secrets_mentioned: false
        }
      },
      products_and_applications: {
        primary_application: '',
        products: [],
        use_cases: [],
        target_industries: []
      },
      team: {
        founders: [],
        key_executives: [],
        advisors: []
      },
      funding_and_investors: {
        total_funding: null,
        funding_rounds: [],
        government_grants: []
      },
      traction_and_metrics: {
        customers: {
          notable_customers: [],
          customer_count: null,
          customer_type: null
        },
        revenue: null,
        growth_metrics: null,
        partnerships: [],
        achievements: []
      },
      recent_activity: {
        last_12_months: [],
        upcoming_milestones: []
      },
      market_context: {
        industry: '',
        sub_sector: null,
        problem_addressed: '',
        value_proposition: '',
        business_model: null
      },
      data_quality_assessment: {
        extraction_date: new Date().toISOString().split('T')[0],
        primary_sources: [],
        information_completeness: 'low',
        missing_critical_information: [],
        data_freshness: 'mixed',
        confidence_notes: ''
      }
    };
    
    return defaults[section] || {};
  },

  /**
   * Parse amount string to number
   */
  parseAmount(amountStr) {
    if (typeof amountStr === 'number') return amountStr;
    if (!amountStr || typeof amountStr !== 'string') return null;
    
    // Extract number from strings like "$3M+" or "$412K"
    const match = amountStr.match(/\$?([\d.]+)\s*(M|K|B)?/i);
    if (!match) return null;
    
    let value = parseFloat(match[1]);
    const suffix = (match[2] || '').toUpperCase();
    
    if (suffix === 'K') value *= 1000;
    if (suffix === 'M') value *= 1000000;
    if (suffix === 'B') value *= 1000000000;
    
    return value || null;
  },

  /**
   * Get display-ready company name from response
   */
  getCompanyName(companyData) {
    if (!companyData) return 'Unknown Company';
    
    const full = companyData.full || companyData;
    
    // Try company_overview.name (new schema)
    if (full.company_overview?.name) return full.company_overview.name;
    
    // Try legacy structures
    if (full.company_profile?.basic_information?.company_name) {
      return full.company_profile.basic_information.company_name;
    }
    if (full.company_profile?.name) return full.company_profile.name;
    if (full.company_name) return full.company_name;
    if (full.name) return full.name;
    
    return 'Unknown Company';
  },

  /**
   * Get short description for passing to other APIs
   * Returns as TEXT string, not JSON
   */
  getShortDescription(companyData) {
    if (!companyData) return '';
    
    // Short output is already a text string
    const short = companyData.short;
    if (short && typeof short === 'string') {
      return short;
    }
    
    // Fallback: stringify the full data
    const full = companyData.full || companyData;
    return JSON.stringify(full);
  }
};

// Make available globally
window.CompanyAPI = CompanyAPI;
