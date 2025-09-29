const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Configuration
const RPC_URL = 'https://rpc.plasma.to';
const AAVE_CONTRACT = '0xAf1a7a488c8348b41d5860C04162af7d3D38A996';
const ABI = ["function totalSupply() view returns (uint256)"];
const DATA_FILE = path.join(process.env.GITHUB_WORKSPACE || '.', 'previous_data.json');

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

// Save data
function savePreviousData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log('💾 Saved data to previous_data.json');
  } catch (err) {
    console.error('❌ Failed to save previous_data.json:', err.message);
  }
}

// GitHub Actions outputs
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

// Get totalSupply
async function getTotalSupply() {
  const supply = await contract.totalSupply();
  const formatted = ethers.formatUnits(supply, 18);
  console.log(`Aave totalSupply: ${formatted}`);
  return supply;
}

// Main monitor
async function runMonitor() {
  const previous = loadPreviousData();
  const currentSupply = await getTotalSupply();

  if (!previous) {
    triggerAlert(`First run: totalSupply = ${ethers.formatUnits(currentSupply, 18)}`);
  } else if (previous.totalSupply !== currentSupply.toString()) {
    triggerAlert(`totalSupply changed! Old: ${previous.totalSupply}, New: ${currentSupply.toString()}`);
  } else {
    console.log('😴 No change detected');
    clearAlert();
  }

  savePreviousData({ lastCheck: new Date().toISOString(), totalSupply: currentSupply.toString() });
}

runMonitor().catch(err => {
  console.error('💥 Monitor failed:', err);
  triggerAlert(`Critical error: ${err.message}`);
  process.exit(1);
});
