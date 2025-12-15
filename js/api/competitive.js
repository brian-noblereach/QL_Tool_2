// js/api/competitive.js - Competitive analysis API (Proxied)

const CompetitiveAPI = {
  config: {
    timeout: 480000 // 8 minutes
  },

  /**
   * Analyze competitive landscape
   */
  async analyze(techDescription, abortSignal = null) {
    if (!techDescription || typeof techDescription !== 'string') {
      throw new Error('Technology description is required');
    }

    const trimmed = techDescription.trim();
    if (trimmed.length < 20) {
      throw new Error('Technology description too short');
    }

    const payload = {
      'user_id': `competitive_${Date.now()}`,
      'in-0': trimmed
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
    
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => controller.abort());
    }

    try {
      // Use proxy instead of direct API call
      const data = await window.StackProxy.call('competitive', payload, controller.signal);
      
      clearTimeout(timeoutId);
      return this.processResponse(data);

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Competitive analysis timeout or cancelled');
      }
      
      throw error;
    }
  },

  /**
   * Process API response (out-3 = analysis, out-4 = score)
   */
  processResponse(data) {
    const outputs = data?.outputs || {};

    // Competitive uses out-3 for analysis, out-4 for score
    const validation = Validators.validateApiResponse(data, ['out-3', 'out-4']);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Parse the structured competitive analysis
    const analysis = this.parseOutput(outputs['out-3'], 'competitive analysis');
    if (!analysis || typeof analysis !== 'object') {
      throw new Error('Invalid competitive analysis format');
    }

    // Parse the graded assessment
    const assessment = this.parseOutput(outputs['out-4'], 'competitive assessment');
    if (!assessment || typeof assessment !== 'object') {
      throw new Error('Invalid competitive assessment format');
    }

    // Validate assessment score
    const score = Number.parseInt(assessment.score, 10);
    if (!score || score < 1 || score > 9) {
      throw new Error(`Invalid competitive score: ${assessment.score}`);
    }
    assessment.score = score;

    // Ensure required fields
    this.ensureRequiredFields(analysis, assessment);

    // Return structured response
    return {
      analysis,
      assessment,
      analysisText: JSON.stringify(analysis), // For market analysis input
      formatted: this.formatForDisplay(analysis, assessment)
    };
  },

  /**
   * Parse output that may be string or object
   */
  parseOutput(raw, label) {
    if (!raw) return null;

    if (typeof raw === 'object') {
      if (raw.text && typeof raw.text === 'string') {
        return this.parseOutput(raw.text, label);
      }
      return raw;
    }

    if (typeof raw !== 'string') {
      return null;
    }

    let trimmed = raw.trim();
    if (!trimmed) return null;

    // Clean up markdown code blocks
    if (trimmed.startsWith('```json')) {
      trimmed = trimmed.slice(7);
    }
    if (trimmed.startsWith('```')) {
      trimmed = trimmed.slice(3);
    }
    if (trimmed.endsWith('```')) {
      trimmed = trimmed.slice(0, -3);
    }
    trimmed = trimmed.trim();

    try {
      return JSON.parse(trimmed);
    } catch (error) {
      console.error(`Failed to parse ${label}:`, error);
      return null;
    }
  },

  /**
   * Ensure required fields exist
   */
  ensureRequiredFields(analysis, assessment) {
    // Ensure analysis structure
    if (!analysis.market_overview) analysis.market_overview = {};
    if (!analysis.competitors) analysis.competitors = [];
    if (!analysis.competitive_analysis) analysis.competitive_analysis = {};
    if (!analysis.data_quality) {
      analysis.data_quality = {};
    } else {
      const confidence =
        analysis.data_quality.overall_confidence ??
        analysis.data_quality.confidence ??
        analysis.data_quality.confidence_level;
      if (confidence !== undefined) {
        analysis.data_quality.overall_confidence = Number(confidence);
      }
    }

    // Normalize market overview totals
    const overview = analysis.market_overview;

    const defaultTotals = {
      startups_range: '',
      midsize_range: '',
      large_range: '',
      total_range: '',
      geographic_scope: 'Global'
    };

    if (!overview.total_competitors || typeof overview.total_competitors !== 'object') {
      overview.total_competitors = { ...defaultTotals };
    } else {
      overview.total_competitors = {
        ...defaultTotals,
        ...overview.total_competitors
      };
    }

    const totals = overview.total_competitors;
    const normalizeRange = (value) => {
      if (value === null || value === undefined) return '';
      if (typeof value === 'number') return value.toString();
      return String(value).trim();
    };

    const legacyCounts = assessment.competitor_count;
    if (legacyCounts && typeof legacyCounts === 'object') {
      if (!totals.startups_range) totals.startups_range = normalizeRange(legacyCounts.startups);
      if (!totals.midsize_range) totals.midsize_range = normalizeRange(legacyCounts.mid_size_companies);
      if (!totals.large_range) totals.large_range = normalizeRange(legacyCounts.large_companies);
      if (!totals.total_range) totals.total_range = normalizeRange(legacyCounts.total);
    }

    if (!overview.job_to_be_done) {
      overview.job_to_be_done = 'Not specified';
    }
    if (!overview.market_dynamics) {
      overview.market_dynamics = 'Not provided';
    }

    const rangeToNumber = (range) => {
      if (!range || typeof range !== 'string') return 0;
      const matches = range.match(/[\d.]+/g);
      if (!matches || matches.length === 0) return 0;
      if (matches.length === 1) return Number(matches[0]) || 0;
      const low = Number(matches[0]) || 0;
      const high = Number(matches[1]) || low;
      return Math.round((low + high) / 2);
    };

    // Ensure assessment structure (maintain backward compatibility)
    if (!assessment.competitor_count || typeof assessment.competitor_count !== 'object') {
      assessment.competitor_count = {
        total: rangeToNumber(totals.total_range),
        large_companies: rangeToNumber(totals.large_range),
        mid_size_companies: rangeToNumber(totals.midsize_range),
        startups: rangeToNumber(totals.startups_range)
      };
    } else {
      const counts = assessment.competitor_count;
      counts.large_companies = Number(counts.large_companies ?? 0);
      counts.mid_size_companies = Number(counts.mid_size_companies ?? 0);
      counts.startups = Number(counts.startups ?? 0);

      if (counts.total === undefined || counts.total === null) {
        counts.total = counts.large_companies + counts.mid_size_companies + counts.startups;
      } else {
        counts.total = Number(counts.total);
        if (Number.isNaN(counts.total)) {
          counts.total = counts.large_companies + counts.mid_size_companies + counts.startups;
        }
      }
    }
    if (!assessment.market_leaders) assessment.market_leaders = [];
    if (!assessment.competitive_intensity) assessment.competitive_intensity = 'unknown';
    if (!assessment.key_risk_factors) assessment.key_risk_factors = [];
    if (!assessment.differentiation_opportunities) assessment.differentiation_opportunities = [];
  },

  /**
   * Format data for display
   */
  formatForDisplay(analysis, assessment) {
    // Extract competitor details
    const competitors = (analysis.competitors || []).map(comp => ({
      name: comp.company_name || 'Unknown',
      size: comp.companySize || comp.size_category || 'Unknown',
      product: comp.product_name || '',
      description: comp.product_description || '',
      strengths: comp.strengths || [],
      weaknesses: comp.weaknesses || [],
      revenue: comp.revenue || 'Unknown',
      funding: comp.funding_raised || 'N/A',
      position: comp.market_position || 'Unknown',
      competitorType: comp.competitorType || ''
    }));

    const overview = analysis.market_overview || {};
    const totals = overview.total_competitors || null;
    const numericCounts = assessment.competitor_count || null;
    const competitorCount = {
      ...(numericCounts || {}),
      ...(totals || {})
    };

    // Build formatted response
    return {
      // Score and justification
      score: assessment.score,
      justification: assessment.score_justification || '',
      rubricMatch: assessment.rubric_match_explanation || '',
      
      // Competitor metrics
      competitorCount,
      totalCompetitors:
        totals?.total_range ??
        totals?.total ??
        competitorCount?.total ??
        assessment.competitor_count?.total ??
        null,
      competitors: competitors.slice(0, 10), // Top 10
      marketOverview: {
        jobToBeDone: overview.job_to_be_done || '',
        marketDynamics: overview.market_dynamics || '',
        geographicScope: totals?.geographic_scope || overview.geographic_scope || ''
      },
      
      // Market analysis
      marketLeaders: assessment.market_leaders || [],
      competitiveIntensity: assessment.competitive_intensity,
      
      // Risk and opportunities
      keyRisks: assessment.key_risk_factors || [],
      opportunities: assessment.differentiation_opportunities || [],
      
      // Additional insights
      dominantPlayers: analysis.competitive_analysis?.dominant_players || [],
      emergingThreats: analysis.competitive_analysis?.emerging_threats || [],
      technologyTrends: analysis.competitive_analysis?.technology_trends || [],
      marketGaps: analysis.competitive_analysis?.market_gaps || [],
      
      // Data quality
      confidence:
        analysis.data_quality?.overall_confidence ??
        analysis.data_quality?.confidence ??
        analysis.data_quality?.confidence_level ??
        0.7,
      dataDate: analysis.data_quality?.data_date || new Date().toISOString(),
      sources: analysis.data_quality?.sources_used || []
    };
  },

  /**
   * Get rubric description for a score
   */
  getRubricDescription(score) {
    const rubrics = {
      1: "Dominant established players AND little tech OR business differentiation",
      2: "Established players AND little tech OR business differentiation",
      3: "Established players AND some tech OR business differentiation",
      4: "Established players AND significant tech differentiation",
      5: "Established players AND significant tech AND business differentiation",
      6: "Existing players AND significant tech OR business differentiation",
      7: "Existing players AND significant tech AND business differentiation",
      8: "Few existing players AND significant tech AND business differentiation",
      9: "No existing players in the market"
    };
    
    return rubrics[score] || "Invalid score";
  }
};

// Make available globally
window.CompetitiveAPI = CompetitiveAPI;
