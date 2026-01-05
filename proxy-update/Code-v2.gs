// Venture Assessment Platform - API Proxy v5 (Simplified)
// Purpose: Securely provide API credentials to browser
// The browser makes direct calls to Stack AI, avoiding Google Script timeout limits

// ============================================
// CONFIGURATION (Keep these secret!)
// ============================================

// Stack AI Configuration
const STACK_AI_ORG_ID = 'f913a8b8-144d-47e0-b327-8daa341b575d';
const STACK_AI_PUBLIC_KEY = 'e80f3814-a651-4de7-a7ba-8478b7a9047b';
const STACK_AI_PRIVATE_KEY = '139c4395-8ab3-4a5a-b52b-6ce1b52f7b97';

// Stack AI Workflow IDs
const STACK_WORKFLOWS = {
  company_url: '694c385d4f9d789570304dd5',
  company_file: '6949ba538f9ce68c9b8b841a',
  company_both: '6945b566ba9cfba7e5c6fabb',
  team: '6949b0045ea7002afda5c979',
  funding: '68f0020d7a00704c92fdd7b5',
  competitive: '686d72045c56d3a93d5f7b68',
  market: '68a8bc5d5f2ffcec5ada4422',
  iprisk: '68d45d1f4c0213053bf91862'
};

// Smartsheet Configuration
const SMARTSHEET_API_TOKEN = 'V6FMYwqs4HmfLld5GH7LGxbHNMfVMXU2vywIp';
const SMARTSHEET_SHEET_ID = '1124748705982348';
const SMARTSHEET_API_BASE = 'https://api.smartsheetgov.com/2.0';

// Smartsheet Column IDs
const COLUMNS = {
  submissionId: 1410020169541508,
  timestamp: 5913619796912004,
  ventureName: 3661819983226756,
  ventureUrl: 8165419610597252,
  advisorName: 847070216120196,
  portfolio: 5350669843490692,
  teamScoreAi: 3098870029805444,
  teamScoreUser: 7602469657175940,
  teamJustification: 1972970122962820,
  fundingScoreAi: 6476569750333316,
  fundingScoreUser: 4224769936648068,
  fundingJustification: 8728369564018564,
  competitiveScoreAi: 143382774343556,
  competitiveScoreUser: 4646982401714052,
  competitiveJustification: 2395182588028804,
  marketScoreAi: 6898782215399300,
  marketScoreUser: 1269282681186180,
  marketJustification: 5772882308556676,
  ipRiskScoreAi: 3521082494871428,
  ipRiskScoreUser: 8024682122241924,
  ipRiskJustification: 706332727764868,
  averageAiScore: 5209932355135364,
  averageUserScore: 2958132541450116
};

// Allowed origins (add your GitHub Pages URL)
const ALLOWED_ORIGINS = [
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'https://noblereach.github.io',
  // Add more as needed
];

// ============================================
// MAIN HANDLERS
// ============================================

/**
 * Handle GET requests - returns API config for browser to use
 */
function doGet(e) {
  const origin = e?.parameter?.origin || '*';
  
  try {
    const action = e?.parameter?.action;
    
    if (action === 'config') {
      // Return Stack AI configuration for browser to make direct calls
      return jsonResponse({
        success: true,
        config: {
          baseUrl: 'https://api.stack-ai.com/inference/v0/run/' + STACK_AI_ORG_ID,
          docsUrl: 'https://api.stack-ai.com/documents/' + STACK_AI_ORG_ID,
          publicKey: STACK_AI_PUBLIC_KEY,
          privateKey: STACK_AI_PRIVATE_KEY, // Needed for file uploads
          workflows: STACK_WORKFLOWS
        }
      }, origin);
    }
    
    // Default: return status
    return jsonResponse({
      status: 'ok',
      message: 'Venture Assessment Proxy v5 (Simplified)',
      version: '5.0',
      endpoints: ['config', 'smartsheet', 'upload_file'],
      timestamp: new Date().toISOString()
    }, origin);
    
  } catch (error) {
    console.error('Error in doGet:', error);
    return jsonResponse({ success: false, error: error.message }, origin);
  }
}

/**
 * Handle POST requests - for Smartsheet and file uploads only
 */
function doPost(e) {
  const origin = e?.parameter?.origin || '*';
  
  try {
    let data;
    
    // Parse request data
    if (e.parameter && e.parameter.data) {
      data = JSON.parse(e.parameter.data);
    } else if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else {
      return jsonResponse({ success: false, error: 'No data provided' }, origin);
    }
    
    const action = data.action || 'smartsheet';
    
    switch (action) {
      case 'smartsheet':
        return handleSmartsheetSubmission(data, origin);
        
      case 'upload_file':
        // Handle file upload to Stack AI (requires private key)
        return handleFileUpload(data, origin);
        
      default:
        if (data.ventureName) {
          return handleSmartsheetSubmission(data, origin);
        }
        return jsonResponse({ success: false, error: 'Unknown action: ' + action }, origin);
    }
    
  } catch (error) {
    console.error('Error in doPost:', error);
    return jsonResponse({ success: false, error: error.message }, origin);
  }
}

// ============================================
// FILE UPLOAD HANDLING
// ============================================

/**
 * Handle file upload to Stack AI
 * This is the only Stack AI operation that needs to go through the proxy
 * because it requires the private key
 */
function handleFileUpload(data, origin) {
  const workflow = data.workflow;
  const userId = data.userId || 'qual_tool_' + Date.now();
  const fileName = data.fileName;
  const fileBase64 = data.fileBase64;
  const mimeType = data.mimeType || 'application/pdf';
  
  if (!workflow || !STACK_WORKFLOWS[workflow]) {
    return jsonResponse({ success: false, error: 'Invalid workflow: ' + workflow }, origin);
  }
  
  if (!fileName || !fileBase64) {
    return jsonResponse({ success: false, error: 'Missing fileName or fileBase64' }, origin);
  }
  
  const flowId = STACK_WORKFLOWS[workflow];
  const nodeId = 'doc-0';
  
  console.log(`File upload for workflow: ${workflow}, flowId: ${flowId}, userId: ${userId}`);
  
  try {
    // Step 1: Clear existing files
    clearExistingFiles(flowId, nodeId, userId);
    
    // Step 2: Upload new file
    const uploadResult = uploadFile(flowId, nodeId, userId, fileName, fileBase64, mimeType);
    
    if (!uploadResult.success) {
      return jsonResponse({ success: false, error: 'Upload failed: ' + uploadResult.error }, origin);
    }
    
    // Step 3: Return success - browser will make the inference call directly
    return jsonResponse({
      success: true,
      message: 'File uploaded successfully',
      userId: userId,
      fileName: fileName,
      workflow: workflow,
      flowId: flowId
    }, origin);
    
  } catch (error) {
    console.error('File upload failed:', error);
    return jsonResponse({ success: false, error: error.message }, origin);
  }
}

/**
 * Clear existing files for a user
 */
function clearExistingFiles(flowId, nodeId, userId) {
  const url = `https://api.stack-ai.com/documents/${STACK_AI_ORG_ID}/${flowId}/${nodeId}/${userId}`;
  
  try {
    const listResponse = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${STACK_AI_PRIVATE_KEY}`,
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    });
    
    if (listResponse.getResponseCode() !== 200) {
      console.log('No existing files to clear');
      return { cleared: 0 };
    }
    
    const files = JSON.parse(listResponse.getContentText());
    
    if (!Array.isArray(files) || files.length === 0) {
      return { cleared: 0 };
    }
    
    let cleared = 0;
    for (const fileItem of files) {
      const filename = typeof fileItem === 'string' ? fileItem : fileItem.filename;
      if (filename) {
        UrlFetchApp.fetch(url + '?filename=' + encodeURIComponent(filename), {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${STACK_AI_PRIVATE_KEY}` },
          muteHttpExceptions: true
        });
        cleared++;
      }
    }
    
    return { cleared };
    
  } catch (error) {
    console.warn('Error clearing files:', error);
    return { cleared: 0, error: error.message };
  }
}

/**
 * Upload a file to Stack AI
 */
function uploadFile(flowId, nodeId, userId, fileName, fileBase64, mimeType) {
  const url = `https://api.stack-ai.com/documents/${STACK_AI_ORG_ID}/${flowId}/${nodeId}/${userId}`;
  
  try {
    const fileBytes = Utilities.base64Decode(fileBase64);
    const boundary = '----WebKitFormBoundary' + Utilities.getUuid().replace(/-/g, '');
    
    const requestBody = Utilities.newBlob(
      '--' + boundary + '\r\n' +
      'Content-Disposition: form-data; name="file"; filename="' + fileName + '"\r\n' +
      'Content-Type: ' + mimeType + '\r\n\r\n'
    ).getBytes()
    .concat(fileBytes)
    .concat(Utilities.newBlob('\r\n--' + boundary + '--\r\n').getBytes());
    
    const response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STACK_AI_PRIVATE_KEY}`,
        'Content-Type': 'multipart/form-data; boundary=' + boundary
      },
      payload: requestBody,
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() === 200) {
      const result = JSON.parse(response.getContentText());
      return {
        success: result.uploaded_file?.success || false,
        fileName: fileName
      };
    }
    
    return { success: false, error: 'Upload returned ' + response.getResponseCode() };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================
// SMARTSHEET HANDLING
// ============================================

function handleSmartsheetSubmission(data, origin) {
  if (!data.ventureName || !data.advisorName) {
    return jsonResponse({ error: 'Missing required fields' }, origin);
  }
  
  const existingRowId = findExistingRow(data.ventureName, data.advisorName);
  
  let result;
  if (existingRowId) {
    result = updateRow(existingRowId, data);
  } else {
    result = createRow(data);
  }
  
  return jsonResponse(result, origin);
}

function findExistingRow(ventureName, advisorName) {
  const url = `${SMARTSHEET_API_BASE}/sheets/${SMARTSHEET_SHEET_ID}`;
  
  const response = UrlFetchApp.fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${SMARTSHEET_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  });
  
  if (response.getResponseCode() !== 200) return null;
  
  const sheet = JSON.parse(response.getContentText());
  if (!sheet.rows) return null;
  
  for (const row of sheet.rows) {
    let rowVenture = null, rowAdvisor = null;
    
    for (const cell of row.cells) {
      if (cell.columnId === COLUMNS.ventureName) rowVenture = cell.value;
      if (cell.columnId === COLUMNS.advisorName) rowAdvisor = cell.value;
    }
    
    if (rowVenture === ventureName && rowAdvisor === advisorName) {
      return row.id;
    }
  }
  
  return null;
}

function createRow(data) {
  const url = `${SMARTSHEET_API_BASE}/sheets/${SMARTSHEET_SHEET_ID}/rows`;
  
  const response = UrlFetchApp.fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SMARTSHEET_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({ toBottom: true, cells: buildCells(data) }),
    muteHttpExceptions: true
  });
  
  const result = JSON.parse(response.getContentText());
  
  if (response.getResponseCode() === 200 && result.message === 'SUCCESS') {
    return { success: true, action: 'created', rowId: result.result.id };
  }
  
  throw new Error(result.message || 'Failed to create row');
}

function updateRow(rowId, data) {
  const url = `${SMARTSHEET_API_BASE}/sheets/${SMARTSHEET_SHEET_ID}/rows`;
  
  const response = UrlFetchApp.fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${SMARTSHEET_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({ id: rowId, cells: buildCells(data) }),
    muteHttpExceptions: true
  });
  
  const result = JSON.parse(response.getContentText());
  
  if (response.getResponseCode() === 200 && result.message === 'SUCCESS') {
    return { success: true, action: 'updated', rowId: result.result.id };
  }
  
  throw new Error(result.message || 'Failed to update row');
}

function buildCells(data) {
  const cells = [];
  const timestamp = new Date().toISOString();
  const submissionId = `${data.advisorName}-${data.ventureName}-${Date.now()}`.replace(/[^a-zA-Z0-9-]/g, '_');
  
  cells.push({ columnId: COLUMNS.submissionId, value: submissionId });
  cells.push({ columnId: COLUMNS.timestamp, value: timestamp });
  cells.push({ columnId: COLUMNS.ventureName, value: data.ventureName || '' });
  cells.push({ columnId: COLUMNS.ventureUrl, value: data.ventureUrl || '' });
  cells.push({ columnId: COLUMNS.advisorName, value: data.advisorName || '' });
  cells.push({ columnId: COLUMNS.portfolio, value: data.portfolio || '' });
  
  // Score fields
  const scoreFields = [
    ['team', 'teamScoreAi', 'teamScoreUser', 'teamJustification'],
    ['funding', 'fundingScoreAi', 'fundingScoreUser', 'fundingJustification'],
    ['competitive', 'competitiveScoreAi', 'competitiveScoreUser', 'competitiveJustification'],
    ['market', 'marketScoreAi', 'marketScoreUser', 'marketJustification'],
    ['ipRisk', 'ipRiskScoreAi', 'ipRiskScoreUser', 'ipRiskJustification']
  ];
  
  for (const [prefix, aiCol, userCol, justCol] of scoreFields) {
    if (data[aiCol] !== undefined) cells.push({ columnId: COLUMNS[aiCol], value: data[aiCol] });
    if (data[userCol] !== undefined) cells.push({ columnId: COLUMNS[userCol], value: data[userCol] });
    if (data[justCol] !== undefined) cells.push({ columnId: COLUMNS[justCol], value: data[justCol] });
  }
  
  if (data.averageAiScore !== undefined) cells.push({ columnId: COLUMNS.averageAiScore, value: data.averageAiScore });
  if (data.averageUserScore !== undefined) cells.push({ columnId: COLUMNS.averageUserScore, value: data.averageUserScore });
  
  return cells;
}

// ============================================
// UTILITIES
// ============================================

function jsonResponse(data, origin = '*') {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ============================================
// TEST FUNCTIONS
// ============================================

function testConfig() {
  console.log('Testing config endpoint...');
  console.log('Workflows:', STACK_WORKFLOWS);
  console.log('Base URL:', 'https://api.stack-ai.com/inference/v0/run/' + STACK_AI_ORG_ID);
}
