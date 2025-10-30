const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Configuration
// const RPC_URL = 'https://rpc.plasma.to';
// const AAVE_CONTRACT = '0xAf1a7a488c8348b41d5860C04162af7d3D38A996';
const RPC_URL = 'https://bsc-dataseed.binance.org/';
const AAVE_CONTRACT = '0x26c5e01524d2E6280A48F2c50fF6De7e52E9611C';
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

// Save current data ONLY when it actually changed
function savePreviousData(data) {
  try {
    const nextStr = JSON.stringify(data, null, 2);
    const prevStr = fs.existsSync(DATA_FILE) ? fs.readFileSync(DATA_FILE, 'utf8') : null;
    if (prevStr && prevStr === nextStr) {
      console.log('ℹ️ No state change, not writing previous_data.json');
      return;
    }
    fs.writeFileSync(DATA_FILE, nextStr);
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

// Main
async function runMonitor() {
  const previous = loadPreviousData();
  const currentSupply = await getTotalSupply();
  const currentStr = currentSupply.toString();

  if (!previous) {
    triggerAlert(`First run: totalSupply = ${ethers.formatUnits(currentSupply, 18)}`);
    savePreviousData({ totalSupply: currentStr, firstSeen: new Date().toISOString() });
  } else if (previous.totalSupply !== currentStr) {
    triggerAlert(`totalSupply changed! Old: ${previous.totalSupply}, New: ${currentStr}`);
    savePreviousData({
      totalSupply: currentStr,
      prevTotalSupply: previous.totalSupply,
      lastChange: new Date().toISOString()
    });
  } else {
    console.log('😴 No change detected');
    clearAlert();
    // Do not write previous_data.json to avoid triggering commits
  }
}

runMonitor().catch(err => {
  console.error('💥 Monitor failed:', err);
  triggerAlert(`Critical error: ${err.message}`);
  process.exit(1);
});
