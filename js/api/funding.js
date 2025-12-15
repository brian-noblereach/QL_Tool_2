// js/api/funding.js - Funding landscape and deal activity API (Proxied)

const FundingAPI = {
  config: {
    timeout: 600000 // 10 minutes
  },

  /**
   * Analyze funding landscape and market deals
   */
  async analyze(techDescription, abortSignal = null) {
    if (!techDescription || typeof techDescription !== 'string') {
      throw new Error('Technology description is required for funding analysis');
    }

    const trimmed = techDescription.trim();
    if (trimmed.length < 40) {
      throw new Error('Technology description too short for funding analysis');
    }

    const payload = {
      'user_id': `funding_${Date.now()}`,
      'in-0': trimmed
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => controller.abort());
    }

    try {
      // Use proxy instead of direct API call
      const data = await window.StackProxy.call('funding', payload, controller.signal);
      
      clearTimeout(timeoutId);
      return this.processResponse(data);

    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error('Funding analysis timeout or cancelled');
      }

      throw error;
    }
  },

  /**
   * Process API response
   */
  processResponse(data) {
    const validation = Validators.validateApiResponse(data, ['out-0', 'out-1']);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const outputs = data.outputs || {};

    const analysis = this.parseOutput(outputs['out-0'], 'funding analysis');
    const assessment = this.parseOutput(outputs['out-1'], 'funding assessment');

    if (!analysis || typeof analysis !== 'object') {
      throw new Error('Invalid funding analysis format');
    }

    if (!assessment || typeof assessment !== 'object') {
      throw new Error('Invalid funding assessment format');
    }

    const score =
      assessment.funding_score ??
      assessment.score ??
      assessment.fundingScore;

    const normalizedScore = Number.parseInt(score, 10);
    if (!Number.isInteger(normalizedScore) || normalizedScore < 1 || normalizedScore > 9) {
      throw new Error(`Invalid funding score: ${score}`);
    }
    assessment.score = normalizedScore;

    this.ensureRequiredFields(analysis, assessment);

    return {
      analysis,
      assessment,
      score: assessment.score,
      formatted: this.formatForDisplay(analysis, assessment)
    };
  },

  /**
   * Parse output payload that may be a string or { text }
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
      console.error(`Unexpected ${label} output type:`, typeof raw);
      return null;
    }

    const trimmed = raw.trim();
    if (!trimmed) return null;

    try {
      return JSON.parse(trimmed);
    } catch (error) {
      console.error(`Failed to parse ${label}:`, error, trimmed);
      return null;
    }
  },

  /**
   * Ensure required fields exist for downstream consumers
   */
  ensureRequiredFields(analysis, assessment) {
    analysis.venture_funding = analysis.venture_funding || {};
    analysis.venture_funding.funding_rounds =
      Array.isArray(analysis.venture_funding.funding_rounds)
        ? analysis.venture_funding.funding_rounds
        : [];

    analysis.market_deals = Array.isArray(analysis.market_deals)
      ? analysis.market_deals
      : [];

    if (typeof analysis.data_confidence !== 'number' || isNaN(analysis.data_confidence)) {
      analysis.data_confidence = null;
    } else {
      // Clamp confidence to [0,1]
      analysis.data_confidence = Math.max(0, Math.min(1, analysis.data_confidence));
    }

    assessment.score_justification = assessment.score_justification || {};
    assessment.score_justification.funding_details =
      Array.isArray(assessment.score_justification.funding_details)
        ? assessment.score_justification.funding_details
        : [];
  },

  /**
   * Format data for UI consumption
   */
  formatForDisplay(analysis, assessment) {
    const confidence = analysis.data_confidence;
    const justification = assessment.score_justification || {};

    const fundingRounds = analysis.venture_funding.funding_rounds.map(round => ({
      date: round.date || null,
      type: round.type || 'Unknown',
      amount: round.amount || 'Unknown',
      source: round.source || round.investor || 'Unknown source',
      description: round.description || '',
      url: round.source_url || ''
    }));

    const peerDeals = analysis.market_deals.map(deal => ({
      company: deal.startup_name || deal.company || 'Unknown Company',
      date: deal.deal_date || null,
      series: deal.series || deal.round || 'N/A',
      investors: Array.isArray(deal.vc_firms) ? deal.vc_firms : [],
      amount: deal.funding_amount?.amount ?? null,
      currency: deal.funding_amount?.currency || 'USD',
      isEstimate: !!deal.funding_amount?.is_estimate,
      url: deal.source_url || ''
    }));

    const fundingDetails = justification.funding_details.map(item => ({
      type: item.funding_type || item.type || 'Funding',
      amount: item.amount || 'Unknown amount',
      date: item.date || null,
      investors: Array.isArray(item.investors) ? item.investors : [],
      reference: item.document_reference || ''
    }));

    return {
      score: assessment.score,
      rubricLevel: justification.rubric_level || '',
      summary: justification.evidence_summary || '',
      confidence,
      confidenceLabel:
        typeof confidence === 'number'
          ? `${Math.round(confidence * 100)}%`
          : null,
      researchTopic: analysis.research_topic || '',
      applicationArea: analysis.application_area || '',
      searchDate: analysis.search_date || null,
      hasPriorFunding: !!analysis.venture_funding.has_prior_funding,
      fundingRounds,
      totalFundingRounds: fundingRounds.length,
      peerDeals,
      totalPeerDeals: analysis.total_market_deals_found ?? peerDeals.length,
      fundingDetails,
      assessmentDate: assessment.assessment_date || null,
      ventureName: assessment.venture_name || ''
    };
  },

  /**
   * Get rubric description
   */
  getRubricDescription(score) {
    const rubric = {
      1: 'Unreasonable amount of funding needed AND VCs not funding this area',
      2: 'High amount of funding needed AND VCs not funding this area',
      3: 'Reasonable/Low amount of funding needed AND VCs not funding this area',
      4: 'High amount of funding needed AND VCs funding this area decently',
      5: 'Reasonable amount of funding needed AND VCs funding this area decently',
      6: 'Low amount of funding needed AND VCs funding this area decently',
      7: 'High amount of funding needed AND VCs hot in this area',
      8: 'Reasonable amount of funding needed AND VCs hot in this area',
      9: 'Low amount of funding needed AND VCs hot in this area'
    };

    return rubric[score] || 'No rubric description available';
  }
};

// Make available globally
window.FundingAPI = FundingAPI;
