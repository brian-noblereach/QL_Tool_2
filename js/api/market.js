// js/api/market.js - Market opportunity analysis API (Proxied)

const MarketAPI = {
  config: {
    timeout: 700000 // ~11 minutes
  },

  /**
   * Analyze market opportunity
   */
  async analyze(techDescription, competitiveAnalysis, abortSignal = null) {
    if (!techDescription || typeof techDescription !== 'string') {
      throw new Error('Technology description is required');
    }

    if (!competitiveAnalysis) {
      throw new Error('Competitive analysis is required');
    }

    // Convert competitive analysis to string if needed
    const competitiveStr = typeof competitiveAnalysis === 'string' 
      ? competitiveAnalysis 
      : JSON.stringify(competitiveAnalysis);

    const payload = {
      'user_id': `market_${Date.now()}`,
      'in-1': techDescription.trim(),
      'in-2': competitiveStr
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
    
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => controller.abort());
    }

    try {
      // Use proxy instead of direct API call
      const data = await window.StackProxy.call('market', payload, controller.signal);
      
      clearTimeout(timeoutId);
      return this.processResponse(data);

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Market analysis timeout or cancelled');
      }
      
      throw error;
    }
  },

  /**
   * Process API response with dual outputs
   */
  processResponse(data) {
    // Validate response structure
    const validation = Validators.validateApiResponse(data, ['out-2', 'out-3']);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Parse market analysis (out-2)
    const analysisRaw = data.outputs['out-2'];
    const analysis = this.parseOutput(analysisRaw, 'market analysis');
    if (!analysis || typeof analysis !== 'object') {
      throw new Error('Invalid market analysis format');
    }

    // Parse market scoring (out-3)
    const scoringRaw = data.outputs['out-3'];
    const scoring = this.parseOutput(scoringRaw, 'market scoring');
    if (!scoring || typeof scoring !== 'object') {
      throw new Error('Invalid market scoring format');
    }

    // Validate score
    scoring.score = this.normalizeScore(scoring.score);
    if (scoring.score === null) {
      throw new Error(`Invalid market score: ${scoring.score}`);
    }

    // Ensure required fields
    this.ensureRequiredFields(analysis, scoring);

    // Return structured response
    return {
      analysis,
      scoring,
      formatted: this.formatForDisplay(analysis, scoring)
    };
  },

  /**
   * Parse Stack output that may contain extra text or envelope
   */
  parseOutput(rawOutput, label = 'output') {
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

    // Remove common code fences or YAML markers
    trimmed = trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```$/i, '')
      .replace(/^---\s*$/, '');

    const attemptParse = (text) => {
      try {
        return JSON.parse(text);
      } catch (error) {
        return null;
      }
    };

    let parsed = attemptParse(trimmed);
    if (parsed) return parsed;

    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      parsed = attemptParse(trimmed.slice(start, end + 1));
      if (parsed) return parsed;
    }

    // Attempt to repair truncated JSON by balancing brackets/braces
    const repaired = this.repairJsonString(trimmed);
    if (repaired) {
      parsed = attemptParse(repaired);
      if (parsed) return parsed;
    }

    // Try progressively trimming trailing characters in case of appended commentary
    if (start !== -1) {
      for (let cursor = trimmed.length - 1; cursor > start + 1; cursor -= 1) {
        const candidate = trimmed.slice(start, cursor);
        const attempt = attemptParse(candidate);
        if (attempt) return attempt;
      }
    }

    console.error(`Failed to parse ${label}:`, trimmed);
    return null;
  },

  /**
   * Attempt to balance unmatched braces/brackets in malformed JSON text
   */
  repairJsonString(text) {
    if (!text) return null;

    const stack = [];
    let inString = false;
    let escape = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];

      if (inString) {
        if (escape) {
          escape = false;
          continue;
        }
        if (char === '\\') {
          escape = true;
          continue;
        }
        if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === '{') {
        stack.push('}');
      } else if (char === '[') {
        stack.push(']');
      } else if (char === '}' || char === ']') {
        if (stack.length === 0) {
          // Extra closing bracket; drop it
          text = text.slice(0, i) + text.slice(i + 1);
          i -= 1;
        } else {
          const expected = stack.pop();
          if ((char === '}' && expected !== '}') || (char === ']' && expected !== ']')) {
            // Mismatched closing token
            return null;
          }
        }
      }
    }

    if (inString) {
      // Close unbalanced string
      text += '"';
    }

    if (stack.length > 0) {
      text += stack.reverse().join('');
    }

    return text;
  },

  /**
   * Normalize score to integer 1-9 if possible
   */
  normalizeScore(rawScore) {
    if (typeof rawScore === 'number' && Number.isInteger(rawScore)) {
      if (rawScore >= 1 && rawScore <= 9) {
        return rawScore;
      }
      return null;
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
   * Ensure required fields exist
   */
  ensureRequiredFields(analysis, scoring) {
    // Ensure analysis structure
    if (!analysis.markets) analysis.markets = [];
    if (!analysis.primary_market) {
      analysis.primary_market = {
        description: 'Unknown',
        tam_usd: 0,
        cagr_percent: 0,
        selection_rationale: ''
      };
    }
    if (!analysis.scoring_alignment) analysis.scoring_alignment = {};
    if (!analysis.market_analysis) analysis.market_analysis = {};

    // Ensure scoring structure
    if (!scoring.rubric_application) scoring.rubric_application = {};
    if (!scoring.justification) scoring.justification = {};
    if (!scoring.data_quality) scoring.data_quality = {};
    if (scoring.confidence === undefined) scoring.confidence = 0.7;
  },

  /**
   * Format data for display
   */
  formatForDisplay(analysis, scoring) {
    // Format markets
    const markets = (analysis.markets || []).map(market => ({
      rank: market.rank || 0,
      description: market.description || '',
      tam: market.tam_current_usd || 0,
      tamYear: market.tam_current_year || new Date().getFullYear(),
      cagr: market.cagr_percent || 0,
      source: market.source_url || '',
      confidence: market.confidence || 0.5
    }));

    // Build formatted response
    return {
      // Score and confidence
      score: scoring.score,
      confidence: scoring.confidence,
      
      // Primary market
      primaryMarket: {
        description: analysis.primary_market.description,
        tam: analysis.primary_market.tam_usd,
        cagr: analysis.primary_market.cagr_percent,
        rationale: analysis.primary_market.selection_rationale
      },
      
      // All markets
      markets: markets.slice(0, 5), // Top 5
      
      // Scoring alignment
      tamCategory: analysis.scoring_alignment.tam_category || this.deriveTamCategory(analysis.primary_market.tam_usd),
      cagrCategory: analysis.scoring_alignment.cagr_category || this.deriveCagrCategory(analysis.primary_market.cagr_percent),
      
      // Justification
      justification: scoring.justification.summary || '',
      strengths: scoring.justification.strengths_considered || [],
      limitations: scoring.justification.limitations_considered || [],
      risks: scoring.justification.key_risks || [],
      
      // Market analysis
      executiveSummary: analysis.market_analysis.executive_summary || '',
      trends: analysis.market_analysis.trends || [],
      opportunities: analysis.market_analysis.opportunities || [],
      unmetNeeds: analysis.market_analysis.unmet_needs || [],
      barriers: analysis.market_analysis.barriers_to_entry || [],
      problemStatement: analysis.market_analysis.problem_statement || '',
      differentiation: analysis.market_analysis.differentiation || '',
      
      // Rubric application
      rubricDetails: {
        tamValue: scoring.rubric_application.tam_value || analysis.primary_market.tam_usd,
        tamCategory: scoring.rubric_application.tam_category || '',
        cagrValue: scoring.rubric_application.cagr_value || analysis.primary_market.cagr_percent,
        cagrCategory: scoring.rubric_application.cagr_category || '',
        baseScore: scoring.rubric_application.base_score || scoring.score,
        adjustment: scoring.rubric_application.adjustment || 0,
        adjustmentRationale: scoring.rubric_application.adjustment_rationale || ''
      },
      
      // Data quality
      dataRecency: scoring.data_quality.data_recency || 'Unknown',
      dataConcerns: scoring.data_quality.data_concerns || []
    };
  },

  /**
   * Derive TAM category from value
   */
  deriveTamCategory(tam) {
    const value = parseFloat(tam);
    if (isNaN(value)) return 'unknown';
    
    if (value < 500000000) return 'under_500M';
    if (value <= 5000000000) return '500M_to_5B';
    return 'over_5B';
  },

  /**
   * Derive CAGR category from value
   */
  deriveCagrCategory(cagr) {
    const value = parseFloat(cagr);
    if (isNaN(value)) return 'unknown';
    
    if (value < 10) return 'under_10';
    if (value <= 35) return '10_to_35';
    return 'over_35';
  },

  /**
   * Get rubric description for a score
   */
  getRubricDescription(score) {
    const rubrics = {
      1: "TAM is <$500M and CAGR is less than 10%",
      2: "TAM is <$500M and CAGR is between 10 and 35%",
      3: "TAM is <$500M and CAGR is greater than 35%",
      4: "TAM is between $500M and $5B and CAGR is less than 10%",
      5: "TAM is between $500M and $5B and CAGR is between 10 and 35%",
      6: "TAM is between $500M and $5B and CAGR is greater than 35%",
      7: "TAM is >$5B and CAGR is less than 10%",
      8: "TAM is >$5B and CAGR is between 10 and 35%",
      9: "TAM is >$5B and CAGR is greater than 35%"
    };
    
    return rubrics[score] || "Invalid score";
  }
};

// Make available globally
window.MarketAPI = MarketAPI;
