// js/components/assessment-view.js - Assessment display and user scoring (V02)
// Updated to work with actual API JSON structures

class AssessmentView {
  constructor() {
    this.currentView = {
      team: 'summary',
      funding: 'summary',
      competitive: 'summary',
      market: 'summary',
      iprisk: 'summary'
    };
    
    this.data = {
      company: null,
      team: null,
      funding: null,
      competitive: null,
      market: null,
      iprisk: null
    };
    
    this.userScores = {
      team: { score: null, justification: '', submitted: false, timesSubmitted: 0 },
      funding: { score: null, justification: '', submitted: false, timesSubmitted: 0 },
      competitive: { score: null, justification: '', submitted: false, timesSubmitted: 0 },
      market: { score: null, justification: '', submitted: false, timesSubmitted: 0 },
      iprisk: { score: null, justification: '', submitted: false, timesSubmitted: 0 }
    };
    
    this.aiScores = {
      team: null,
      funding: null,
      competitive: null,
      market: null,
      iprisk: null
    };
  }

  init() {
    this.setupSliders();
    this.setupViewToggles();
    this.setupSubmitButtons();
    console.log('AssessmentView initialized');
  }

  // ========== SLIDER SETUP ==========
  
  setupSliders() {
    const dimensions = ['team', 'funding', 'competitive', 'market', 'iprisk'];
    
    dimensions.forEach(dim => {
      const slider = document.getElementById(`${dim}-score-slider`);
      const display = document.getElementById(`${dim}-user-score`);
      const deviationEl = document.getElementById(`${dim}-deviation`);
      const rubricEl = document.getElementById(`${dim}-rubric`);
      
      if (slider && display) {
        slider.addEventListener('input', (e) => {
          const score = parseInt(e.target.value);
          display.textContent = score;
          this.userScores[dim].score = score;
          this.updateRubricDisplay(dim, score);
          this.checkDeviation(dim, score, deviationEl);
          
          if (window.app?.stateManager) {
            window.app.stateManager.saveUserScore(dim, {
              score,
              justification: this.userScores[dim].justification
            });
          }
        });
      }
      
      if (rubricEl) {
        this.updateRubricDisplay(dim, 5);
      }
    });
  }

  // ========== RUBRIC DEFINITIONS ==========
  
  getRubricDefinitions(dimension) {
    const rubrics = {
      team: {
        1: { label: 'No Track Record', description: 'No trackable achievements or public presence. No industry connections or academic recognition.' },
        2: { label: 'Limited Experience', description: 'Completed a few small projects or published in minor journals. Limited visibility within a very small professional or academic circle.' },
        3: { label: 'Growing Portfolio', description: 'Growing portfolio of projects or publications in peer-reviewed journals. Building a network within their specific field.' },
        4: { label: 'Local Recognition', description: 'Recognized within their specific field or local area. Occasionally invited to present at seminars or local industry events.' },
        5: { label: 'Solid Track Record', description: 'Consistent publications or successful projects. Some tech licensing, patents, or industry partnership experience.' },
        6: { label: 'Commercialization Experience', description: 'Top-tier publications or complex projects. Direct commercialization experience (licensing, SBIR/STTR, startup advisory).' },
        7: { label: 'Business Leadership', description: 'Cited work or case studies. Has held business leadership roles with established industry network.' },
        8: { label: 'Founder/Executive Experience', description: 'Field-influencing research OR previous founder/executive role in a commercialized venture.' },
        9: { label: 'Serial Success', description: 'Groundbreaking discoveries with proven entrepreneurial success OR serial entrepreneur with successful exit.' }
      },
      funding: {
        1: { label: 'No Activity', description: 'No comparable funding activity in sector. Market shows minimal investor interest.' },
        2: { label: 'Very Limited', description: 'Very limited funding activity, mostly grants. Few institutional investors interested in the space.' },
        3: { label: 'Early Stage Only', description: 'Some angel/seed activity, few institutional investors. Market still nascent.' },
        4: { label: 'Growing Interest', description: 'Growing investor interest, early-stage rounds becoming more common. Some notable deals.' },
        5: { label: 'Regular Activity', description: 'Regular Series A/B activity, established VC interest. Healthy deal flow in the sector.' },
        6: { label: 'Strong Backing', description: 'Strong institutional backing, multiple growth rounds. Sector attracting significant capital.' },
        7: { label: 'High Profile', description: 'High-profile investors, significant deal flow. Multiple companies reaching unicorn status.' },
        8: { label: 'Exceptional', description: 'Exceptional funding environment, multiple unicorns. Top-tier VCs competing for deals.' },
        9: { label: 'Peak Activity', description: 'Peak funding activity, multiple mega-rounds. Sector is hottest investment category.' }
      },
      competitive: {
        1: { label: 'Extremely Crowded', description: 'Extremely crowded market with dominant incumbents. Very difficult to differentiate or compete.' },
        2: { label: 'Many Competitors', description: 'Many strong competitors with established market share. Limited differentiation opportunities.' },
        3: { label: 'Competitive Market', description: 'Competitive market with several players. Some differentiation possible but challenging.' },
        4: { label: 'Moderate Competition', description: 'Moderate competition with clear differentiation opportunities. Some barriers to entry exist.' },
        5: { label: 'Average Landscape', description: 'Average competitive landscape. Neither advantaged nor disadvantaged by competition.' },
        6: { label: 'Favorable Position', description: 'Favorable competitive position in an emerging market. Good differentiation potential.' },
        7: { label: 'Limited Competition', description: 'Limited competition with strong differentiation. Significant barriers protect the position.' },
        8: { label: 'Few Competitors', description: 'Few direct competitors, significant barriers to entry. Strong defensive moat.' },
        9: { label: 'Blue Ocean', description: 'Blue ocean opportunity with no direct competitors. Defining a new category.' }
      },
      market: {
        1: { label: 'Very Small/Slow', description: 'TAM < $500M with CAGR < 10%. Limited market opportunity and slow growth.' },
        2: { label: 'Small/Moderate', description: 'TAM < $500M with CAGR 10-20%. Small but growing market.' },
        3: { label: 'Small/Fast Growing', description: 'TAM < $500M with CAGR > 20%. Small market with rapid growth potential.' },
        4: { label: 'Medium/Slow', description: 'TAM $500M-$5B with CAGR < 10%. Substantial market but limited growth.' },
        5: { label: 'Medium/Moderate', description: 'TAM $500M-$5B with CAGR 10-20%. Good market size with healthy growth.' },
        6: { label: 'Medium/Fast Growing', description: 'TAM $500M-$5B with CAGR > 20%. Strong market opportunity with rapid expansion.' },
        7: { label: 'Large/Slow', description: 'TAM > $5B with CAGR < 10%. Very large market, mature growth phase.' },
        8: { label: 'Large/Moderate', description: 'TAM > $5B with CAGR 10-20%. Excellent market size with sustained growth.' },
        9: { label: 'Large/Fast Growing', description: 'TAM > $5B with CAGR > 20%. Exceptional market opportunity - large and rapidly expanding.' }
      },
      iprisk: {
        1: { label: 'Severe Exposure', description: 'Severe IP exposure with no defensible position. Crowded patent landscape with dominant players.' },
        2: { label: 'High Risk', description: 'High IP risk with limited protectable features. Many existing patents in the space.' },
        3: { label: 'Significant Challenges', description: 'Significant IP challenges exist. Some protectable features but crowded areas.' },
        4: { label: 'Moderate Risk', description: 'Moderate IP risk with some protectable features. Mixed patent landscape.' },
        5: { label: 'Average Position', description: 'Average IP position. Neither particularly strong nor weak.' },
        6: { label: 'Good Position', description: 'Good IP position with some unique protectable features. Manageable risks.' },
        7: { label: 'Strong Foundation', description: 'Strong IP foundation with clear differentiation. Limited infringement risks.' },
        8: { label: 'Excellent Protection', description: 'Excellent IP protection with strong patent portfolio. Defensible moat.' },
        9: { label: 'Exceptional Moat', description: 'Exceptional IP position with multiple defensible patents. Very low risk of challenges.' }
      }
    };
    return rubrics[dimension] || {};
  }

  updateRubricDisplay(dimension, score) {
    const rubricEl = document.getElementById(`${dimension}-rubric`);
    if (!rubricEl) return;
    
    const rubrics = this.getRubricDefinitions(dimension);
    const rubric = rubrics[score];
    
    if (rubric) {
      const colorClass = score <= 3 ? 'low' : (score <= 6 ? 'medium' : 'high');
      rubricEl.innerHTML = `
        <div class="rubric-content ${colorClass}">
          <strong>Score ${score}: ${this.escape(rubric.label)}</strong>
          <p>${this.escape(rubric.description)}</p>
        </div>
      `;
      rubricEl.classList.remove('hidden');
    }
  }

  checkDeviation(dim, userScore, deviationEl) {
    const aiScore = this.aiScores[dim];
    if (aiScore === null || aiScore === undefined || !deviationEl) {
      if (deviationEl) deviationEl.classList.add('hidden');
      return;
    }
    const diff = Math.abs(userScore - aiScore);
    if (diff >= 2) {
      deviationEl.querySelector('.deviation-value').textContent = diff;
      deviationEl.classList.remove('hidden');
    } else {
      deviationEl.classList.add('hidden');
    }
  }

  // ========== VIEW TOGGLES ==========
  
  setupViewToggles() {
    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.currentTarget.dataset.view;
        const panel = e.currentTarget.closest('.tab-panel');
        if (!panel) return;
        
        const dimension = panel.id.replace('panel-', '');
        this.switchView(dimension, view);
        
        panel.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
      });
    });
  }

  switchView(dimension, view) {
    this.currentView[dimension] = view;
    const container = document.getElementById(`${dimension}-evidence`);
    if (!container) return;
    
    const content = container.dataset[view];
    if (content) {
      container.innerHTML = content;
      // Re-attach accordion listeners if in detailed view
      if (view === 'detailed') {
        this.setupAccordions(container);
      }
    }
  }

  setupAccordions(container) {
    container.querySelectorAll('.accordion-header').forEach(header => {
      header.addEventListener('click', () => {
        const item = header.closest('.accordion-item');
        item.classList.toggle('expanded');
      });
    });
  }

  // ========== SUBMIT BUTTONS ==========
  
  setupSubmitButtons() {
    const dimensions = ['team', 'funding', 'competitive', 'market', 'iprisk'];
    dimensions.forEach(dim => {
      const submitBtn = document.getElementById(`${dim}-submit-btn`);
      if (submitBtn) {
        submitBtn.addEventListener('click', () => this.submitAssessment(dim));
      }
    });
  }

  submitAssessment(dimension) {
    const justificationEl = document.getElementById(`${dimension}-justification`);
    const submitBtn = document.getElementById(`${dimension}-submit-btn`);
    const slider = document.getElementById(`${dimension}-score-slider`);
    const scoringCard = document.getElementById(`${dimension}-scoring-card`);
    
    const score = this.userScores[dimension].score || parseInt(slider?.value) || 5;
    const justification = justificationEl?.value || '';
    const isUpdate = this.userScores[dimension].submitted;
    
    // Update state
    this.userScores[dimension].score = score;
    this.userScores[dimension].justification = justification;
    this.userScores[dimension].submitted = true;
    this.userScores[dimension].timesSubmitted++;
    
    console.log(`Assessment ${isUpdate ? 'updated' : 'submitted'} for ${dimension}:`, { score, justification, timesSubmitted: this.userScores[dimension].timesSubmitted });
    
    // Update button to show submitted/update state
    if (submitBtn) {
      submitBtn.classList.add('submitted');
      submitBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        ${isUpdate ? 'Updated' : 'Submitted'}
      `;
      
      // After a brief moment, switch to "Update" state
      setTimeout(() => {
        submitBtn.classList.remove('submitted');
        submitBtn.classList.add('update-mode');
        submitBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Update Score
        `;
        submitBtn.disabled = false;
      }, 1500);
    }
    
    // Add visual indicator to scoring card
    if (scoringCard) {
      scoringCard.classList.add('has-submission');
    }
    
    // Keep slider and justification ENABLED for updates
    // (removed the disabling code)
    
    if (window.app?.stateManager) {
      window.app.stateManager.saveUserScore(dimension, { score, justification });
    }
    if (window.app?.toastManager) {
      window.app.toastManager.success(`${this.capitalize(dimension)} assessment ${isUpdate ? 'updated' : 'submitted'}`);
    }
    
    // Submit to Smartsheet
    this.submitToSmartsheet(dimension);
    
    // Update summary view after submit
    if (window.summaryView && this.data) {
      console.log('Updating summary view with data:', this.data);
      window.summaryView.update({
        company: this.data.company,
        team: this.data.team,
        funding: this.data.funding,
        competitive: this.data.competitive,
        market: this.data.market,
        iprisk: this.data.iprisk
      });
    } else {
      console.warn('Could not update summary:', { summaryView: !!window.summaryView, data: !!this.data });
    }
    
    // Check if all scores are now submitted - trigger auto-submit check
    this.checkAllScoresSubmitted();
  }

  /**
   * Submit score to Smartsheet
   * @param {string} dimension - team, funding, competitive, market, iprisk
   */
  async submitToSmartsheet(dimension) {
    if (!window.SmartsheetIntegration) {
      console.warn('SmartsheetIntegration not loaded');
      return;
    }

    const context = window.SmartsheetIntegration.getContext();
    
    // Get AI score based on dimension
    const aiScore = this.aiScores[dimension];
    
    const scoreData = {
      aiScore: aiScore,
      userScore: this.userScores[dimension].score,
      justification: this.userScores[dimension].justification
    };

    await window.SmartsheetIntegration.submitScore(dimension, scoreData, context);
  }

  /**
   * Check if all 5 scores have been submitted and trigger final submit modal
   */
  checkAllScoresSubmitted() {
    const dimensions = ['team', 'funding', 'competitive', 'market', 'iprisk'];
    const allSubmitted = dimensions.every(dim => this.userScores[dim].submitted);
    
    if (allSubmitted) {
      console.log('[AssessmentView] All scores submitted, triggering final submit check');
      
      // Gather data for the modal
      const scores = {};
      const missingJustifications = [];
      
      dimensions.forEach(dim => {
        scores[dim] = {
          aiScore: this.aiScores[dim],
          userScore: this.userScores[dim].score,
          justification: this.userScores[dim].justification
        };
        
        if (!this.userScores[dim].justification || this.userScores[dim].justification.trim() === '') {
          missingJustifications.push(dim);
        }
      });
      
      // Calculate averages
      const aiScoreSum = dimensions.reduce((sum, dim) => sum + (this.aiScores[dim] || 0), 0);
      const userScoreSum = dimensions.reduce((sum, dim) => sum + (this.userScores[dim].score || 0), 0);
      const avgAiScore = (aiScoreSum / dimensions.length).toFixed(1);
      const avgUserScore = (userScoreSum / dimensions.length).toFixed(1);
      
      // Notify app to show the final submit modal
      if (window.app?.showFinalSubmitModal) {
        window.app.showFinalSubmitModal({
          scores,
          missingJustifications,
          avgAiScore,
          avgUserScore
        });
      }
    }
  }

  /**
   * Get the submission status for all dimensions
   * @returns {Object} Status object with counts and details
   */
  getSubmissionStatus() {
    const dimensions = ['team', 'funding', 'competitive', 'market', 'iprisk'];
    const submitted = dimensions.filter(dim => this.userScores[dim].submitted);
    const pending = dimensions.filter(dim => !this.userScores[dim].submitted);
    const missingJustifications = dimensions.filter(dim => 
      this.userScores[dim].submitted && 
      (!this.userScores[dim].justification || this.userScores[dim].justification.trim() === '')
    );
    
    return {
      totalCount: dimensions.length,
      submittedCount: submitted.length,
      pendingCount: pending.length,
      submitted,
      pending,
      missingJustifications,
      allSubmitted: submitted.length === dimensions.length
    };
  }

  setUserScore(dimension, scoreData) {
    if (!scoreData) return;
    const slider = document.getElementById(`${dimension}-score-slider`);
    const display = document.getElementById(`${dimension}-user-score`);
    const justificationEl = document.getElementById(`${dimension}-justification`);
    
    if (slider && scoreData.score) {
      slider.value = scoreData.score;
      this.userScores[dimension].score = scoreData.score;
    }
    if (display && scoreData.score) display.textContent = scoreData.score;
    if (justificationEl && scoreData.justification) {
      justificationEl.value = scoreData.justification;
      this.userScores[dimension].justification = scoreData.justification;
    }
    if (scoreData.score) this.updateRubricDisplay(dimension, scoreData.score);
  }

  // ========== COMPANY DATA ==========
  
  loadCompanyData(data) {
    this.data.company = data;
    const container = document.getElementById('overview-content');
    if (!container) return;
    
    const overview = data.company_overview || {};
    const tech = data.technology || {};
    const products = data.products_and_applications || {};
    const market = data.market_context || {};
    
    container.innerHTML = `
      <div class="overview-grid compact">
        <div class="overview-card">
          <h3>Company</h3>
          <h4>${this.escape(overview.name || 'Unknown Company')}</h4>
          <p>${this.escape(overview.company_description || overview.mission_statement || '')}</p>
          <div class="overview-meta">
            ${overview.website ? `<span class="meta-item"><span class="meta-icon">🌐</span>${this.displayUrl(overview.website)}</span>` : ''}
            ${overview.founded_year ? `<span class="meta-item"><span class="meta-icon">📅</span>Founded ${overview.founded_year}</span>` : ''}
            ${overview.company_stage ? `<span class="meta-item"><span class="meta-icon">📊</span>${this.escape(overview.company_stage)}</span>` : ''}
          </div>
        </div>
        
        <div class="overview-card">
          <h3>Technology</h3>
          <p class="tech-category">${this.escape(tech.technology_category || '')}</p>
          <p>${this.escape(tech.core_technology || '')}</p>
          ${tech.key_innovations?.length > 0 ? `
            <div class="innovations-list">
              <strong>Key Innovations:</strong>
              <ul>${tech.key_innovations.slice(0, 3).map(i => `<li>${this.escape(i)}</li>`).join('')}</ul>
            </div>
          ` : ''}
        </div>
        
        <div class="overview-card">
          <h3>Products & Applications</h3>
          <p>${this.escape(products.primary_application || '')}</p>
          ${products.target_industries?.length > 0 ? `
            <p><strong>Industries:</strong> ${products.target_industries.slice(0, 4).map(i => this.escape(i)).join(', ')}</p>
          ` : ''}
          ${products.use_cases?.length > 0 ? `
            <div class="use-cases-list">
              <strong>Use Cases:</strong>
              <ul>${products.use_cases.slice(0, 3).map(u => `<li>${this.escape(u)}</li>`).join('')}</ul>
            </div>
          ` : ''}
        </div>
        
        <div class="overview-card">
          <h3>Market Context</h3>
          ${market.industry ? `<p><strong>Industry:</strong> ${this.escape(market.industry)}</p>` : ''}
          ${market.problem_addressed ? `<p><strong>Problem:</strong> ${this.escape(market.problem_addressed)}</p>` : ''}
          ${market.value_proposition ? `<p><strong>Value Prop:</strong> ${this.escape(market.value_proposition)}</p>` : ''}
          ${market.business_model ? `<p><strong>Model:</strong> ${this.escape(market.business_model)}</p>` : ''}
        </div>
      </div>
    `;
  }

  // ========== TEAM DATA ==========
  
  loadTeamData(data) {
    this.data.team = data;
    
    // API returns: { team: {...}, scoring: {...}, score: 6, formatted: {...} }
    const score = data?.score;
    this.aiScores.team = score;
    
    const aiScoreEl = document.getElementById('team-ai-score');
    if (aiScoreEl) aiScoreEl.textContent = score ?? '-';
    
    const slider = document.getElementById('team-score-slider');
    const display = document.getElementById('team-user-score');
    if (slider && score) {
      slider.value = score;
      if (display) display.textContent = score;
      this.userScores.team.score = score;
      this.updateRubricDisplay('team', score);
    }
    
    this.displayTeamEvidence(data);
  }

  displayTeamEvidence(data) {
    const container = document.getElementById('team-evidence');
    if (!container) return;
    
    // Use formatted data if available, fallback to raw
    const formatted = data?.formatted || {};
    const teamRaw = data?.team || {};
    const scoringRaw = data?.scoring || {};
    
    const members = formatted.members || teamRaw.team_members || [];
    // formatted.teamComposition uses: total, technical, business, domain
    // scoringRaw.team_composition uses: total_members, technical_experts, business_experts
    const composition = formatted.teamComposition || {};
    const compositionRaw = scoringRaw.team_composition || {};
    const teamSize = composition.total || compositionRaw.total_members || members.length || '-';
    const technicalCount = composition.technical || compositionRaw.technical_experts || '-';
    const businessCount = composition.business || compositionRaw.business_experts || '-';
    
    const strengths = formatted.strengths || scoringRaw.key_strengths || [];
    const gaps = formatted.gaps || scoringRaw.key_gaps || [];
    const sources = formatted.sources || teamRaw.trusted_sources || [];
    const confidence = formatted.confidence || teamRaw.data_confidence;
    const confidenceJustification = formatted.confidenceJustification || teamRaw.confidence_justification || '';
    const justification = formatted.justification || scoringRaw.score_justification || '';
    const rubricMatch = formatted.rubric || scoringRaw.rubric_match_explanation || '';
    
    // SUMMARY VIEW
    const summaryHTML = `
      <div class="evidence-content">
        <div class="metrics-row">
          <div class="metric-card">
            <span class="metric-label">Team Size</span>
            <span class="metric-value">${teamSize}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Technical</span>
            <span class="metric-value">${technicalCount}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Business</span>
            <span class="metric-value">${businessCount}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Confidence</span>
            <span class="metric-value">${confidence || '-'}</span>
          </div>
        </div>
        
        <div class="evidence-section">
          <h4>AI Assessment Rationale</h4>
          <div class="ai-rationale">${this.formatRationale(justification)}</div>
        </div>
        
        <div class="two-column-grid">
          <div class="evidence-section">
            <h4>Key Strengths</h4>
            <ul class="compact-list">${strengths.map(s => `<li>${this.escape(s)}</li>`).join('') || '<li>None identified</li>'}</ul>
          </div>
          <div class="evidence-section">
            <h4>Key Gaps</h4>
            <ul class="compact-list">${gaps.map(g => `<li>${this.escape(g)}</li>`).join('') || '<li>None identified</li>'}</ul>
          </div>
        </div>
      </div>
    `;
    
    // DETAILED VIEW - Expandable team member cards
    const detailedHTML = `
      <div class="evidence-content">
        <h4>Team Members (${members.length})</h4>
        <div class="accordion-list">
          ${members.map((m, i) => `
            <div class="accordion-item ${i === 0 ? 'expanded' : ''}">
              <div class="accordion-header">
                <div class="member-header-info">
                  <strong>${this.escape(m.name || 'Unknown')}</strong>
                  <span class="member-role-badge">${this.escape(m.role_at_venture || '')}</span>
                </div>
                <span class="accordion-icon">▼</span>
              </div>
              <div class="accordion-content">
                ${m.work_history?.length > 0 ? `
                  <div class="member-section">
                    <h5>Work History</h5>
                    <ul class="timeline-list">
                      ${m.work_history.slice(0, 4).map(w => `
                        <li>
                          <strong>${this.escape(w.position || w.company)}</strong>
                          ${w.company ? `<span class="org-name">@ ${this.escape(w.company)}</span>` : ''}
                          ${w.duration ? `<span class="duration">${this.escape(w.duration)}</span>` : ''}
                        </li>
                      `).join('')}
                    </ul>
                  </div>
                ` : ''}
                ${m.education_history?.length > 0 ? `
                  <div class="member-section">
                    <h5>Education</h5>
                    <ul class="timeline-list">
                      ${m.education_history.map(e => `
                        <li>
                          <strong>${this.escape(e.degree || '')}</strong>
                          <span class="org-name">${this.escape(e.institution || '')}</span>
                          ${e.year ? `<span class="duration">${e.year}</span>` : ''}
                        </li>
                      `).join('')}
                    </ul>
                  </div>
                ` : ''}
                ${m.commercialization_experience?.length > 0 ? `
                  <div class="member-section">
                    <h5>Commercialization Experience</h5>
                    <ul>
                      ${m.commercialization_experience.map(c => `
                        <li>${this.escape(c.description || '')} ${c.outcome ? `<em>(${this.escape(c.outcome)})</em>` : ''}</li>
                      `).join('')}
                    </ul>
                  </div>
                ` : ''}
                ${m.awards_recognition?.length > 0 && m.awards_recognition[0]?.award_name !== '—' ? `
                  <div class="member-section">
                    <h5>Awards & Recognition</h5>
                    <ul>
                      ${m.awards_recognition.filter(a => a.award_name && a.award_name !== '—').map(a => `
                        <li>${this.escape(a.award_name)} ${a.organization ? `(${this.escape(a.organization)})` : ''}</li>
                      `).join('')}
                    </ul>
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    // SOURCES VIEW
    const sourcesHTML = `
      <div class="evidence-content">
        <div class="evidence-section">
          <h4>Data Sources</h4>
          ${sources.length > 0 ? `
            <ul class="source-list">
              ${sources.map(s => `<li><a href="${this.escape(this.cleanSourceUrl(s))}" target="_blank" rel="noopener">${this.truncateUrl(s)}</a></li>`).join('')}
            </ul>
          ` : '<p>No sources available.</p>'}
        </div>
        <div class="evidence-section">
          <h4>Rubric Alignment</h4>
          <div class="rubric-explanation">${this.formatRationale(rubricMatch)}</div>
        </div>
        <div class="evidence-section">
          <h4>Confidence Note</h4>
          <p><strong>${confidence || '-'}</strong> confidence level.</p>
          <p>${this.escape(confidenceJustification || 'No additional confidence information.')}</p>
        </div>
      </div>
    `;
    
    container.innerHTML = summaryHTML;
    container.dataset.summary = summaryHTML;
    container.dataset.detailed = detailedHTML;
    container.dataset.sources = sourcesHTML;
    
    // Setup accordions for initial view if detailed
    if (this.currentView.team === 'detailed') {
      this.setupAccordions(container);
    }
  }

  // ========== FUNDING DATA ==========
  
  shouldShowTimeline(fundingRounds, marketDeals) {
    // Show timeline if there's any activity in the last 5 years
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    
    const recentVentureActivity = fundingRounds.some(r => {
      if (!r.date) return false;
      const date = new Date(r.date);
      return date >= fiveYearsAgo;
    });
    
    const recentMarketActivity = marketDeals.some(d => {
      if (!d.date && !d.deal_date) return false;
      const date = new Date(d.date || d.deal_date);
      return date >= fiveYearsAgo;
    });
    
    return recentVentureActivity || recentMarketActivity;
  }
  
  renderFundingTimeline(fundingRounds, marketDeals) {
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 4, currentYear - 3, currentYear - 2, currentYear - 1, currentYear];
    
    // Filter and organize data by year
    const ventureByYear = {};
    const marketByYear = {};
    
    years.forEach(year => {
      ventureByYear[year] = [];
      marketByYear[year] = [];
    });
    
    // Process venture funding rounds
    fundingRounds.forEach(r => {
      if (!r.date) return;
      const year = new Date(r.date).getFullYear();
      if (ventureByYear[year] !== undefined) {
        ventureByYear[year].push({
          date: r.date,
          type: r.type,
          amount: r.amount,
          description: r.description
        });
      }
    });
    
    // Process market deals
    marketDeals.forEach(d => {
      const date = d.date || d.deal_date;
      if (!date) return;
      const year = new Date(date).getFullYear();
      if (marketByYear[year] !== undefined) {
        marketByYear[year].push({
          date: date,
          company: d.company || d.startup_name,
          series: d.series || d.round,
          amount: d.amount || d.funding_amount?.amount
        });
      }
    });
    
    // Render timeline
    let html = '<div class="funding-timeline-visual">';
    
    years.forEach(year => {
      const ventureCount = ventureByYear[year].length;
      const marketCount = marketByYear[year].length;
      const hasActivity = ventureCount > 0 || marketCount > 0;
      
      html += `
        <div class="timeline-year ${hasActivity ? 'has-activity' : ''}">
          <div class="timeline-year-label">${year}</div>
          <div class="timeline-bars">
            <div class="timeline-bar venture-bar" title="${ventureCount} venture round${ventureCount !== 1 ? 's' : ''}">
              ${ventureCount > 0 ? `
                <div class="timeline-bar-fill" style="height: ${Math.min(ventureCount * 30, 100)}%">
                  <span class="timeline-bar-count">${ventureCount}</span>
                </div>
              ` : '<div class="timeline-bar-empty"></div>'}
            </div>
            <div class="timeline-bar market-bar" title="${marketCount} market deal${marketCount !== 1 ? 's' : ''}">
              ${marketCount > 0 ? `
                <div class="timeline-bar-fill" style="height: ${Math.min(marketCount * 20, 100)}%">
                  <span class="timeline-bar-count">${marketCount}</span>
                </div>
              ` : '<div class="timeline-bar-empty"></div>'}
            </div>
          </div>
          ${hasActivity ? `
            <div class="timeline-year-details">
              ${ventureCount > 0 ? `
                <div class="timeline-detail venture-detail">
                  <strong>Venture (${ventureCount}):</strong>
                  ${ventureByYear[year].slice(0, 2).map(v => {
                    let formattedAmount = 'Undisclosed';
                    if (v.amount && v.amount !== 'undisclosed' && v.amount !== 'Unknown') {
                      const amountStr = String(v.amount).toLowerCase();
                      const numMatch = amountStr.match(/[\d,.]+/);
                      if (numMatch) {
                        const num = parseFloat(numMatch[0].replace(/,/g, ''));
                        if (!isNaN(num)) {
                          if (amountStr.includes('million') || amountStr.includes('m')) {
                            formattedAmount = this.formatCurrencyWithCommas(num, true);
                          } else {
                            formattedAmount = this.formatCurrencyWithCommas(num / 1000000, true);
                          }
                        }
                      }
                    }
                    return `<div class="timeline-item">${this.escape(v.type)} - ${formattedAmount}</div>`;
                  }).join('')}
                  ${ventureCount > 2 ? `<div class="timeline-more">+${ventureCount - 2} more</div>` : ''}
                </div>
              ` : ''}
              ${marketCount > 0 ? `
                <div class="timeline-detail market-detail">
                  <strong>Market (${marketCount}):</strong>
                  ${marketByYear[year].slice(0, 2).map(m => {
                    let formattedAmount = 'Undisclosed';
                    if (m.amount) {
                      if (typeof m.amount === 'number') {
                        formattedAmount = this.formatCurrencyWithCommas(m.amount, true);
                      }
                    }
                    return `<div class="timeline-item">${this.escape(m.company)} - ${formattedAmount}</div>`;
                  }).join('')}
                  ${marketCount > 2 ? `<div class="timeline-more">+${marketCount - 2} more</div>` : ''}
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      `;
    });
    
    html += '</div>';
    html += `
      <div class="timeline-legend">
        <div class="legend-item">
          <div class="legend-color venture-color"></div>
          <span>Venture Funding Rounds</span>
        </div>
        <div class="legend-item">
          <div class="legend-color market-color"></div>
          <span>Comparable Market Deals</span>
        </div>
      </div>
    `;
    
    return html;
  }
  
  loadFundingData(data) {
    this.data.funding = data;
    
    // API returns: { analysis: {...}, assessment: {...}, score: 5, formatted: {...} }
    const score = data?.score || data?.assessment?.score;
    this.aiScores.funding = score;
    
    const aiScoreEl = document.getElementById('funding-ai-score');
    if (aiScoreEl) aiScoreEl.textContent = score ?? '-';
    
    const slider = document.getElementById('funding-score-slider');
    const display = document.getElementById('funding-user-score');
    if (slider && score) {
      slider.value = score;
      if (display) display.textContent = score;
      this.userScores.funding.score = score;
      this.updateRubricDisplay('funding', score);
    }
    
    this.displayFundingEvidence(data);
  }

  displayFundingEvidence(data) {
    const container = document.getElementById('funding-evidence');
    if (!container) return;
    
    // Use formatted data if available, fallback to raw
    const formatted = data?.formatted || {};
    const analysisRaw = data?.analysis || {};
    const assessmentRaw = data?.assessment || {};
    
    const ventureFunding = analysisRaw?.venture_funding || {};
    // formatted uses: fundingRounds (array with url), peerDeals (array with url)
    const fundingRounds = formatted.fundingRounds || ventureFunding.funding_rounds || [];
    const marketDeals = formatted.peerDeals || analysisRaw?.market_deals || [];
    const confidence = formatted.confidence || analysisRaw?.data_confidence;
    const confidenceJustification = formatted.confidenceJustification || analysisRaw?.confidence_justification || '';
    const justification = assessmentRaw?.score_justification || {};
    const evidenceSummary = formatted.summary || justification?.evidence_summary || '';
    
    // Get industry/application context
    const applicationArea = analysisRaw?.application_area || formatted.applicationArea || '';
    const researchTopic = analysisRaw?.research_topic || formatted.researchTopic || '';
    
    // Calculate total VC activity in the space
    // Note: API may return amounts in raw dollars OR in millions - need to normalize
    const totalVCInvested = marketDeals.reduce((sum, deal) => {
      const amount = deal.amount || deal.funding_amount?.amount;
      if (typeof amount === 'number') {
        // If amount > 10000, assume it's in raw dollars and convert to millions
        // Otherwise assume it's already in millions (e.g., 60 = $60M)
        const inMillions = amount > 10000 ? amount / 1000000 : amount;
        return sum + inMillions;
      }
      return sum;
    }, 0);
    
    // Get unique investors across all market deals
    const uniqueInvestors = new Set();
    marketDeals.forEach(deal => {
      const investors = deal.investors || deal.vc_firms || [];
      investors.forEach(inv => uniqueInvestors.add(inv));
    });
    
    // SUMMARY VIEW - Now shows both venture and market activity
    const summaryHTML = `
      <div class="evidence-content">
        <div class="metrics-row">
          <div class="metric-card">
            <span class="metric-label">Prior Funding</span>
            <span class="metric-value">${formatted.hasPriorFunding || ventureFunding.has_prior_funding ? 'Yes' : 'No'}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Venture Rounds</span>
            <span class="metric-value">${formatted.totalFundingRounds || fundingRounds.length}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Market Deals</span>
            <span class="metric-value">${formatted.totalPeerDeals || marketDeals.length}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Confidence</span>
            <span class="metric-value">${confidence || '-'}</span>
          </div>
        </div>
        
        <div class="evidence-section">
          <h4>AI Assessment Rationale</h4>
          <div class="ai-rationale">${this.formatRationale(evidenceSummary)}</div>
        </div>
        
        ${this.shouldShowTimeline(fundingRounds, marketDeals) ? `
          <div class="evidence-section">
            <h4>Funding Activity Timeline (Last 5 Years)</h4>
            ${this.renderFundingTimeline(fundingRounds, marketDeals)}
          </div>
        ` : ''}
        
        <div class="two-column-grid">
          ${fundingRounds.length > 0 ? `
            <div class="evidence-section">
              <h4>Venture Funding History</h4>
              <div class="funding-timeline">
                ${fundingRounds.slice(0, 3).map(r => {
                  // Parse and format the amount properly
                  let formattedAmount = 'Undisclosed';
                  if (r.amount && r.amount !== 'undisclosed' && r.amount !== 'Unknown') {
                    // Check if it's a number or string that needs parsing
                    const amountStr = String(r.amount).toLowerCase();
                    
                    // Try to extract numeric value
                    const numMatch = amountStr.match(/[\d,.]+/);
                    if (numMatch) {
                      const num = parseFloat(numMatch[0].replace(/,/g, ''));
                      if (!isNaN(num)) {
                        // Check if the original string indicates it's already in millions
                        if (amountStr.includes('million') || amountStr.includes('m')) {
                          formattedAmount = this.formatCurrencyWithCommas(num, true);
                        } else {
                          // Assume it's in actual dollars, convert to millions
                          formattedAmount = this.formatCurrencyWithCommas(num / 1000000, true);
                        }
                      } else {
                        formattedAmount = r.amount;
                      }
                    } else {
                      formattedAmount = r.amount;
                    }
                  }
                  return `
                    <div class="funding-event">
                      <span class="funding-date">${this.formatDate(r.date)}</span>
                      <span class="funding-type">${this.escape(r.type)}</span>
                      <span class="funding-amount">${formattedAmount}</span>
                    </div>
                  `;
                }).join('')}
                ${fundingRounds.length > 3 ? `<p class="more-link">+ ${fundingRounds.length - 3} more rounds in detailed view</p>` : ''}
              </div>
            </div>
          ` : `
            <div class="evidence-section">
              <h4>Venture Funding History</h4>
              <p class="no-data-message">No prior funding rounds identified for this venture.</p>
            </div>
          `}
          
          ${marketDeals.length > 0 ? `
            <div class="evidence-section">
              <h4>Industry VC Activity</h4>
              ${applicationArea ? `
                <p class="industry-context"><strong>Application Area:</strong> ${this.escape(applicationArea)}</p>
              ` : ''}
              <div class="vc-activity-summary">
                <div class="vc-stat">
                  <span class="vc-stat-label">Total Invested</span>
                  <span class="vc-stat-value">${totalVCInvested > 0 ? this.formatCurrencyWithCommas(totalVCInvested) : 'Not disclosed'}</span>
                </div>
                <div class="vc-stat">
                  <span class="vc-stat-label">Active VCs</span>
                  <span class="vc-stat-value">${uniqueInvestors.size} firms</span>
                </div>
              </div>
              <div class="recent-deals-list">
                <strong>Recent Comparable Deals:</strong>
                ${marketDeals.slice(0, 3).map(d => {
                  // Format deal amount properly - handle both formatted and raw data structures
                  let dealAmount = 'Undisclosed';
                  
                  // Try to get the amount from either structure
                  let amount = null;
                  if (d.amount !== undefined && d.amount !== null) {
                    amount = d.amount;
                  } else if (d.funding_amount && d.funding_amount.amount !== undefined && d.funding_amount.amount !== null) {
                    amount = d.funding_amount.amount;
                  }
                  
                  if (amount !== null) {
                    if (typeof amount === 'number') {
                      // API may return amounts in raw dollars or millions
                      // If > 10000, assume raw dollars and convert to millions
                      const inMillions = amount > 10000 ? amount / 1000000 : amount;
                      dealAmount = this.formatCurrencyWithCommas(inMillions, true);
                    } else {
                      // It's a string, try to parse it
                      const amountStr = String(amount).toLowerCase();
                      const numMatch = amountStr.match(/[\d,.]+/);
                      if (numMatch) {
                        const num = parseFloat(numMatch[0].replace(/,/g, ''));
                        if (!isNaN(num)) {
                          // Check if string indicates millions/billions or is raw dollars
                          if (amountStr.includes('billion') || amountStr.includes('b')) {
                            dealAmount = this.formatCurrencyWithCommas(num * 1000, true); // Convert billions to millions
                          } else if (amountStr.includes('million') || amountStr.includes('m')) {
                            dealAmount = this.formatCurrencyWithCommas(num, true);
                          } else if (num > 1000) {
                            // Large number without unit - assume raw dollars, convert to millions
                            dealAmount = this.formatCurrencyWithCommas(num / 1000000, true);
                          } else {
                            // Small number without unit - assume already in millions
                            dealAmount = this.formatCurrencyWithCommas(num, true);
                          }
                        } else {
                          dealAmount = String(amount);
                        }
                      } else {
                        dealAmount = String(amount);
                      }
                    }
                  }
                  return `
                    <div class="market-deal-item">
                      <span class="deal-company">${this.escape(d.company || d.startup_name)}</span>
                      <span class="deal-series">${this.escape(d.series || d.round || 'N/A')}</span>
                      <span class="deal-amount">${dealAmount}</span>
                    </div>
                  `;
                }).join('')}
                ${marketDeals.length > 3 ? `<p class="more-link">+ ${marketDeals.length - 3} more deals in detailed view</p>` : ''}
              </div>
            </div>
          ` : `
            <div class="evidence-section">
              <h4>Industry VC Activity</h4>
              ${applicationArea ? `
                <p class="industry-context"><strong>Application Area:</strong> ${this.escape(applicationArea)}</p>
              ` : ''}
              <p class="no-data-message">Limited comparable VC deals found in this application area.</p>
            </div>
          `}
        </div>
      </div>
    `;
    
    // DETAILED VIEW
    const detailedHTML = `
      <div class="evidence-content">
        <div class="evidence-section">
          <h4>Company Funding Rounds (${fundingRounds.length})</h4>
          ${fundingRounds.length > 0 ? `
            <table class="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                ${fundingRounds.map(r => {
                  // Format amount properly
                  let formattedAmount = 'Undisclosed';
                  if (r.amount && r.amount !== 'undisclosed' && r.amount !== 'Unknown') {
                    const amountStr = String(r.amount).toLowerCase();
                    const numMatch = amountStr.match(/[\d,.]+/);
                    if (numMatch) {
                      const num = parseFloat(numMatch[0].replace(/,/g, ''));
                      if (!isNaN(num)) {
                        if (amountStr.includes('million') || amountStr.includes('m')) {
                          formattedAmount = this.formatCurrencyWithCommas(num, true);
                        } else {
                          formattedAmount = this.formatCurrencyWithCommas(num / 1000000, true);
                        }
                      } else {
                        formattedAmount = r.amount;
                      }
                    } else {
                      formattedAmount = r.amount;
                    }
                  }
                  return `
                    <tr>
                      <td>${this.formatDate(r.date)}</td>
                      <td>${this.escape(r.type)}</td>
                      <td>${formattedAmount}</td>
                      <td class="details-cell">${this.escape(this.truncate(r.description || r.source || '', 100))}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          ` : '<p>No funding rounds identified.</p>'}
        </div>
        
        <div class="evidence-section">
          <h4>Comparable Market Deals (${marketDeals.length})</h4>
          ${applicationArea ? `
            <p class="industry-context" style="margin-bottom: 12px;"><strong>Application Area:</strong> ${this.escape(applicationArea)}</p>
          ` : ''}
          ${marketDeals.length > 0 ? `
            <table class="data-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Series</th>
                  <th>Amount</th>
                  <th>Investors</th>
                </tr>
              </thead>
              <tbody>
                ${marketDeals.map(d => {
                  // Format deal amount - handle both formatted and raw data structures
                  let dealAmount = 'Undisclosed';
                  
                  // Try to get the amount from either structure
                  let amount = null;
                  if (d.amount !== undefined && d.amount !== null) {
                    amount = d.amount;
                  } else if (d.funding_amount && d.funding_amount.amount !== undefined && d.funding_amount.amount !== null) {
                    amount = d.funding_amount.amount;
                  }
                  
                  if (amount !== null) {
                    if (typeof amount === 'number') {
                      // API may return amounts in raw dollars or millions
                      // If > 10000, assume raw dollars and convert to millions
                      const inMillions = amount > 10000 ? amount / 1000000 : amount;
                      dealAmount = this.formatCurrencyWithCommas(inMillions, true);
                    } else {
                      const amountStr = String(amount).toLowerCase();
                      const numMatch = amountStr.match(/[\d,.]+/);
                      if (numMatch) {
                        const num = parseFloat(numMatch[0].replace(/,/g, ''));
                        if (!isNaN(num)) {
                          // Check if string indicates millions/billions or is raw dollars
                          if (amountStr.includes('billion') || amountStr.includes('b')) {
                            dealAmount = this.formatCurrencyWithCommas(num * 1000, true); // Convert billions to millions
                          } else if (amountStr.includes('million') || amountStr.includes('m')) {
                            dealAmount = this.formatCurrencyWithCommas(num, true);
                          } else if (num > 10000) {
                            // Large number without unit - assume raw dollars, convert to millions
                            dealAmount = this.formatCurrencyWithCommas(num / 1000000, true);
                          } else {
                            // Small number without unit - assume already in millions
                            dealAmount = this.formatCurrencyWithCommas(num, true);
                          }
                        } else {
                          dealAmount = String(amount);
                        }
                      } else {
                        dealAmount = String(amount);
                      }
                    }
                  }
                  return `
                    <tr>
                      <td><strong>${this.escape(d.company || d.startup_name)}</strong></td>
                      <td>${this.escape(d.series || d.round || 'N/A')}</td>
                      <td>${dealAmount}</td>
                      <td class="investors-cell">${(d.investors || d.vc_firms || []).slice(0, 2).map(v => this.escape(v)).join(', ')}${(d.investors || d.vc_firms || []).length > 2 ? '...' : ''}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          ` : '<p>No comparable deals found.</p>'}
        </div>
      </div>
    `;
    
    // SOURCES VIEW - Use formatted data urls
    const fundingSourceList = fundingRounds.filter(r => r.url).map(r => ({
      label: r.type,
      url: r.url
    }));
    const dealSourceList = marketDeals.filter(d => d.url || d.source_url).map(d => ({
      label: d.company || d.startup_name,
      url: d.url || d.source_url
    }));
    
    const sourcesHTML = `
      <div class="evidence-content">
        <div class="evidence-section">
          <h4>Funding Round Sources</h4>
          ${fundingSourceList.length > 0 ? `
            <ul class="source-list">
              ${fundingSourceList.map(s => `
                <li>
                  <strong>${this.escape(s.label)}</strong>: 
                  <a href="${this.escape(this.cleanSourceUrl(s.url))}" target="_blank" rel="noopener">${this.truncateUrl(s.url)}</a>
                </li>
              `).join('')}
            </ul>
          ` : '<p>No source URLs available for funding rounds.</p>'}
        </div>
        <div class="evidence-section">
          <h4>Market Deal Sources</h4>
          ${dealSourceList.length > 0 ? `
            <ul class="source-list">
              ${dealSourceList.map(s => `
                <li>
                  <strong>${this.escape(s.label)}</strong>: 
                  <a href="${this.escape(this.cleanSourceUrl(s.url))}" target="_blank" rel="noopener">${this.truncateUrl(s.url)}</a>
                </li>
              `).join('')}
            </ul>
          ` : '<p>No source URLs available for market deals.</p>'}
        </div>
        <div class="evidence-section">
          <h4>Confidence Note</h4>
          <p><strong>${confidence || '-'}</strong> confidence level.</p>
          <p>${this.escape(confidenceJustification || 'No additional confidence information.')}</p>
        </div>
      </div>
    `;
    
    container.innerHTML = summaryHTML;
    container.dataset.summary = summaryHTML;
    container.dataset.detailed = detailedHTML;
    container.dataset.sources = sourcesHTML;
  }

  // ========== COMPETITIVE DATA ==========
  
  loadCompetitiveData(data) {
    this.data.competitive = data;
    
    // API returns: { analysis: {...}, assessment: {...}, score: 2, formatted: {...} }
    const score = data?.score || data?.assessment?.score;
    this.aiScores.competitive = score;
    
    const aiScoreEl = document.getElementById('competitive-ai-score');
    if (aiScoreEl) aiScoreEl.textContent = score ?? '-';
    
    const slider = document.getElementById('competitive-score-slider');
    const display = document.getElementById('competitive-user-score');
    if (slider && score) {
      slider.value = score;
      if (display) display.textContent = score;
      this.userScores.competitive.score = score;
      this.updateRubricDisplay('competitive', score);
    }
    
    this.displayCompetitiveEvidence(data);
  }

  displayCompetitiveEvidence(data) {
    const container = document.getElementById('competitive-evidence');
    if (!container) return;
    
    // Use formatted data if available, fallback to raw
    const formatted = data?.formatted || {};
    const analysisRaw = data?.analysis || {};
    const assessmentRaw = data?.assessment || {};
    
    const marketOverview = analysisRaw?.market_overview || {};
    const competitors = formatted.competitors || marketOverview.competitors || [];
    const analysis = analysisRaw?.competitive_analysis || {};
    const dataQuality = analysisRaw?.data_quality || {};
    
    const competitorCount = assessmentRaw?.competitor_count || formatted.competitorCount || {};
    const marketLeaders = assessmentRaw?.market_leaders || formatted.marketLeaders || analysis?.dominant_players || [];
    const intensity = assessmentRaw?.competitive_intensity || formatted.intensity || analysis?.competitive_intensity || '';
    const keyRisks = assessmentRaw?.key_risk_factors || formatted.keyRisks || [];
    const opportunities = assessmentRaw?.differentiation_opportunities || formatted.opportunities || analysis?.market_gaps || [];
    const justification = formatted.justification || assessmentRaw?.score_justification || '';
    const confidence = formatted.confidence || analysisRaw?.data_confidence;
    const confidenceJustification = formatted.confidenceJustification || analysisRaw?.confidence_justification || '';
    const sources = dataQuality?.sources_used || [];
    
    // SUMMARY VIEW
    const summaryHTML = `
      <div class="evidence-content">
        <div class="metrics-row">
          <div class="metric-card">
            <span class="metric-label">Competitors</span>
            <span class="metric-value">${competitorCount.total || competitors.length || '-'}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Large Corps</span>
            <span class="metric-value">${competitorCount.large_companies || '-'}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Intensity</span>
            <span class="metric-value">${this.capitalize(intensity)}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Confidence</span>
            <span class="metric-value">${confidence || '-'}</span>
          </div>
        </div>
        
        <div class="evidence-section">
          <h4>AI Assessment Rationale</h4>
          <div class="ai-rationale">${this.formatRationale(justification)}</div>
        </div>
        
        <div class="two-column-grid">
          <div class="evidence-section">
            <h4>Key Risk Factors</h4>
            <ul class="compact-list">${keyRisks.slice(0, 4).map(r => `<li>${this.escape(r)}</li>`).join('') || '<li>None identified</li>'}</ul>
          </div>
          <div class="evidence-section">
            <h4>Differentiation Opportunities</h4>
            <ul class="compact-list">${opportunities.slice(0, 4).map(o => `<li>${this.escape(o)}</li>`).join('') || '<li>None identified</li>'}</ul>
          </div>
        </div>
        
        ${marketLeaders.length > 0 ? `
          <div class="evidence-section">
            <h4>Market Leaders</h4>
            <div class="leader-badges">
              ${marketLeaders.map(l => `<span class="leader-badge">${this.escape(l)}</span>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
    
    // DETAILED VIEW - Competitor cards with company names
    const detailedHTML = `
      <div class="evidence-content">
        <div class="evidence-section">
          <h4>Market Dynamics</h4>
          <p>${this.escape(marketOverview.market_dynamics || '')}</p>
        </div>
        
        <h4>Competitors (${competitors.length})</h4>
        <div class="competitor-grid">
          ${competitors.slice(0, 12).map(c => `
            <div class="competitor-card-detailed">
              <div class="competitor-header">
                <strong class="competitor-name">${this.escape(c.name || c.company_name || 'Unknown Competitor')}</strong>
                <div class="competitor-badges">
                  <span class="size-badge ${(c.size || c.size_category || c.companySize || '').toLowerCase()}">${this.escape(c.size || c.size_category || c.companySize || '')}</span>
                  <span class="type-badge">${this.escape(c.competitorType || 'direct')}</span>
                </div>
              </div>
              ${(c.product || c.product_name) ? `<p class="product-name">${this.escape(c.product || c.product_name)}</p>` : ''}
              ${(c.description || c.product_description) ? `<p class="product-desc">${this.escape(this.truncate(c.description || c.product_description, 120))}</p>` : ''}
              ${c.strengths?.length > 0 ? `
                <div class="competitor-strengths">
                  <strong>Strengths:</strong> ${c.strengths.slice(0, 2).map(s => this.escape(s)).join('; ')}
                </div>
              ` : ''}
              ${c.weaknesses?.length > 0 ? `
                <div class="competitor-weaknesses">
                  <strong>Weaknesses:</strong> ${c.weaknesses.slice(0, 2).map(w => this.escape(w)).join('; ')}
                </div>
              ` : ''}
              ${c.revenue ? `<p class="competitor-revenue">Revenue: ${this.escape(c.revenue)}</p>` : ''}
            </div>
          `).join('')}
        </div>
        ${competitors.length > 12 ? `<p class="more-note">+ ${competitors.length - 12} more competitors</p>` : ''}
      </div>
    `;
    
    // SOURCES VIEW
    const sourcesHTML = `
      <div class="evidence-content">
        <div class="evidence-section">
          <h4>Data Sources</h4>
          ${sources.length > 0 ? `
            <ul class="source-list">
              ${sources.map(s => {
                const cleanUrl = this.cleanSourceUrl(s);
                return `<li><a href="${this.escape(cleanUrl)}" target="_blank" rel="noopener">${this.truncateUrl(cleanUrl)}</a></li>`;
              }).join('')}
            </ul>
          ` : '<p>No sources available.</p>'}
        </div>
        <div class="evidence-section">
          <h4>Rubric Alignment</h4>
          <div class="rubric-explanation">${this.formatRationale(assessmentRaw?.rubric_match_explanation || '')}</div>
        </div>
        <div class="evidence-section">
          <h4>Confidence Note</h4>
          <p><strong>${confidence || '-'}</strong> confidence level.</p>
          <p>${this.escape(confidenceJustification || 'No additional confidence information.')}</p>
        </div>
      </div>
    `;
    
    container.innerHTML = summaryHTML;
    container.dataset.summary = summaryHTML;
    container.dataset.detailed = detailedHTML;
    container.dataset.sources = sourcesHTML;
  }

  // ========== MARKET DATA ==========
  
  loadMarketData(data) {
    this.data.market = data;
    
    // API returns: { analysis: {...}, scoring: {...}, formatted: {...} }
    // Score is in scoring.score
    const score = data?.scoring?.score || data?.score;
    this.aiScores.market = score;
    
    const aiScoreEl = document.getElementById('market-ai-score');
    if (aiScoreEl) aiScoreEl.textContent = score ?? '-';
    
    const slider = document.getElementById('market-score-slider');
    const display = document.getElementById('market-user-score');
    if (slider && score) {
      slider.value = score;
      if (display) display.textContent = score;
      this.userScores.market.score = score;
      this.updateRubricDisplay('market', score);
    }
    
    this.displayMarketEvidence(data);
  }

  displayMarketEvidence(data) {
    const container = document.getElementById('market-evidence');
    if (!container) return;
    
    // Use formatted data - this is the primary source
    const formatted = data?.formatted || {};
    const analysisRaw = data?.analysis || {};
    const scoringRaw = data?.scoring || {};
    
    // Primary market from formatted (has tam, cagr) or analysis (has tam_usd, cagr_percent)
    const primaryMarket = formatted.primaryMarket || analysisRaw?.primary_market || {};
    const tam = primaryMarket.tam || primaryMarket.tam_usd;
    const cagr = primaryMarket.cagr || primaryMarket.cagr_percent;
    
    // Markets array - formatted uses: tam, cagr, source, confidence
    // analysisRaw uses: tam_current_usd, cagr_percent, source_url, data_confidence
    const markets = formatted.markets || analysisRaw?.markets || [];
    
    const marketAnalysis = analysisRaw?.market_analysis || {};
    const confidence = formatted.confidence || scoringRaw?.data_quality?.overall_confidence;
    const confidenceJustification = formatted.confidenceJustification || scoringRaw?.data_quality?.confidence_justification || '';
    
    // Justification
    const justificationSummary = formatted.justification || scoringRaw?.justification?.summary || '';
    const strengths = formatted.strengths || scoringRaw?.justification?.strengths_considered || [];
    const limitations = formatted.limitations || scoringRaw?.justification?.limitations_considered || [];
    
    // TAM/CAGR categories
    const tamCategory = formatted.tamCategory || formatted.rubricDetails?.tamCategory || scoringRaw?.rubric_application?.tam_category || '';
    const cagrCategory = formatted.cagrCategory || formatted.rubricDetails?.cagrCategory || scoringRaw?.rubric_application?.cagr_category || '';
    
    // Format category nicely
    const formatCategory = (cat) => {
      if (!cat) return '-';
      return cat.replace(/_/g, ' ')
        .replace('under 500M', '< $500M')
        .replace('500M to 5B', '$500M - $5B')
        .replace('over 5B', '> $5B')
        .replace('under 10', '< 10%')
        .replace('10 to 35', '10-35%')
        .replace('over 35', '> 35%');
    };
    
    // SUMMARY VIEW
    const summaryHTML = `
      <div class="evidence-content">
        <div class="metrics-row">
          <div class="metric-card">
            <span class="metric-label">TAM</span>
            <span class="metric-value">${this.formatCurrency(tam)}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">CAGR</span>
            <span class="metric-value">${typeof cagr === 'number' ? cagr.toFixed(1) + '%' : '-'}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Category</span>
            <span class="metric-value category-value">${formatCategory(tamCategory)}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Confidence</span>
            <span class="metric-value">${confidence || '-'}</span>
          </div>
        </div>
        
        <div class="evidence-section">
          <h4>AI Assessment Rationale</h4>
          <div class="ai-rationale">${this.formatRationale(justificationSummary)}</div>
        </div>
        
        <div class="two-column-grid">
          <div class="evidence-section">
            <h4>Strengths</h4>
            <ul class="compact-list">${strengths.map(s => `<li>${this.escape(s)}</li>`).join('') || '<li>None identified</li>'}</ul>
          </div>
          <div class="evidence-section">
            <h4>Limitations</h4>
            <ul class="compact-list">${limitations.map(l => `<li>${this.escape(l)}</li>`).join('') || '<li>None identified</li>'}</ul>
          </div>
        </div>
      </div>
    `;
    
    // DETAILED VIEW - Market segments table + analysis
    const detailedHTML = `
      <div class="evidence-content">
        <div class="evidence-section">
          <h4>Market Segments</h4>
          ${markets.length > 0 ? `
            <table class="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Market</th>
                  <th>TAM</th>
                  <th>CAGR</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                ${markets.map((m, i) => {
                  const mTam = m.tam || m.tam_current_usd;
                  const mCagr = m.cagr || m.cagr_percent;
                  const mConf = m.confidence || m.data_confidence;
                  return `
                    <tr>
                      <td>${m.rank || i + 1}</td>
                      <td>${this.escape(m.description)}</td>
                      <td>${this.formatCurrency(mTam)}</td>
                      <td>${typeof mCagr === 'number' ? mCagr.toFixed(1) + '%' : '-'}</td>
                      <td>${mConf ? Math.round(mConf * 100) + '%' : '-'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          ` : '<p>No market data available.</p>'}
        </div>
        
        <div class="evidence-section">
          <h4>Primary Market Selection</h4>
          <p><strong>${this.escape(primaryMarket.description || '')}</strong></p>
          <p>${this.escape(primaryMarket.rationale || primaryMarket.selection_rationale || '')}</p>
        </div>
        
        ${(formatted.trends || marketAnalysis.trends)?.length > 0 ? `
          <div class="evidence-section">
            <h4>Market Trends</h4>
            <ul>${(formatted.trends || marketAnalysis.trends).map(t => `<li>${this.escape(t)}</li>`).join('')}</ul>
          </div>
        ` : ''}
        
        ${(formatted.opportunities || marketAnalysis.opportunities)?.length > 0 ? `
          <div class="evidence-section">
            <h4>Opportunities</h4>
            <ul>${(formatted.opportunities || marketAnalysis.opportunities).map(o => `<li>${this.escape(o)}</li>`).join('')}</ul>
          </div>
        ` : ''}
        
        ${(formatted.barriers || marketAnalysis.barriers_to_entry)?.length > 0 ? `
          <div class="evidence-section">
            <h4>Barriers to Entry</h4>
            <ul>${(formatted.barriers || marketAnalysis.barriers_to_entry).map(b => `<li>${this.escape(b)}</li>`).join('')}</ul>
          </div>
        ` : ''}
      </div>
    `;
    
    // SOURCES VIEW
    const marketSources = markets.filter(m => m.source || m.source_url).map(m => ({
      label: m.description,
      url: m.source || m.source_url
    }));
    
    const sourcesHTML = `
      <div class="evidence-content">
        <div class="evidence-section">
          <h4>Market Data Sources</h4>
          ${marketSources.length > 0 ? `
            <ul class="source-list">
              ${marketSources.map(s => `
                <li>
                  <strong>${this.escape(s.label)}</strong>: 
                  <a href="${this.escape(this.cleanSourceUrl(s.url))}" target="_blank" rel="noopener">${this.truncateUrl(s.url)}</a>
                </li>
              `).join('')}
            </ul>
          ` : '<p>No source URLs available.</p>'}
        </div>
        <div class="evidence-section">
          <h4>Confidence Note</h4>
          <p><strong>${confidence || '-'}</strong> confidence level.</p>
          <p>${this.escape(confidenceJustification || 'No additional confidence information.')}</p>
        </div>
        <div class="evidence-section">
          <h4>Data Quality</h4>
          <p><strong>Recency:</strong> ${this.escape(formatted.dataRecency || scoringRaw?.data_quality?.data_recency || 'Unknown')}</p>
          ${(formatted.dataConcerns || scoringRaw?.data_quality?.data_concerns)?.length > 0 ? `
            <p><strong>Concerns:</strong></p>
            <ul>${(formatted.dataConcerns || scoringRaw?.data_quality?.data_concerns).map(c => `<li>${this.escape(c)}</li>`).join('')}</ul>
          ` : ''}
        </div>
      </div>
    `;
    
    container.innerHTML = summaryHTML;
    container.dataset.summary = summaryHTML;
    container.dataset.detailed = detailedHTML;
    container.dataset.sources = sourcesHTML;
  }

  // ========== IP RISK DATA ==========
  
  loadIpRiskData(data) {
    this.data.iprisk = data;
    
    // API returns: { data: {...}, score: 3, formatted: {...} }
    const score = data?.score || data?.formatted?.score;
    this.aiScores.iprisk = score;
    
    const aiScoreEl = document.getElementById('iprisk-ai-score');
    if (aiScoreEl) aiScoreEl.textContent = score ?? '-';
    
    const slider = document.getElementById('iprisk-score-slider');
    const display = document.getElementById('iprisk-user-score');
    if (slider && score) {
      slider.value = score;
      if (display) display.textContent = score;
      this.userScores.iprisk.score = score;
      this.updateRubricDisplay('iprisk', score);
    }
    
    this.displayIpRiskEvidence(data);
  }

  displayIpRiskEvidence(data) {
    const container = document.getElementById('iprisk-evidence');
    if (!container) return;
    
    // IP Risk API returns: { data: {...ipRiskSummary, patentTable...}, score, formatted: {...} }
    const formatted = data?.formatted || {};
    const ipData = data?.data || {};
    const summary = ipData?.ipRiskSummary || {};
    const patentTable = ipData?.patentTable || {};
    
    // Extract from formatted or raw
    const riskLevel = formatted.riskLevel || summary.overallIPRisk?.riskLevel || 'unknown';
    const riskAnalysis = formatted.riskAnalysis || summary.overallIPRisk?.analysis || '';
    const companyIP = formatted.companyIP || summary.companyCurrentIP || {};
    const uniqueFeatures = formatted.uniqueFeatures || summary.uniquePatentableFeatures || [];
    const crowdedFeatures = formatted.crowdedFeatures || summary.crowdedPatentableFeatures || [];
    const challenges = formatted.challenges || summary.overallIPRisk?.thirdPartyChallenges || [];
    const topOwners = formatted.topOwners || summary.topPatentOwners || [];
    const relevantPatents = formatted.relevantPatents || summary.top5RelevantPatents || [];
    const confidence = formatted.dataConfidence || ipData?.dataConfidence;
    const confidenceJustification = formatted.dataConfidenceJustification || ipData?.confidenceJustification || '';
    
    // SUMMARY VIEW
    const summaryHTML = `
      <div class="evidence-content">
        <div class="metrics-row">
          <div class="metric-card">
            <span class="metric-label">Risk Level</span>
            <span class="metric-value risk-${riskLevel.toLowerCase()}">${this.capitalize(riskLevel)}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Score</span>
            <span class="metric-value">${data?.score || '-'}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Patent Holders</span>
            <span class="metric-value">${topOwners.length || '-'}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Confidence</span>
            <span class="metric-value">${confidence || '-'}</span>
          </div>
        </div>
        
        <div class="evidence-section">
          <h4>AI Assessment Rationale</h4>
          <div class="ai-rationale">${this.formatRationale(riskAnalysis || companyIP.description || data?.rubricDescription || 'No rationale provided.')}</div>
        </div>
        
        <div class="evidence-section">
          <h4>Company IP Position</h4>
          <p>${this.escape(companyIP.description || 'No IP summary available.')}</p>
        </div>
        
        <div class="two-column-grid">
          <div class="evidence-section">
            <h4>Unique Protectable Features</h4>
            <ul class="compact-list">${uniqueFeatures.slice(0, 4).map(f => `<li>${this.escape(f)}</li>`).join('') || '<li>None identified</li>'}</ul>
          </div>
          <div class="evidence-section">
            <h4>Key Challenges</h4>
            <ul class="compact-list">${challenges.slice(0, 4).map(c => `<li>${this.escape(c)}</li>`).join('') || '<li>None identified</li>'}</ul>
          </div>
        </div>
      </div>
    `;
    
    // DETAILED VIEW
    const awardedPatents = formatted.awardedPatents || patentTable.awardedPatents || [];
    const pendingPatents = formatted.pendingPatents || patentTable.patentApplications || [];
    const totalPatents = awardedPatents.length + pendingPatents.length;
    
    const detailedHTML = `
      <div class="evidence-content">
        <div class="evidence-section">
          <h4>Patent Landscape</h4>
          <div class="metrics-row compact">
            <div class="metric-card small">
              <span class="metric-label">Total Patents</span>
              <span class="metric-value">${totalPatents || relevantPatents.length || '-'}</span>
            </div>
            <div class="metric-card small">
              <span class="metric-label">Awarded</span>
              <span class="metric-value">${awardedPatents.length || '-'}</span>
            </div>
            <div class="metric-card small">
              <span class="metric-label">Pending</span>
              <span class="metric-value">${pendingPatents.length || '-'}</span>
            </div>
          </div>
        </div>
        
        ${topOwners.length > 0 ? `
          <div class="evidence-section">
            <h4>Top Patent Holders</h4>
            <div class="patent-owners-list">
              ${topOwners.slice(0, 6).map(o => `
                <div class="patent-owner">
                  <span class="owner-name">${this.escape(o.assignee)}</span>
                  <span class="owner-count">${o.patentCount} patents</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        ${relevantPatents.length > 0 ? `
          <div class="evidence-section">
            <h4>Key Relevant Patents</h4>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Patent ID</th>
                  <th>Title</th>
                  <th>Assignee</th>
                </tr>
              </thead>
              <tbody>
                ${relevantPatents.map(p => `
                  <tr>
                    <td>${p.link ? `<a href="${this.escape(this.cleanSourceUrl(p.link))}" target="_blank" rel="noopener">${this.escape(p.id || p.patentID)}</a>` : this.escape(p.id || p.patentID)}</td>
                    <td>${this.escape(this.truncate(p.title, 50))}</td>
                    <td>${this.escape(p.assignee)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div class="evidence-section"><h4>Key Relevant Patents</h4><p>No relevant patents identified.</p></div>'}
        
        ${crowdedFeatures.length > 0 ? `
          <div class="evidence-section">
            <h4>Crowded Patent Areas</h4>
            <ul>${crowdedFeatures.map(f => `<li>${this.escape(f)}</li>`).join('')}</ul>
          </div>
        ` : ''}
      </div>
    `;
    
    // SOURCES VIEW
    const patentSources = relevantPatents.filter(p => p.link).map(p => ({
      id: p.id || p.patentID,
      link: p.link
    }));
    
    const sourcesHTML = `
      <div class="evidence-content">
        <div class="evidence-section">
          <h4>Patent Sources</h4>
          ${patentSources.length > 0 ? `
            <ul class="source-list">
              ${patentSources.map(p => `
                <li>
                  <strong>${this.escape(p.id)}</strong>: 
                  <a href="${this.escape(this.cleanSourceUrl(p.link))}" target="_blank" rel="noopener">Google Patents</a>
                </li>
              `).join('')}
            </ul>
          ` : '<p>No patent sources available.</p>'}
        </div>
        
        ${topOwners.length > 0 ? `
          <div class="evidence-section">
            <h4>Major Patent Holders</h4>
            <div class="litigator-list">
              ${topOwners.slice(0, 8).map(o => `<span class="litigator-badge">${this.escape(o.assignee)} (${o.patentCount})</span>`).join('')}
            </div>
          </div>
        ` : ''}
        
        <div class="evidence-section">
          <h4>Rubric Alignment</h4>
          <div class="rubric-explanation">${this.formatRationale(data?.rubricDescription || '')}</div>
        </div>
        <div class="evidence-section">
          <h4>Confidence Note</h4>
          <p><strong>${confidence || '-'}</strong> confidence level.</p>
          <p>${this.escape(confidenceJustification || 'No additional confidence information.')}</p>
        </div>
      </div>
    `;
    
    container.innerHTML = summaryHTML;
    container.dataset.summary = summaryHTML;
    container.dataset.detailed = detailedHTML;
    container.dataset.sources = sourcesHTML;
  }

  // ========== EXPORT DATA ==========
  
  getExportData() {
    const getDimensionExport = (dim) => {
      const userScore = this.userScores[dim];
      return {
        ...(this.data[dim] || {}),
        aiScore: this.aiScores[dim],
        userScore: userScore.submitted ? userScore.score : null,
        userJustification: (userScore.submitted && userScore.justification) ? userScore.justification : null,
        isSubmitted: userScore.submitted
      };
    };

    // Get final recommendation from state manager
    const finalRecommendation = window.app?.stateManager?.getFinalRecommendation() || '';

    return {
      company: this.data.company,
      team: getDimensionExport('team'),
      funding: getDimensionExport('funding'),
      competitive: getDimensionExport('competitive'),
      market: getDimensionExport('market'),
      iprisk: getDimensionExport('iprisk'),
      finalRecommendation: finalRecommendation || null
    };
  }

  // ========== UTILITY METHODS ==========
  
  escape(str) {
    if (!str) return '';
    // Comprehensive HTML entity escaping to prevent XSS
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .replace(/`/g, '&#x60;');
  }

  // Format rationale text - handle bullets and newlines
  formatRationale(text) {
    if (!text) return 'No rationale provided.';
    // Convert markdown-style bullets and newlines to HTML
    let formatted = this.escape(text);
    // Handle bullet points (- or •)
    formatted = formatted.replace(/^[-•]\s*/gm, '</p><p>• ');
    // Handle numbered lists
    formatted = formatted.replace(/^\d+\.\s*/gm, '</p><p>• ');
    // Handle newlines
    formatted = formatted.replace(/\\n/g, '</p><p>');
    formatted = formatted.replace(/\n/g, '</p><p>');
    // Clean up empty paragraphs
    formatted = formatted.replace(/<p><\/p>/g, '');
    formatted = formatted.replace(/^<\/p>/, '');
    return `<p>${formatted}</p>`.replace(/<p>\s*<\/p>/g, '');
  }

  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  /**
   * Clean source URLs by removing citation reference suffixes like [%5E26563.0.0] or [^26563.0.0]
   * These appear at the end of some source URLs from the API
   * @param {string} url - The URL to clean
   * @returns {string} - Cleaned URL
   */
  cleanSourceUrl(url) {
    if (!url) return '';
    // Remove patterns like [%5E26563.0.0] or [^26563.0.0] or __[%5E8551.0.0]__ from end of URL
    // %5E is URL-encoded ^
    return String(url)
      .replace(/_*\[%5E[\d.]+\]_*$/i, '')
      .replace(/_*\[\^[\d.]+\]_*$/i, '')
      .replace(/\[%5E[\d.]+\]$/i, '')
      .replace(/\[\^[\d.]+\]$/i, '');
  }

  displayUrl(url) {
    if (!url) return '';
    const cleanUrl = this.cleanSourceUrl(url);
    try {
      const parsed = new URL(cleanUrl);
      return parsed.hostname.replace('www.', '');
    } catch {
      return cleanUrl;
    }
  }

  truncateUrl(url) {
    if (!url) return '';
    const cleanUrl = this.cleanSourceUrl(url);
    try {
      const parsed = new URL(cleanUrl);
      const path = parsed.pathname.length > 30 ? parsed.pathname.slice(0, 30) + '...' : parsed.pathname;
      return parsed.hostname.replace('www.', '') + path;
    } catch {
      return cleanUrl.length > 50 ? cleanUrl.slice(0, 50) + '...' : cleanUrl;
    }
  }

  truncate(str, maxLen) {
    if (!str) return '';
    return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
  }

  formatDate(dateStr) {
    if (!dateStr) return '-';
    // Handle formats like "2024-02-28" or "2025-04"
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[parseInt(parts[1]) - 1] || parts[1];
      return `${month} ${parts[0]}`;
    }
    return dateStr;
  }

  formatCurrency(value) {
    if (!value && value !== 0) return '-';
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num)) return value;
    
    if (num >= 1e12) return '$' + (num / 1e12).toFixed(1) + 'T';
    if (num >= 1e9) return '$' + (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return '$' + (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return '$' + (num / 1e3).toFixed(0) + 'K';
    return '$' + num.toFixed(0);
  }

  formatCurrencyWithCommas(valueInMillions, includeDecimals = true) {
    if (!valueInMillions && valueInMillions !== 0) return '-';
    const num = typeof valueInMillions === 'number' ? valueInMillions : parseFloat(valueInMillions);
    if (isNaN(num)) return String(valueInMillions);
    
    // If it's less than 1 million dollars (value < 1 when expressed in millions)
    // Display as actual dollar amount with commas
    if (num < 1 && num > 0) {
      const dollars = Math.round(num * 1000000);
      return '$' + dollars.toLocaleString('en-US');
    }
    
    // For values >= 1000 million (i.e., >= 1 billion)
    if (num >= 1000) {
      // Billions - remove trailing .0 if whole number
      const billionValue = num / 1000;
      if (billionValue % 1 === 0) {
        return '$' + billionValue.toFixed(0) + 'B';
      }
      return '$' + billionValue.toFixed(1) + 'B';
    } else if (num >= 1) {
      // Millions - remove trailing .0 if whole number
      if (num % 1 === 0) {
        return '$' + num.toFixed(0) + 'M';
      }
      const formatted = includeDecimals ? num.toFixed(1) : num.toFixed(0);
      return '$' + formatted + 'M';
    } else if (num === 0) {
      return '$0';
    }
    
    // Fallback for any edge cases
    return '$' + num.toFixed(1) + 'M';
  }

  /**
   * Parse a funding amount from various formats and return value in millions
   * Handles: numbers (assumed millions), strings like "$10M", "10 million", "1.5B", "$1,500,000"
   * @param {number|string} amount - The amount to parse
   * @returns {number|null} - Amount in millions, or null if unparseable
   */
  parseFundingAmount(amount) {
    if (amount === null || amount === undefined || amount === '' || 
        amount === 'undisclosed' || amount === 'Undisclosed' || amount === 'Unknown') {
      return null;
    }
    
    // If it's already a number, assume it's in millions (API convention)
    if (typeof amount === 'number') {
      return amount;
    }
    
    const amountStr = String(amount).toLowerCase().trim();
    
    // Extract numeric value
    const numMatch = amountStr.match(/[\d,.]+/);
    if (!numMatch) return null;
    
    const num = parseFloat(numMatch[0].replace(/,/g, ''));
    if (isNaN(num)) return null;
    
    // Determine the unit and convert to millions
    if (amountStr.includes('billion') || amountStr.includes('bn') || 
        (amountStr.includes('b') && !amountStr.includes('m'))) {
      return num * 1000; // Convert billions to millions
    } else if (amountStr.includes('million') || amountStr.includes('mn') || amountStr.includes('m')) {
      return num; // Already in millions
    } else if (amountStr.includes('thousand') || amountStr.includes('k')) {
      return num / 1000; // Convert thousands to millions
    } else if (num >= 1000000) {
      // Large number without unit - assume raw dollars
      return num / 1000000;
    } else if (num >= 1000) {
      // Could be thousands of dollars or raw millions - context dependent
      // If it has $ sign and is over 1000, likely raw dollars in thousands format
      if (amountStr.includes('$')) {
        return num / 1000000; // Treat as raw dollars
      }
      // Otherwise assume it's already in millions (API data)
      return num;
    } else {
      // Small number - assume already in millions
      return num;
    }
  }

  formatIntensity(value) {
    if (!value && value !== 0) return '-';
    const v = String(value).toLowerCase();
    if (v === 'high') return 'High';
    if (v === 'medium' || v === 'moderate') return 'Moderate';
    if (v === 'low') return 'Low';
    if (typeof value === 'number') {
      if (value <= 2) return 'Very Low';
      if (value <= 4) return 'Low';
      if (value <= 6) return 'Moderate';
      if (value <= 8) return 'High';
      return 'Very High';
    }
    return this.capitalize(value);
  }
}

window.AssessmentView = AssessmentView;
