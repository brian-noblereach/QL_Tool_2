// js/api/team.js - Team capability analysis API (Proxied)

const TeamAPI = {
  config: {
    timeout: 600000 // 10 minutes
  },

  /**
   * Analyze founding team using the company URL
   */
  async analyze(url, abortSignal = null) {
    if (!url || typeof url !== 'string') {
      throw new Error('Valid company URL is required for team analysis');
    }

    const payload = {
      'user_id': `team_${Date.now()}`,
      'in-0': url.trim()
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => controller.abort());
    }

    try {
      // Use proxy instead of direct API call
      const data = await window.StackProxy.call('team', payload, controller.signal);
      
      clearTimeout(timeoutId);
      return this.processResponse(data);
      
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error('Team analysis timeout or cancelled');
      }

      throw error;
    }
  },

  /**
   * Process API response (out-0 = analysis, out-1 = score)
   */
  processResponse(data) {
    const validation = Validators.validateApiResponse(data, ['out-0', 'out-1']);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const teamRaw = data.outputs['out-0'];
    const scoringRaw = data.outputs['out-1'];

    const team = this.parseOutput(teamRaw, 'team roster');
    const scoring = this.parseOutput(scoringRaw, 'team scoring');

    if (!team || typeof team !== 'object') {
      throw new Error('Invalid team roster format');
    }

    if (!scoring || typeof scoring !== 'object') {
      throw new Error('Invalid team scoring format');
    }

    this.ensureRequiredFields(team, scoring);

    const score = this.normalizeScore(scoring.score);
    if (score === null) {
      throw new Error(`Invalid team score: ${scoring.score}`);
    }

    const result = {
      team,
      scoring: {
        ...scoring,
        score
      },
      score,
      rubricDescription: scoring.rubric_match_explanation || null,
      formatted: this.formatForDisplay(team, scoring, score)
    };

    return result;
  },

  /**
   * Parse JSON safely, handling wrapped text outputs
   */
  parseOutput(rawOutput, label) {
    if (!rawOutput) return null;

    if (typeof rawOutput === 'object') {
      if (rawOutput.text && typeof rawOutput.text === 'string') {
        return this.parseOutput(rawOutput.text, label);
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

    const tryParse = (text) => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    };

    let parsed = tryParse(trimmed);
    if (parsed) return parsed;

    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      parsed = tryParse(trimmed.slice(start, end + 1));
      if (parsed) return parsed;
    }

    console.error(`Failed to parse ${label}:`, trimmed);
    return null;
  },

  /**
   * Normalize score to integer 1-9
   */
  normalizeScore(rawScore) {
    if (typeof rawScore === 'number' && Number.isInteger(rawScore)) {
      return rawScore >= 1 && rawScore <= 9 ? rawScore : null;
    }

    if (typeof rawScore === 'string') {
      const match = rawScore.match(/\d+/);
      if (match) {
        const parsed = parseInt(match[0], 10);
        if (parsed >= 1 && parsed <= 9) {
          return parsed;
        }
      }
    }

    return null;
  },

  /**
   * Ensure team and scoring structures have required defaults
   */
  ensureRequiredFields(team, scoring) {
    team.team_members = Array.isArray(team.team_members) ? team.team_members : [];
    team.trusted_sources = Array.isArray(team.trusted_sources) ? team.trusted_sources : [];
    team.data_confidence =
      typeof team.data_confidence === 'number' ? team.data_confidence : null;

    team.team_members = team.team_members.map(member => ({
      name: member?.name || 'Unknown',
      role_at_venture: member?.role_at_venture || 'Team Member',
      work_history: Array.isArray(member?.work_history) ? member.work_history : [],
      education_history: Array.isArray(member?.education_history) ? member.education_history : [],
      papers_publications: Array.isArray(member?.papers_publications) ? member.papers_publications : [],
      commercialization_experience: Array.isArray(member?.commercialization_experience)
        ? member.commercialization_experience
        : [],
      awards_recognition: Array.isArray(member?.awards_recognition) ? member.awards_recognition : []
    }));

    scoring.key_strengths = Array.isArray(scoring.key_strengths) ? scoring.key_strengths : [];
    scoring.key_gaps = Array.isArray(scoring.key_gaps) ? scoring.key_gaps : [];
    scoring.relevant_experience = Array.isArray(scoring.relevant_experience)
      ? scoring.relevant_experience
      : [];
    scoring.team_composition = scoring.team_composition || {};
    scoring.score_justification = scoring.score_justification || '';
  },

  /**
   * Build formatted display payload
   */
  formatForDisplay(team, scoring, score) {
    return {
      score,
      ventureName: team.venture_name || '-',
      justification: scoring.score_justification || '',
      confidence: team.data_confidence,
      teamComposition: {
        total: scoring.team_composition.total_members || team.team_members.length,
        technical: scoring.team_composition.technical_experts || 0,
        business: scoring.team_composition.business_experts || 0,
        domain: scoring.team_composition.domain_experts || 0
      },
      strengths: scoring.key_strengths,
      gaps: scoring.key_gaps,
      experiences: scoring.relevant_experience,
      rubric: scoring.rubric_match_explanation || '',
      members: team.team_members,
      sources: team.trusted_sources
    };
  },

  /**
   * Provide rubric description for summary card
   */
  getRubricDescription(score) {
    const rubric = {
      1: 'No trackable achievements or public presence. No industry connections or academic recognition.',
      2: 'Completed a few small projects or published in minor journals. Limited visibility within a very small professional or academic circle.',
      3: 'Growing portfolio of projects or publications in peer-reviewed journals. Building a network within their specific field.',
      4: 'Recognized within their specific field or local area. Occasionally invited to present at seminars or local industry events.',
      5: 'Consistent record of quality publications or successful industry projects. Regular participant in conferences or industry events.',
      6: 'Publications in top-tier journals or lead complex industry projects. Frequently invited to speak at conferences or contribute to industry standards.',
      7: 'Work is often cited or used as case studies in the field. Lead significant research grants or hold patents for industry innovations.',
      8: 'Research or innovations significantly influence the direction of their field. Hold leadership positions in academia or industry (e.g., editorial boards, executive roles).',
      9: 'Made groundbreaking discoveries that reshaped their entire field. Recipients of the highest honors or lead global organizations.'
    };

    return rubric[score] || 'No rubric description available';
  }
};

// Make available globally
window.TeamAPI = TeamAPI;
