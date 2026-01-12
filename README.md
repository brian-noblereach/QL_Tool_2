# NobleReach Venture Assessment Platform (Qualification Tool v02)

## Overview

The Venture Assessment Platform is an internal tool for NobleReach Foundation's Science-to-Venture (S2V) team. It automates the initial qualification of deep-tech ventures by analyzing companies across five key dimensions: Team, Funding, Competitive Landscape, Market Opportunity, and IP Risk.

**Key Value Proposition**: Reduces venture due diligence time from weeks to minutes by leveraging AI-powered analysis through Stack AI workflows.

---

## How to Use

### Basic Workflow

1. **Open the Application**
   - Navigate to `index.html` in a web browser
   - Works best on Chrome or Edge (requires modern JavaScript features)

2. **Enter Venture Information**
   - **Company URL**: Enter the venture's website (e.g., `https://example.com`)
   - **SCA Name**: (Optional) Enter the Science Commercialization Advisor's name
   - **Document Upload**: (Optional) Upload a pitch deck or company document (PDF, DOC, DOCX)

3. **Start Analysis**
   - Click "Analyze Venture" to begin
   - Company analysis runs first (~2-4 minutes)
   - Remaining analyses (Team, Funding, Competitive, Market, IP Risk) run in parallel (~5-8 minutes total)

4. **Review Results**
   - **Overview Tab**: Company summary, technology, products, market context
   - **Assessment Tabs**: Each dimension shows AI analysis, evidence, and scoring
   - **Summary Tab**: Aggregate scores and export options

5. **Provide Human Assessment**
   - Adjust the score slider based on your evaluation
   - Add justification notes
   - Click "Submit Assessment" to record your score

6. **Export Report**
   - Click "Export PDF" to generate a comprehensive report
   - All scores are saved to Smartsheet for tracking

---

## Architecture

### High-Level Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Browser UI    │────▶│  Stack AI APIs  │────▶│  AI Workflows   │
│  (index.html)   │     │  (Direct Calls) │     │  (6 workflows)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                                               │
         │              ┌─────────────────┐              │
         └─────────────▶│ Google Apps     │◀─────────────┘
                        │ Script Proxy    │
                        │ (File uploads,  │
                        │  Smartsheet)    │
                        └─────────────────┘
                                 │
                        ┌─────────────────┐
                        │   Smartsheet    │
                        │   (Score DB)    │
                        └─────────────────┘
```

### Why This Architecture?

**Problem**: Google Apps Script has a 6-minute execution timeout, but Stack AI workflows take 7-8 minutes.

**Solution**: Browser makes direct calls to Stack AI for inference (no timeout limit). Google Apps Script proxy is only used for:
1. Providing API credentials (config endpoint)
2. File uploads (requires private key)
3. Smartsheet integration (score persistence)

---

## Technical Implementation

### File Structure

```
Qualification Tool v02/
├── index.html                    # Main UI - single page application
├── README.md                     # This file
├── css/
│   └── styles.css                # NobleReach brand styling
├── js/
│   ├── api/                      # API integrations
│   │   ├── stack-proxy.js        # Stack AI proxy client (MAIN)
│   │   ├── company.js            # Company analysis API
│   │   ├── team.js               # Team analysis API
│   │   ├── funding.js            # Funding analysis API
│   │   ├── competitive.js        # Competitive analysis API
│   │   ├── market.js             # Market analysis API
│   │   └── iprisk.js             # IP Risk analysis API
│   ├── components/               # UI components
│   │   ├── assessment-view.js    # Main results display
│   │   ├── tab-manager.js        # Tab state management
│   │   ├── toast-manager.js      # Notifications
│   │   ├── modal-manager.js      # Dialogs
│   │   ├── progress-view.js      # Progress tracking
│   │   └── summary-view.js       # Summary panel
│   ├── core/                     # Application core
│   │   ├── app.js                # Main controller
│   │   ├── pipeline.js           # Analysis orchestration
│   │   └── state-manager.js      # localStorage persistence
│   └── utils/                    # Utilities
│       ├── validators.js         # Data validation
│       ├── formatters.js         # Display formatting
│       ├── smartsheet.js         # Smartsheet integration
│       └── export.js             # PDF export
├── proxy-update/                 # Google Apps Script code
│   └── Code.gs                   # Deploy this to Apps Script
└── assets/
    ├── favicon.svg               # NobleReach icon
    └── logo-icon.svg             # NobleReach logo
```

### Key Components

#### 1. Stack Proxy (`js/api/stack-proxy.js`)

The central API client that handles all Stack AI communication.

**Configuration:**
```javascript
const STACK_CONFIG = {
  ORG_ID: 'f913a8b8-144d-47e0-b327-8daa341b575d',
  PUBLIC_KEY: 'e80f3814-a651-4de7-a7ba-8478b7a9047b',
  PRIVATE_KEY: '139c4395-8ab3-4a5a-b52b-6ce1b52f7b97',  // For file uploads only
  workflows: {
    company_url: '694c385d4f9d789570304dd5',
    company_file: '6949ba538f9ce68c9b8b841a',
    company_both: '6945b566ba9cfba7e5c6fabb',
    team: '6949b0045ea7002afda5c979',
    funding: '68f0020d7a00704c92fdd7b5',
    competitive: '686d72045c56d3a93d5f7b68',
    market: '68a8bc5d5f2ffcec5ada4422',
    iprisk: '68d45d1f4c0213053bf91862'
  }
};
```

**Methods:**
- `init()` - Initializes with fallback config (no proxy needed for inference)
- `call(workflow, payload, signal)` - Direct call to Stack AI inference
- `callWithFile(workflow, file, url, signal)` - Upload file via proxy, then call inference

#### 2. Company API (`js/api/company.js`)

Handles company analysis and returns structured data.

**Input**: URL, File, or both
**Output**: `{ full: {...}, short: "..." }`
- `full`: Complete company data following `venture-extraction-schema`
- `short`: Text summary for passing to subsequent APIs

**Schema (venture-extraction-schema):**
```javascript
{
  company_overview: {
    name, website, founded_year, headquarters,
    company_stage, employee_count, mission_statement, company_description
  },
  technology: {
    core_technology, technology_category, technical_approach,
    key_innovations: [], intellectual_property: {...}
  },
  products_and_applications: {
    primary_application, products: [], use_cases: [], target_industries: []
  },
  team: {
    founders: [], key_executives: [], advisors: []
  },
  funding_and_investors: {
    total_funding, funding_rounds: [], government_grants: []
  },
  traction_and_metrics: {
    customers: {...}, revenue, growth_metrics, partnerships: [], achievements: []
  },
  recent_activity: {
    last_12_months: [], upcoming_milestones: []
  },
  market_context: {
    industry, sub_sector, problem_addressed, value_proposition, business_model
  },
  data_quality_assessment: {
    extraction_date, primary_sources: [], information_completeness,
    missing_critical_information: [], data_freshness, confidence_notes
  }
}
```

#### 3. Pipeline (`js/core/pipeline.js`)

Orchestrates the analysis workflow.

**Flow:**
1. Company analysis runs first (required for other analyses)
2. Company returns `{ full, short }` - short description is stored
3. Team, Funding, Competitive, IP Risk run in parallel using short description
4. Market analysis runs after Competitive completes (dependency)

**Events emitted:**
- `start` - Analysis begun
- `phaseStart` - Individual phase started
- `phaseComplete` - Phase finished with data
- `phaseError` - Phase failed
- `overviewReady` - Company data ready (triggers UI switch)
- `complete` - All phases done
- `partialComplete` - Some phases failed

#### 4. Assessment View (`js/components/assessment-view.js`)

Displays results and captures user scores.

**Data loading methods:**
- `loadCompanyData(data)` - Renders Overview tab
- `loadTeamData(data)` - Renders Team tab with scores
- `loadFundingData(data)` - Renders Funding tab
- `loadCompetitiveData(data)` - Renders Competitive tab
- `loadMarketData(data)` - Renders Market tab
- `loadIpRiskData(data)` - Renders IP Risk tab

**View modes per tab:**
- Summary: Key metrics and AI rationale
- Detailed: Expandable sections with full data
- Sources: Links and confidence information

#### 5. Google Apps Script Proxy (`proxy-update/Code.gs`)

Deployed as a Google Apps Script Web App.

**Endpoints:**
- `GET ?action=config` - Returns Stack AI credentials
- `GET ?data={...}` - Smartsheet submission (JSONP supported)
- `POST` with `data` field - File upload or Smartsheet

**Smartsheet Configuration:**
```javascript
const SMARTSHEET_API_TOKEN = 'V6FMYwqs4HmfLld5GH7LGxbHNMfVMXU2vywIp';
const SMARTSHEET_SHEET_ID = '1124748705982348';
const SMARTSHEET_API_BASE = 'https://api.smartsheetgov.com/2.0';
```

---

## Stack AI Workflows

### Workflow Details

| Workflow | ID | Input | Output |
|----------|-------|-------|--------|
| Company (URL) | `694c385d4f9d789570304dd5` | `in-0`: URL | `out-6`: Full JSON, `out-7`: Short text |
| Company (File) | `6949ba538f9ce68c9b8b841a` | File at `doc-0` | `out-6`: Full JSON, `out-7`: Short text |
| Company (Both) | `6945b566ba9cfba7e5c6fabb` | URL + File | `out-6`: Full JSON, `out-7`: Short text |
| Team | `6949b0045ea7002afda5c979` | `in-0`: Company description | Team analysis + score |
| Funding | `68f0020d7a00704c92fdd7b5` | `in-0`: Company description | Funding analysis + score |
| Competitive | `686d72045c56d3a93d5f7b68` | `in-0`: Company description | Competitive analysis + score |
| Market | `68a8bc5d5f2ffcec5ada4422` | `in-0`: Company desc, `in-1`: Competitive output | Market analysis + score |
| IP Risk | `68d45d1f4c0213053bf91862` | `in-0`: Company description | IP Risk analysis + score |

### API Call Format

```javascript
// Direct call to Stack AI
const response = await fetch(
  `https://api.stack-ai.com/inference/v0/run/${ORG_ID}/${WORKFLOW_ID}`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PUBLIC_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      'user_id': `unique_id_${Date.now()}`,
      'in-0': inputValue
    })
  }
);

const data = await response.json();
// data.outputs['out-6'] = full output
// data.outputs['out-7'] = short output (if applicable)
```

---

## Known Issues & Troubleshooting

### Current Issues

1. **Smartsheet Integration (CORS)**: Submitting scores to Smartsheet is experiencing CORS issues. The current implementation tries JSONP and image beacon fallbacks, but may not be reaching the Google Apps Script. Further debugging needed.

### Common Problems

| Issue | Cause | Solution |
|-------|-------|----------|
| "Company API timeout" | Stack AI taking >10 min | Check Stack AI dashboard for errors |
| Blank Overview tab | Data structure mismatch | Check console for parsing errors |
| "No data provided" in Apps Script | JSON parsing failed | Verify data encoding |
| File upload fails | Private key issue | Redeploy Code.gs |
| Scores not saving | CORS/proxy issue | Check Apps Script executions |

### Debugging Steps

1. **Check Browser Console**: Look for `[CompanyAPI]`, `[StackProxy]`, `[Smartsheet]` logs
2. **Check Network Tab**: Verify requests to `api.stack-ai.com` succeed
3. **Check Apps Script Executions**: Go to Apps Script project > Executions
4. **Check Stack AI Dashboard**: Verify workflow runs and outputs

---

## Deployment

### Deploying the Web App

1. Host files on any static web server (GitHub Pages, SharePoint, etc.)
2. No build process required - vanilla JavaScript

### Deploying Google Apps Script

1. Go to [script.google.com](https://script.google.com)
2. Create new project or open existing
3. Replace `Code.gs` content with `proxy-update/Code.gs`
4. Click **Deploy** > **New deployment**
5. Choose **Web app**
6. Set **Execute as**: Me
7. Set **Who has access**: Anyone
8. Click **Deploy** and copy the URL
9. Update `proxyUrl` in `stack-proxy.js` and `smartsheet.js` if URL changed

**Current Deployment URL:**
```
https://script.google.com/macros/s/AKfycbzt7wE1vzQv0CNs-icg7QWpxjf4E5F_HLTpnn8GJa2W/exec
```

---

## Development Notes

### Adding a New Analysis Dimension

1. Create `js/api/newdimension.js` following pattern of other API files
2. Add workflow ID to `STACK_WORKFLOWS` in `stack-proxy.js` and `Code.gs`
3. Add phase to `pipeline.js` phases array
4. Add `loadNewDimensionData()` method to `assessment-view.js`
5. Add tab HTML to `index.html`
6. Add column IDs to Smartsheet config in `Code.gs`

### Modifying the Company Schema

If Stack AI output schema changes:
1. Update `ensureStructure()` in `company.js`
2. Update `validateCompany()` in `validators.js`
3. Update `loadCompanyData()` in `assessment-view.js`

### CORS Considerations

- **Stack AI inference**: Allows CORS - call directly from browser
- **Stack AI file upload**: Requires private key - must go through proxy
- **Smartsheet**: Requires API token - must go through proxy
- **Google Apps Script**: Returns redirects that break CORS - use JSONP or iframe

---

## Brand Guidelines

### Colors
```css
--nr-navy-1: #1D295B;      /* Headers, primary text */
--nr-teal-1: #0082A5;      /* Buttons, links, accents */
--nr-purple-2: #6D68E7;    /* Highlights, secondary actions */
--nr-light-blue-1: #00C8EB; /* Progress bars */
--nr-green-1: #5CE042;      /* Success states */
--nr-orange-1: #FF5100;     /* Warnings, pilot banner */
```

### Fonts
- **Body**: General Sans (Google Fonts)
- **Headings**: Clash Display (Google Fonts)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | Jan 2026 | Direct browser-to-Stack AI calls, eliminated timeout issues |
| 1.5 | Dec 2025 | File upload support, venture-extraction-schema |
| 1.0 | Nov 2025 | Initial release with Google Apps Script proxy |

---

## Support

For issues or questions:
- **Technical**: Check browser console and Apps Script executions
- **Stack AI**: Contact Stack AI support or check workflow configuration
- **Feature Requests**: Document in project backlog

---

## License

Internal use only - NobleReach Foundation
