# NobleReach Venture Assessment Platform

An AI-powered due diligence tool for evaluating deep-tech ventures across five key dimensions.

![Version](https://img.shields.io/badge/version-2.1-blue)
![Status](https://img.shields.io/badge/status-pilot-orange)

---

## Overview

The Venture Assessment Platform automates initial qualification of deep-tech ventures for NobleReach Foundation's Science-to-Venture (S2V) team. It leverages AI workflows to analyze companies and generate structured assessments, reducing due diligence time from weeks to minutes.

### Key Features

- **Multi-source Analysis**: Analyze ventures using website URLs, uploaded documents (PDF/Word), or both
- **Five Assessment Dimensions**: Team, Funding, Competitive Landscape, Market Opportunity, IP Risk
- **AI-Powered Scoring**: Each dimension receives an AI-generated score with detailed evidence
- **Human-in-the-Loop**: Advisors review AI analysis and provide their own scores with justifications
- **Score Persistence**: All scores saved to Smartsheet for tracking and comparison
- **PDF Export**: Generate comprehensive assessment reports
- **Load Previous**: Reload past assessments for review or score updates
- **Progress Recovery**: Resume interrupted analyses from checkpoints

---

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Browser   │────▶│    Stack AI     │────▶│  AI Workflows   │
│    (Client)     │     │   (Inference)   │     │  (6 workflows)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                                               
         │              ┌─────────────────┐              
         └─────────────▶│  Google Apps    │              
                        │  Script Proxy   │              
                        └────────┬────────┘              
                                 │                       
                        ┌────────▼────────┐              
                        │   Smartsheet    │              
                        │   (Score DB)    │              
                        └─────────────────┘              
```

1. **Input**: Enter a company URL and/or upload a document
2. **Analysis**: AI workflows extract company data and evaluate each dimension
3. **Review**: Browse results across tabs with summary, detailed, and source views
4. **Score**: Adjust scores and add justifications based on your expertise
5. **Export**: Generate PDF reports and save scores to the database

---

## Architecture

### File Structure

```
Qualification Tool v02/
├── index.html              # Single-page application
├── css/
│   └── styles.css          # NobleReach brand styling
├── js/
│   ├── api/                # Stack AI integrations
│   ├── components/         # UI components
│   ├── core/               # Application logic
│   └── utils/              # Utilities & integrations
├── proxy-update/
│   └── Code.gs             # Google Apps Script proxy
└── assets/                 # Icons and logos
```

### Technology Stack

- **Frontend**: Vanilla JavaScript (no framework dependencies)
- **AI Backend**: Stack AI workflows
- **Database**: Smartsheet (via Google Apps Script proxy)
- **Export**: jsPDF for PDF generation

---

## Deployment

### Web Application

Host the files on any static web server:
- GitHub Pages
- SharePoint
- Any HTTP server

No build process required.

### Google Apps Script Proxy

1. Create a new project at [script.google.com](https://script.google.com)
2. Copy contents of `proxy-update/Code.gs`
3. Deploy as Web App with "Anyone" access
4. Update proxy URL in JavaScript files if needed

---

## Configuration

### Stack AI Workflows

| Workflow | Purpose |
|----------|---------|
| Company (URL/File/Both) | Extract structured company data |
| Team | Evaluate founding team and leadership |
| Funding | Analyze funding history and runway |
| Competitive | Assess competitive landscape and risks |
| Market | Evaluate market opportunity and timing |
| IP Risk | Analyze intellectual property position |

### Smartsheet Integration

Scores are automatically saved to Smartsheet with:
- Venture name and URL
- Advisor name and portfolio
- AI scores and user scores for each dimension
- Justification notes
- Timestamps

---

## Usage

### Basic Workflow

1. Open `index.html` in a modern browser (Chrome/Edge recommended)
2. Enter the venture's website URL
3. Optionally upload a pitch deck or company document
4. Enter your name and select portfolio
5. Click **Start Assessment**
6. Review AI analysis across each tab
7. Adjust scores and add justifications
8. Click **Export PDF** to generate report

### Loading Previous Assessments

1. Click **Load Previous** on the start screen
2. Search or select from the list of past assessments
3. Full assessments restore all AI evidence and scores
4. Score-only assessments can be updated or re-analyzed

---

## Development

### Adding New Dimensions

1. Create API file in `js/api/`
2. Add workflow ID to configurations
3. Add phase to pipeline orchestration
4. Create data loader in assessment view
5. Add tab HTML and styling

### Modifying AI Outputs

If Stack AI schema changes:
1. Update data parsing in relevant API file
2. Update validators if needed
3. Update assessment view rendering

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.1 | Jan 2026 | Load Previous assessments, Smartsheet row updates, assessment caching |
| 2.0 | Jan 2026 | Direct browser-to-Stack AI calls, timeout elimination |
| 1.5 | Dec 2025 | File upload support, structured extraction schema |
| 1.0 | Nov 2025 | Initial release |

---

## Support

- **Technical Issues**: Check browser console for detailed logs
- **Stack AI**: Verify workflow configuration in Stack AI dashboard
- **Proxy Issues**: Check Google Apps Script execution logs

---

## License

Internal use only — NobleReach Foundation
