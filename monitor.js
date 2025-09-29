const https = require('https');
const fs = require('fs');

// Configuration
const CONTRACT_ADDRESS = '0xAf1a7a488c8348b41d5860C04162af7d3D38A996';
const WEETH_ADDRESS = '0xA3D68b74bF0528fdD07263c60d6488749044914b';

// Data storage file
const DATA_FILE = 'previous_data.json';

// Helper function to make HTTPS requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    if (options.data) req.write(options.data);
    req.end();
  });
}

// Set GitHub Actions output
function setGitHubOutput(name, value) {
  console.log(`::set-output name=${name}::${value}`);
}

// Load previous data
function loadPreviousData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (error) {
    console.log('📝 No previous data found, starting fresh');
  }
  return { lastCheck: null, transactions: [], pageHash: null };
}

// Save current data
function savePreviousData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Failed to save data:', error.message);
  }
}

// Send alert via GitHub Actions output
function triggerEmailAlert(message) {
  console.log('🚨 ALERT TRIGGERED:', message);
  setGitHubOutput('alert', 'true');
  setGitHubOutput('message', message);
  setGitHubOutput('timestamp', new Date().toISOString());
}

// Check PlasmasScan for recent activity
async function checkContractActivity() {
  try {
    console.log('🔍 Checking contract activity...');
    
    const txPageUrl = `https://plasmascan.to/address/${CONTRACT_ADDRESS}`;
    
    const response = await makeRequest(txPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AaveMonitor/1.0)'
      }
    });

    if (response.status === 202) {
      console.log('⚠️ Page not ready yet (HTTP 202), skipping check.');
      setGitHubOutput('alert', 'false');
      return;
    }

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }

    const pageContent = response.data;
    const currentHash = Buffer.from(pageContent.substring(0, 2000)).toString('base64').substring(0, 30);
    const previousData = loadPreviousData();

    if (previousData.pageHash && previousData.pageHash !== currentHash) {
      console.log('📈 New activity detected!');
      const hasWeETHActivity = pageContent.toLowerCase().includes(WEETH_ADDRESS.toLowerCase());
      if (hasWeETHActivity) {
        triggerEmailAlert(`New weETH activity detected on Aave contract! Check: ${txPageUrl}`);
      } else {
        triggerEmailAlert(`New contract activity detected on Aave Plasma! Check: ${txPageUrl}`);
      }
    } else if (!previousData.pageHash) {
      console.log('📝 First run - baseline established');
      triggerEmailAlert('Plasma Aave Monitor started! You will be notified of weETH supply changes.');
    } else {
      console.log('😴 No new activity detected');
      setGitHubOutput('alert', 'false');
    }

    await checkForSupplyCapIndicators(pageContent, previousData);

    savePreviousData({
      ...previousData,
      pageHash: currentHash,
      lastCheck: new Date().toISOString()
    });

    console.log('✅ Check completed successfully');

  } catch (error) {
    console.error('❌ Error checking contract:', error.message);
    const previousData = loadPreviousData();
    const now = new Date();
    const lastErrorAlert = previousData.lastErrorAlert ? new Date(previousData.lastErrorAlert) : null;

    if (!lastErrorAlert || (now - lastErrorAlert) > 7200000) { // 2 hours
      triggerEmailAlert(`Monitor encountered an error: ${error.message}. Will keep trying automatically.`);
      savePreviousData({
        ...previousData,
        lastErrorAlert: now.toISOString()
      });
    } else {
      setGitHubOutput('alert', 'false');
    }
  }
}

// Check for supply cap related indicators
async function checkForSupplyCapIndicators(pageContent, previousData) {
  try {
    const patterns = [
      /[\d,]+\.?\d*\s*(weETH|WETH|ETH)/gi,
      /\$[\d,]+\.?\d*[kmb]?/gi,
      /[\d,]+\.?\d*\s*tokens?/gi
    ];

    let foundAmounts = [];
    patterns.forEach(p => {
      const matches = pageContent.match(p) || [];
      foundAmounts = foundAmounts.concat(matches.slice(0, 3));
    });

    if (foundAmounts.length > 0 && foundAmounts.some(a => parseFloat(a.replace(/[^\d.]/g, '')) > 1000)) {
      const previousAmounts = previousData.largeAmounts || [];
      const newAmounts = foundAmounts.filter(a => !previousAmounts.includes(a));
      if (newAmounts.length > 0) {
        triggerEmailAlert(`Large transaction amounts detected: ${newAmounts.join(', ')}. This may indicate significant weETH deposits or supply cap changes.`);
      }
      previousData.largeAmounts = foundAmounts;
    }
  } catch (error) {
    console.log('⚠️ Supply cap check failed:', error.message);
  }
}

// Main monitoring function
async function runMonitor() {
  console.log('🚀 Starting Plasma Aave Monitor...');
  console.log(`📋 Monitoring contract: ${CONTRACT_ADDRESS}`);
  console.log(`🎯 Watching weETH: ${WEETH_ADDRESS_
