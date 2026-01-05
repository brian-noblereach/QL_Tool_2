// js/api/iprisk.js - Intellectual property risk analysis API (Proxied)

const IPRiskAPI = {
  config: {
    timeout: 600000 // 10 minutes
  },

  /**
   * Analyze IP risk using company description
   * 
   * @param {string} companyDescription - Short company description JSON from CompanyAPI
   * @param {AbortSignal} abortSignal - Optional abort signal
   */
  async analyze(companyDescription, abortSignal = null) {
    if (!companyDescription || typeof companyDescription !== 'string') {
      throw new Error('Company description is required for IP risk analysis');
    }

    const trimmed = companyDescription.trim();
    if (trimmed.length < 20) {
      throw new Error('Company description too short for IP risk analysis');
    }

    const payload = {
      'user_id': `iprisk_${Date.now()}`,
      'in-0': trimmed
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => controller.abort());
    }

    try {
      // Use proxy instead of direct API call
      const data = await window.StackProxy.call('iprisk', payload, controller.signal);
      
      clearTimeout(timeoutId);
      return this.processResponse(data);
      
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error('IP risk analysis timeout or cancelled');
      }

      throw error;
    }
  },

  /**
   * Process API response (out-1 = analysis, out-2 = score)
   */
  processResponse(data) {
    const validation = Validators.validateApiResponse(data, ['out-1', 'out-2']);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const detailed = this.parseOutput(data.outputs['out-1']);
    const summary = this.parseOutput(data.outputs['out-2']);

    const ipRiskData = detailed || summary;
    if (!ipRiskData) {
      throw new Error('No IP risk data returned from API');
    }

    if (summary) {
      this.mergeSummary(ipRiskData, summary);
    }

    this.normalizeReport(ipRiskData);
    this.ensureRequiredFields(ipRiskData);

    const score = this.extractScore(ipRiskData);

    return {
      data: ipRiskData,
      score,
      rubricDescription: score ? this.getRubricDescription(score) : null,
      formatted: this.formatForDisplay(ipRiskData, score)
    };
  },

  /**
   * Parse model output regardless of envelope format
   */
  parseOutput(rawOutput) {
    if (!rawOutput) return null;

    if (typeof rawOutput === 'object') {
      if (rawOutput.text && typeof rawOutput.text === 'string') {
        try {
          return JSON.parse(rawOutput.text);
        } catch (e) {
          return null;
        }
      }
      return rawOutput;
    }

    if (typeof rawOutput !== 'string') {
      return null;
    }

    let trimmed = rawOutput.trim();
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
      console.error('Failed to parse IP risk output:', error);
      return null;
    }
  },

  /**
   * Merge summary (out-2) data into detailed report for consistent shape
   */
  mergeSummary(report, summary) {
    if (!summary || typeof summary !== 'object') {
      return;
    }

    report.ipRiskSummary = report.ipRiskSummary || {};
    report.ipRiskSummary.companyCurrentIP = report.ipRiskSummary.companyCurrentIP || {};
    report.ipRiskSummary.overallIPRisk = report.ipRiskSummary.overallIPRisk || {};

    const summaryScore = summary.score ?? summary.ipRiskScore;
    if (summaryScore !== undefined) {
      report.ipRiskSummary.overallIPRisk.score = summaryScore;
    }

    const justification = summary.score_justification || summary.rubric_match_explanation;
    if (justification) {
      report.ipRiskSummary.overallIPRisk.analysis =
        report.ipRiskSummary.overallIPRisk.analysis || justification;
      report.ipRiskSummary.companyCurrentIP.description =
        report.ipRiskSummary.companyCurrentIP.description || justification;
    }

    const riskLevel =
      summary.risk_level ||
      summary.litigation_risk?.level ||
      summary.freedom_to_operate?.assessment ||
      summary.patent_landscape?.patent_density;
    if (riskLevel) {
      report.ipRiskSummary.overallIPRisk.riskLevel =
        report.ipRiskSummary.overallIPRisk.riskLevel || riskLevel;
    }

    const challenges = [
      ...(report.ipRiskSummary.overallIPRisk.thirdPartyChallenges || []),
      ...(summary.key_risk_factors || []),
      ...(summary.freedom_to_operate?.key_constraints || [])
    ].filter(Boolean);

    if (challenges.length > 0) {
      report.ipRiskSummary.overallIPRisk.thirdPartyChallenges = Array.from(new Set(challenges));
    }

    if (summary.data_confidence !== undefined) {
      report.dataConfidence = report.dataConfidence ?? summary.data_confidence;
    }
    
    if (summary.confidence_justification !== undefined) {
      report.confidenceJustification = report.confidenceJustification ?? summary.confidence_justification;
    }
  },

  /**
   * Ensure data has required structure
   */
  ensureRequiredFields(report) {
    if (!report.ipRiskSummary) {
      report.ipRiskSummary = {};
    }

    const summary = report.ipRiskSummary;

    if (!summary.companyCurrentIP) {
      summary.companyCurrentIP = {};
    }
    summary.companyCurrentIP.description = summary.companyCurrentIP.description || 'No current IP description available.';
    if (!Array.isArray(summary.companyCurrentIP.ownedPatents)) {
      summary.companyCurrentIP.ownedPatents = [];
    }

    if (!Array.isArray(summary.uniquePatentableFeatures)) {
      summary.uniquePatentableFeatures = [];
    }

    if (!Array.isArray(summary.crowdedPatentableFeatures)) {
      summary.crowdedPatentableFeatures = [];
    }

    if (!Array.isArray(summary.topPatentOwners)) {
      summary.topPatentOwners = [];
    }

    if (!Array.isArray(summary.top5RelevantPatents)) {
      summary.top5RelevantPatents = [];
    }

    if (!summary.overallIPRisk) {
      summary.overallIPRisk = {};
    }
    const risk = summary.overallIPRisk;
    risk.riskLevel = risk.riskLevel || 'unknown';
    if (!Array.isArray(risk.thirdPartyChallenges)) {
      risk.thirdPartyChallenges = [];
    }
    risk.analysis = risk.analysis || '';

    if (!report.patentTable) {
      report.patentTable = {};
    }
    const table = report.patentTable;
    if (!Array.isArray(table.awardedPatents)) {
      table.awardedPatents = [];
    }
    if (!Array.isArray(table.patentApplications)) {
      table.patentApplications = [];
    }

    // Initialize data quality object if not present
    if (!report.dataQuality) {
      report.dataQuality = {};
    }

    // Use centralized confidence normalization
    report.dataConfidence = ConfidenceUtil.normalizeLevel(
      report.dataConfidence ?? 
      report.data_confidence ?? 
      report.dataQuality?.overall_confidence
    );
    
    report.confidenceJustification = ConfidenceUtil.extractJustification(
      report.confidenceJustification,
      report.dataQuality?.confidence_justification
    );
  },

  /**
   * Extract numeric score if present
   */
  extractScore(report) {
    const riskSection = report.ipRiskSummary?.overallIPRisk || {};
    let rawScore = riskSection.score;

    if (typeof rawScore === 'string') {
      const trimmed = rawScore.trim();
      const digitMatch = trimmed.match(/\d+/);
      if (digitMatch) {
        rawScore = Number(digitMatch[0]);
      } else {
        const parsed = Number(trimmed);
        rawScore = Number.isFinite(parsed) ? parsed : rawScore;
      }
    }

    if (Number.isInteger(rawScore) && rawScore >= 1 && rawScore <= 9) {
      riskSection.score = rawScore;
      return rawScore;
    }

    const fallbackScore = this.mapRiskLevelToScore(riskSection.riskLevel);
    if (fallbackScore !== null) {
      riskSection.score = fallbackScore;
      return fallbackScore;
    }
  
    return null;
  },

  /**
   * Map qualitative risk levels to 1-9 scale
   */
  mapRiskLevelToScore(level) {
    if (!level) return null;

    const normalized = String(level).toLowerCase().trim();
    const mapping = {
      'very low': 8,
      low: 7,
      moderate: 6,
      medium: 5,
      balanced: 5,
      elevated: 4,
      high: 3,
      'very high': 2,
      critical: 1
    };

    if (normalized in mapping) {
      return mapping[normalized];
    }

    const alt = normalized.replace(/[_-]/g, ' ');
    if (alt in mapping) {
      return mapping[alt];
    }

    return null;
  },

  /**
   * Normalize different response schemas into the expected structure
   */
  normalizeReport(report) {
    if (!report || typeof report !== 'object') {
      return;
    }

    const scoreValue = report.score ?? report.ipRiskScore;
    const justification = report.score_justification || report.rubric_match_explanation || '';
    const riskFactors = report.key_risk_factors || report.freedom_to_operate?.key_constraints || [];
    const riskLevel =
      report.litigation_risk?.level ||
      report.patent_landscape?.patent_density ||
      report.freedom_to_operate?.assessment ||
      report.overall_risk_level;

    const majorHolders = report.patent_landscape?.major_patent_holders || [];
    const relevantPatents = report.relevant_patents || report.reference_patents;

    report.ipRiskSummary = report.ipRiskSummary || {};
    report.ipRiskSummary.companyCurrentIP = report.ipRiskSummary.companyCurrentIP || {};
    report.ipRiskSummary.overallIPRisk = report.ipRiskSummary.overallIPRisk || {};

    if (scoreValue !== undefined && report.ipRiskSummary.overallIPRisk.score === undefined) {
      report.ipRiskSummary.overallIPRisk.score = scoreValue;
    }

    if (!report.ipRiskSummary.overallIPRisk.analysis && justification) {
      report.ipRiskSummary.overallIPRisk.analysis = justification;
    }

    if (!report.ipRiskSummary.overallIPRisk.riskLevel && riskLevel) {
      report.ipRiskSummary.overallIPRisk.riskLevel = riskLevel;
    }

    if (
      (!Array.isArray(report.ipRiskSummary.overallIPRisk.thirdPartyChallenges) ||
        report.ipRiskSummary.overallIPRisk.thirdPartyChallenges.length === 0) &&
      Array.isArray(riskFactors)
    ) {
      report.ipRiskSummary.overallIPRisk.thirdPartyChallenges = riskFactors;
    }

    if (!report.ipRiskSummary.companyCurrentIP.description && justification) {
      report.ipRiskSummary.companyCurrentIP.description = justification;
    }

    if (!Array.isArray(report.ipRiskSummary.topPatentOwners) && Array.isArray(majorHolders)) {
      report.ipRiskSummary.topPatentOwners = majorHolders.map(holder => ({
        assignee: holder,
        patentCount: 0
      }));
    }

    if (!report.patentTable) {
      report.patentTable = {};
    }

    if (
      !Array.isArray(report.patentTable.top5RelevantPatents) &&
      Array.isArray(relevantPatents)
    ) {
      report.ipRiskSummary.top5RelevantPatents = relevantPatents;
      report.patentTable.top5RelevantPatents = relevantPatents;
    }

    if (report.data_confidence !== undefined && report.dataConfidence === undefined) {
      report.dataConfidence = report.data_confidence;
    }

    if (report.data_quality && typeof report.data_quality === 'object') {
      report.dataQuality = {
        ...(report.data_quality || {}),
        ...(report.dataQuality || {})
      };
    }
  },

  /**
   * Format data for UI consumption
   */
  formatForDisplay(report, score) {
    const summary = report.ipRiskSummary;
    const table = report.patentTable;

    return {
      score,
      riskLevel: summary.overallIPRisk.riskLevel,
      riskAnalysis: summary.overallIPRisk.analysis,
      challenges: summary.overallIPRisk.thirdPartyChallenges,
      companyIP: summary.companyCurrentIP,
      uniqueFeatures: summary.uniquePatentableFeatures,
      crowdedFeatures: summary.crowdedPatentableFeatures,
      topOwners: summary.topPatentOwners.map(owner => ({
        assignee: owner.assignee || 'Unknown Assignee',
        patentCount: owner.patentCount ?? 0
      })),
      relevantPatents: summary.top5RelevantPatents.map(patent => ({
        id: patent.patentID || 'Unknown ID',
        title: patent.title || 'Untitled Patent',
        assignee: patent.assignee || 'Unknown Assignee',
        link: patent.link || ''
      })),
      awardedPatents: table.awardedPatents,
      pendingPatents: table.patentApplications,
      dataConfidence: report.dataConfidence,
      dataConfidenceJustification: report.confidenceJustification || ''
    };
  },

  /**
   * Get rubric description for IP risk score
   */
  getRubricDescription(score) {
    const rubric = {
      1: 'Completely unprotectable or already widely used in the public domain, or immediate risk of infringement challenges.',
      2: 'Minimal unique elements or closely resembles existing IP; multiple competing claims or active litigation risk.',
      3: 'Some unique elements but major components unprotected; similar patents exist raising challenge risk.',
      4: 'Partially protectable with significant coverage gaps; potential legal challenges require careful navigation.',
      5: 'Mix of protectable and vulnerable elements with manageable IP conflict risk given due diligence.',
      6: 'Mostly protectable with minor vulnerabilities; limited likelihood of significant IP conflicts.',
      7: 'Strong protection around core elements and clear differentiation from existing IP; low challenge risk.',
      8: 'Comprehensive protection across multiple IP types with a track record of successful defense.',
      9: 'Groundbreaking, novel IP with robust, multi-layered protection and minimal risk of successful challenges.'
    };

    return rubric[score] || 'No rubric description available';
  }
};

// Make available globally
window.IPRiskAPI = IPRiskAPI;
