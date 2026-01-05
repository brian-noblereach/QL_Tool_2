// Venture Assessment Platform - API Proxy v4
// Handles Smartsheet integration, Stack AI API calls, and file uploads
// Uses GET requests with URL parameters to avoid CORS preflight issues
// Deploy as Google Apps Script Web App

// ============================================
// CONFIGURATION
// ============================================

// Smartsheet Configuration
const SMARTSHEET_API_TOKEN = 'V6FMYwqs4HmfLld5GH7LGxbHNMfVMXU2vywIp';
const SMARTSHEET_SHEET_ID = '1124748705982348';
const SMARTSHEET_API_BASE = 'https://api.smartsheetgov.com/2.0';

// Stack AI Configuration
const STACK_AI_ORG_ID = 'f913a8b8-144d-47e0-b327-8daa341b575d';
const STACK_AI_PUBLIC_KEY = 'e80f3814-a651-4de7-a7ba-8478b7a9047b';
const STACK_AI_PRIVATE_KEY = '139c4395-8ab3-4a5a-b52b-6ce1b52f7b97';
const STACK_AI_BASE = 'https://api.stack-ai.com/inference/v0/run/' + STACK_AI_ORG_ID;
const STACK_AI_DOCS_BASE = 'https://api.stack-ai.com/documents/' + STACK_AI_ORG_ID;

// Stack AI Workflow IDs
const STACK_WORKFLOWS = {
  // Company workflows - 3 variants based on input type
  company_url: '6949ba4009e0b1ac3990e722',      // Website only
  company_file: '6949ba538f9ce68c9b8b841a',     // File only
  company_both: '6945b566ba9cfba7e5c6fabb',     // Website + file
  
  // Other workflows
  team: '6949b0045ea7002afda5c979',             // New: takes company description
  funding: '68f0020d7a00704c92fdd7b5',
  competitive: '686d72045c56d3a93d5f7b68',
  market: '68a8bc5d5f2ffcec5ada4422',
  iprisk: '68d45d1f4c0213053bf91862'
};

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

// ============================================
// ROBUST FETCH HELPERS
// ============================================

/**
 * Robust UrlFetch wrapper:
 * - Retries transient transport errors (e.g., "Address unavailable")
 * - Exponential backoff + jitter
 */
function fetchWithRetry(url, options, maxAttempts = 5) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return UrlFetchApp.fetch(url, options);
    } catch (e) {
      lastErr = e;

      // Exponential backoff (cap) + jitter
      const base = Math.min(1000 * Math.pow(2, attempt - 1), 15000);
      const jitter = Math.floor(Math.random() * 500);
      const sleepMs = base + jitter;

      console.warn(`UrlFetch failed (attempt ${attempt}/${maxAttempts}) -> sleeping ${sleepMs}ms. Error: ${e}`);
      Utilities.sleep(sleepMs);
    }
  }
  throw lastErr;
}

/**
 * Safe JSON parse with better error context
 */
function safeJsonParse(text, contextLabel) {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(
      `Failed to parse JSON (${contextLabel}): ${e.message}. First 300 chars: ${String(text).slice(0, 300)}`
    );
  }
}

// ============================================
// MAIN REQUEST HANDLERS
// ============================================

/**
 * Handle GET requests
 * Can be used for status check OR for Stack AI calls (to avoid CORS preflight)
 */
function doGet(e) {
  try {
    const dataParam = (e && e.parameter) ? e.parameter.data : null;

    if (dataParam) {
      const data = safeJsonParse(decodeURIComponent(dataParam), 'doGet(dataParam)');

      if (data.action === 'stackai') {
        return handleStackAIRequest(data);
      } else if (data.action === 'smartsheet' || data.ventureName) {
        return handleSmartsheetSubmission(data);
      }
    }

    // Default: return status
    return jsonResponse({
      status: 'ok',
      message: 'Venture Assessment Proxy is running',
      version: '4.0',
      endpoints: ['smartsheet', 'stackai', 'stackai_upload'],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in doGet:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

/**
 * Handle POST requests (for Smartsheet, StackAI, or file uploads)
 * Supports both JSON body (fetch) and form data (iframe submission)
 */
function doPost(e) {
  try {
    let data;
    
    // Check for form data first (from iframe submission)
    if (e.parameter && e.parameter.data) {
      data = safeJsonParse(e.parameter.data, 'doPost(form parameter)');
    } 
    // Then check for JSON body (from fetch)
    else if (e.postData && e.postData.contents) {
      data = safeJsonParse(e.postData.contents, 'doPost(postData)');
    }
    else {
      return jsonResponse({ error: 'No data provided' }, 400);
    }
    
    const action = data.action || 'smartsheet';

    switch (action) {
      case 'smartsheet':
        return handleSmartsheetSubmission(data);

      case 'stackai':
        return handleStackAIRequest(data);

      case 'stackai_upload':
        return handleStackAIUpload(data);

      default:
        if (data.ventureName) {
          return handleSmartsheetSubmission(data);
        }
        return jsonResponse({ error: 'Unknown action: ' + action }, 400);
    }

  } catch (error) {
    console.error('Error in doPost:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

// ============================================
// STACK AI FILE UPLOAD HANDLING
// ============================================

/**
 * Handle file upload to Stack AI
 * 1. Clear existing files for this user
 * 2. Upload new file
 * 3. Call the appropriate workflow
 */
function handleStackAIUpload(data) {
  const workflow = data.workflow;
  const userId = data.userId || 'qual_tool_' + Date.now();
  const fileName = data.fileName;
  const fileBase64 = data.fileBase64;
  const mimeType = data.mimeType || 'application/pdf';
  const websiteUrl = data.websiteUrl || '';

  // Validate workflow
  if (!workflow || !STACK_WORKFLOWS[workflow]) {
    return jsonResponse({ success: false, error: 'Invalid workflow for upload: ' + workflow });
  }

  // Only company_file and company_both support file uploads
  if (workflow !== 'company_file' && workflow !== 'company_both') {
    return jsonResponse({ success: false, error: 'Workflow does not support file uploads: ' + workflow });
  }

  if (!fileName || !fileBase64) {
    return jsonResponse({ success: false, error: 'Missing fileName or fileBase64' });
  }

  const flowId = STACK_WORKFLOWS[workflow];
  const nodeId = 'doc-0';

  console.log(`Starting file upload for workflow: ${workflow}, flowId: ${flowId}, userId: ${userId}`);

  try {
    // Step 1: Clear existing files
    const clearResult = clearExistingFiles(flowId, nodeId, userId);
    console.log('Clear files result:', clearResult);

    // Step 2: Upload new file
    const uploadResult = uploadFile(flowId, nodeId, userId, fileName, fileBase64, mimeType);
    if (!uploadResult.success) {
      return jsonResponse({ success: false, error: 'File upload failed: ' + uploadResult.error });
    }
    console.log('Upload result:', uploadResult);

    // Step 3: Wait for file processing
    Utilities.sleep(2000);

    // Step 4: Call the workflow
    const payload = {
      user_id: userId
    };

    // Add website URL if this is the "both" workflow
    if (workflow === 'company_both' && websiteUrl) {
      payload['in-0'] = websiteUrl;
    }

    // For file-only workflow, we might still need an empty in-0 or doc-0 reference
    // Based on the Python code pattern: doc-0 is set to None when file exists
    if (workflow === 'company_file') {
      payload['doc-0'] = null; // Indicates uploaded document exists
    } else if (workflow === 'company_both') {
      payload['doc-0'] = null; // Indicates uploaded document exists
    }

    const workflowResult = callStackAIWorkflow(workflow, payload);
    return workflowResult;

  } catch (error) {
    console.error('File upload handling failed:', error);
    return jsonResponse({
      success: false,
      error: error.message,
      details: 'File upload or workflow execution failed'
    });
  }
}

/**
 * Clear existing files for a user in a specific flow/node
 */
function clearExistingFiles(flowId, nodeId, userId) {
  const url = `${STACK_AI_DOCS_BASE}/${flowId}/${nodeId}/${userId}`;
  
  try {
    // First, list existing files
    const listResponse = fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${STACK_AI_PRIVATE_KEY}`,
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    });

    const listCode = listResponse.getResponseCode();
    if (listCode !== 200) {
      console.log('No existing files to clear or list failed:', listCode);
      return { cleared: 0 };
    }

    const files = safeJsonParse(listResponse.getContentText(), 'clearExistingFiles list');
    
    if (!Array.isArray(files) || files.length === 0) {
      console.log('No existing files to clear');
      return { cleared: 0 };
    }

    // Delete each file
    let clearedCount = 0;
    for (const fileItem of files) {
      const filename = typeof fileItem === 'string' ? fileItem : fileItem.filename;
      if (filename) {
        try {
          const deleteResponse = fetchWithRetry(url + '?filename=' + encodeURIComponent(filename), {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${STACK_AI_PRIVATE_KEY}`
            },
            muteHttpExceptions: true
          });
          
          if (deleteResponse.getResponseCode() === 200) {
            clearedCount++;
            console.log('Deleted file:', filename);
          }
        } catch (delError) {
          console.warn('Failed to delete file:', filename, delError);
        }
      }
    }

    return { cleared: clearedCount };

  } catch (error) {
    console.warn('Error clearing files:', error);
    return { cleared: 0, error: error.message };
  }
}

/**
 * Upload a file to Stack AI
 */
function uploadFile(flowId, nodeId, userId, fileName, fileBase64, mimeType) {
  const url = `${STACK_AI_DOCS_BASE}/${flowId}/${nodeId}/${userId}`;
  
  try {
    // Decode base64 to blob
    const fileBytes = Utilities.base64Decode(fileBase64);
    const blob = Utilities.newBlob(fileBytes, mimeType, fileName);

    // Create multipart form data
    const boundary = '----WebKitFormBoundary' + Utilities.getUuid().replace(/-/g, '');
    
    // Build multipart body manually
    const requestBody = Utilities.newBlob(
      '--' + boundary + '\r\n' +
      'Content-Disposition: form-data; name="file"; filename="' + fileName + '"\r\n' +
      'Content-Type: ' + mimeType + '\r\n\r\n'
    ).getBytes()
    .concat(fileBytes)
    .concat(Utilities.newBlob('\r\n--' + boundary + '--\r\n').getBytes());

    const response = fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STACK_AI_PRIVATE_KEY}`,
        'Content-Type': 'multipart/form-data; boundary=' + boundary
      },
      payload: requestBody,
      muteHttpExceptions: true
    });

    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    console.log('Upload response code:', responseCode);
    console.log('Upload response (first 500):', responseText.slice(0, 500));

    if (responseCode === 200) {
      const result = safeJsonParse(responseText, 'uploadFile response');
      const success = result.uploaded_file && result.uploaded_file.success;
      
      return {
        success: success,
        fileName: fileName,
        response: result
      };
    } else {
      return {
        success: false,
        error: `Upload failed with status ${responseCode}: ${responseText.slice(0, 200)}`
      };
    }

  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================
// STACK AI INFERENCE
// ============================================

/**
 * Handle Stack AI API requests (no file upload)
 */
function handleStackAIRequest(data) {
  const workflow = data.workflow;
  const payload = data.payload;

  if (!workflow || !STACK_WORKFLOWS[workflow]) {
    return jsonResponse({ success: false, error: 'Invalid or missing workflow: ' + workflow });
  }

  if (!payload) {
    return jsonResponse({ success: false, error: 'Missing payload' });
  }

  return callStackAIWorkflow(workflow, payload);
}

/**
 * Call a Stack AI workflow
 */
function callStackAIWorkflow(workflow, payload) {
  const workflowId = STACK_WORKFLOWS[workflow];
  const url = `${STACK_AI_BASE}/${workflowId}`;

  const started = Date.now();
  console.log(`Calling Stack AI workflow: ${workflow} (${workflowId})`);
  console.log(`Stack AI URL: ${url}`);
  console.log(`Payload keys: ${Object.keys(payload).join(', ')}`);

  try {
    const response = fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STACK_AI_PUBLIC_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const elapsedMs = Date.now() - started;
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    console.log(`Stack AI elapsed ms: ${elapsedMs}`);
    console.log(`Stack AI response code: ${responseCode}`);

    if (responseCode === 200) {
      const result = safeJsonParse(responseText, 'StackAI 200 response');

      return jsonResponse({
        success: true,
        workflow: workflow,
        data: result
      });
    } else {
      console.error(`Stack AI error body (first 800 chars): ${String(responseText).slice(0, 800)}`);
      return jsonResponse({
        success: false,
        error: `Stack AI error (${responseCode})`,
        details: responseText
      });
    }

  } catch (error) {
    const elapsedMs = Date.now() - started;
    console.error('Stack AI request failed:', error);

    return jsonResponse({
      success: false,
      retryable: true,
      error: error.message,
      details: `Transport error after ${elapsedMs}ms`
    });
  }
}

// ============================================
// SMARTSHEET INTEGRATION
// ============================================

function handleSmartsheetSubmission(data) {
  if (!data.ventureName || !data.advisorName) {
    return jsonResponse({ error: 'Missing required fields: ventureName, advisorName' });
  }

  const existingRowId = findExistingRow(data.ventureName, data.advisorName);

  let result;
  if (existingRowId) {
    result = updateRow(existingRowId, data);
  } else {
    result = createRow(data);
  }

  return jsonResponse(result);
}

function findExistingRow(ventureName, advisorName) {
  const url = `${SMARTSHEET_API_BASE}/sheets/${SMARTSHEET_SHEET_ID}`;

  const response = fetchWithRetry(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${SMARTSHEET_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const body = response.getContentText();
  if (code !== 200) {
    throw new Error(`Failed to read Smartsheet (${code}): ${String(body).slice(0, 500)}`);
  }

  const sheet = safeJsonParse(body, 'Smartsheet sheet GET');
  if (!sheet.rows) return null;

  for (const row of sheet.rows) {
    let rowVentureName = null;
    let rowAdvisorName = null;

    for (const cell of row.cells) {
      if (cell.columnId === COLUMNS.ventureName) rowVentureName = cell.value;
      if (cell.columnId === COLUMNS.advisorName) rowAdvisorName = cell.value;
    }

    if (rowVentureName === ventureName && rowAdvisorName === advisorName) {
      return row.id;
    }
  }

  return null;
}

function createRow(data) {
  const url = `${SMARTSHEET_API_BASE}/sheets/${SMARTSHEET_SHEET_ID}/rows`;

  const payload = {
    toBottom: true,
    cells: buildCells(data)
  };

  const response = fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SMARTSHEET_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const text = response.getContentText();
  const result = safeJsonParse(text, 'Smartsheet createRow');

  if (code === 200 && result.message === 'SUCCESS') {
    return {
      success: true,
      action: 'created',
      rowId: result.result.id,
      message: 'Assessment saved successfully'
    };
  } else {
    throw new Error(result.message || `Failed to create row (${code})`);
  }
}

function updateRow(rowId, data) {
  const url = `${SMARTSHEET_API_BASE}/sheets/${SMARTSHEET_SHEET_ID}/rows`;

  const payload = {
    id: rowId,
    cells: buildCells(data)
  };

  const response = fetchWithRetry(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${SMARTSHEET_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const text = response.getContentText();
  const result = safeJsonParse(text, 'Smartsheet updateRow');

  if (code === 200 && result.message === 'SUCCESS') {
    return {
      success: true,
      action: 'updated',
      rowId: result.result.id,
      message: 'Assessment updated successfully'
    };
  } else {
    throw new Error(result.message || `Failed to update row (${code})`);
  }
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

  if (data.teamScoreAi !== undefined) cells.push({ columnId: COLUMNS.teamScoreAi, value: data.teamScoreAi });
  if (data.teamScoreUser !== undefined) cells.push({ columnId: COLUMNS.teamScoreUser, value: data.teamScoreUser });
  if (data.teamJustification !== undefined) cells.push({ columnId: COLUMNS.teamJustification, value: data.teamJustification });

  if (data.fundingScoreAi !== undefined) cells.push({ columnId: COLUMNS.fundingScoreAi, value: data.fundingScoreAi });
  if (data.fundingScoreUser !== undefined) cells.push({ columnId: COLUMNS.fundingScoreUser, value: data.fundingScoreUser });
  if (data.fundingJustification !== undefined) cells.push({ columnId: COLUMNS.fundingJustification, value: data.fundingJustification });

  if (data.competitiveScoreAi !== undefined) cells.push({ columnId: COLUMNS.competitiveScoreAi, value: data.competitiveScoreAi });
  if (data.competitiveScoreUser !== undefined) cells.push({ columnId: COLUMNS.competitiveScoreUser, value: data.competitiveScoreUser });
  if (data.competitiveJustification !== undefined) cells.push({ columnId: COLUMNS.competitiveJustification, value: data.competitiveJustification });

  if (data.marketScoreAi !== undefined) cells.push({ columnId: COLUMNS.marketScoreAi, value: data.marketScoreAi });
  if (data.marketScoreUser !== undefined) cells.push({ columnId: COLUMNS.marketScoreUser, value: data.marketScoreUser });
  if (data.marketJustification !== undefined) cells.push({ columnId: COLUMNS.marketJustification, value: data.marketJustification });

  if (data.ipRiskScoreAi !== undefined) cells.push({ columnId: COLUMNS.ipRiskScoreAi, value: data.ipRiskScoreAi });
  if (data.ipRiskScoreUser !== undefined) cells.push({ columnId: COLUMNS.ipRiskScoreUser, value: data.ipRiskScoreUser });
  if (data.ipRiskJustification !== undefined) cells.push({ columnId: COLUMNS.ipRiskJustification, value: data.ipRiskJustification });

  if (data.averageAiScore !== undefined) cells.push({ columnId: COLUMNS.averageAiScore, value: data.averageAiScore });
  if (data.averageUserScore !== undefined) cells.push({ columnId: COLUMNS.averageUserScore, value: data.averageUserScore });

  return cells;
}

// ============================================
// UTILITIES
// ============================================

function jsonResponse(data, statusCode = 200) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ============================================
// TEST FUNCTIONS
// ============================================

function testStackAIConnection() {
  const testPayload = {
    user_id: 'test_' + Date.now(),
    'in-0': 'https://ztouchnet.com/'
  };

  const url = `${STACK_AI_BASE}/${STACK_WORKFLOWS.company_url}`;
  const started = Date.now();
  console.log('Testing Stack AI (company_url) at:', url);

  try {
    const response = fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STACK_AI_PUBLIC_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      payload: JSON.stringify(testPayload),
      muteHttpExceptions: true
    });

    console.log('Elapsed ms:', Date.now() - started);
    console.log('Status:', response.getResponseCode());
    console.log('Body (first 1000):', response.getContentText().slice(0, 1000));
  } catch (e) {
    console.log('Elapsed ms (exception):', Date.now() - started);
    console.error('Fetch exception:', e);
    throw e;
  }
}

function testTeamAPI() {
  // Test the new team API with company description
  const testPayload = {
    user_id: 'test_' + Date.now(),
    'in-0': JSON.stringify({
      "company_name": "Test Company",
      "description": "AI-native network management platform for 5G networks",
      "founding_team": [{"name": "John Doe", "role": "CEO"}]
    })
  };

  const url = `${STACK_AI_BASE}/${STACK_WORKFLOWS.team}`;
  const started = Date.now();
  console.log('Testing Stack AI (team) at:', url);

  try {
    const response = fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STACK_AI_PUBLIC_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      payload: JSON.stringify(testPayload),
      muteHttpExceptions: true
    });

    console.log('Elapsed ms:', Date.now() - started);
    console.log('Status:', response.getResponseCode());
    console.log('Body (first 1000):', response.getContentText().slice(0, 1000));
  } catch (e) {
    console.log('Elapsed ms (exception):', Date.now() - started);
    console.error('Fetch exception:', e);
    throw e;
  }
}
