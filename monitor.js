const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Configuration
const RPC_URL = 'https://rpc.plasma.to';
const AAVE_CONTRACT = '0xAf1a7a488c8348b41d5860C04162af7d3D38A996';
const DATA_FILE = path.join(process.env.GITHUB_WORKSPACE || '.', 'previous_data.json');

// Minimal ABI with totalSupply() read method
const ABI = [
  "function totalSupply() view returns (uint256)"
];

// Provider & Contract
const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(AAVE_CONTRACT, ABI, provider);

// Load previous data
function loadPreviousData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (err) {
      console.log('⚠️ Failed to read previous_data.json, starting fresh');
    }
  }
  return null;
}

// Save current data
function savePreviousData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log('💾 Saved data to previous_data.json');
  } catch (err) {
    console.error('❌ Failed to save previous_data.json:', err.message);
  }
}

// GitHub Actions output helpers
function triggerAlert(message) {
  console.log('🚨 ALERT:', message);
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    fs.appendFileSync(githubOutput, `alert=true\n`);
    fs.appendFileSync(githubOutput, `message=${message}\n`);
    fs.appendFileSync(githubOutput, `timestamp=${new Date().toISOString()}\n`);
  }
}

function clearAlert() {
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    fs.appendFileSync(githubOutput, `alert=false\n`);
  }
}

// Main monitor
async function runMonitor() {
  const previous = loadPreviousData();

  const currentValue = await contract.totalSupply();
  const formatted = ethers.formatUnits(currentValue, 18); // Assuming 18 decimals
  console.log(`Aave Contract totalSupply: ${formatted}`);

  if (!previous) {
    triggerAlert(`First run: totalSupply = ${formatted}`);
  } else if (previous.totalSupply !== currentValue.toString()) {
    triggerAlert(`totalSupply changed! Old: ${previous.totalSupply}, New: ${currentValue.toString()}`);
  } else {
    console.log('😴 No change detected');
    clearAlert();
  }

  savePreviousData({ lastCheck: new Date().toISOString(), totalSupply: currentValue.toString() });
}

runMonitor().catch(err => {
  console.error('💥 Monitor failed:', err);
  triggerAlert(`Critical error: ${err.message}`);
  process.exit(1);
});
