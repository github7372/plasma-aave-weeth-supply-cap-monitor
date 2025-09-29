const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Configuration
const RPC_URL = 'https://rpc.plasma.to';
const WEETH_ADDRESS = '0xA3D68b74bF0528fdD07263c60d6488749044914b';
const ABI = ["function totalSupply() view returns (uint256)"];
const DATA_FILE = path.join(__dirname, 'previous_data.json');

// Initialize provider and contract
const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(WEETH_ADDRESS, ABI, provider);

// Load previous data
function loadPreviousData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (error) {
    console.log('📝 No previous data found, starting fresh');
  }
  return null;
}

// Save current data
function savePreviousData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Failed to save data:', error.message);
  }
}

// Send alert via GitHub Actions environment file
function triggerEmailAlert(message) {
  console.log('🚨 ALERT TRIGGERED:', message);
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    fs.appendFileSync(githubOutput, `alert=true\n`);
    fs.appendFileSync(githubOutput, `message=${message}\n`);
    fs.appendFileSync(githubOutput, `timestamp=${new Date().toISOString()}\n`);
  }
}

// Write false alert to GitHub Actions environment file
function setNoAlert() {
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    fs.appendFileSync(githubOutput, `alert=false\n`);
  }
}

// Get totalSupply from contract
async function getWeETHTotalSupply() {
  const totalSupply = await contract.totalSupply();
  console.log('weETH totalSupply:', ethers.formatUnits(totalSupply, 18));
  return totalSupply;
}

// Main monitor function
async function runMonitor() {
  const previousData = loadPreviousData();
  const currentSupply = await getWeETHTotalSupply();

  if (!previousData) {
    // First run, alert
    triggerEmailAlert(`Plasma Aave Monitor started! Current weETH totalSupply: ${ethers.formatUnits(currentSupply, 18)}`);
  } else if (previousData.totalSupply && previousData.totalSupply !== currentSupply.toString()) {
    // Supply changed
    triggerEmailAlert(`weETH supply changed! Old: ${previousData.totalSupply}, New: ${currentSupply.toString()}`);
  } else {
    console.log('😴 No change detected in weETH totalSupply');
    setNoAlert();
  }

  // Save current state (creates previous_data.json if missing)
  savePreviousData({ lastCheck: new Date().toISOString(), totalSupply: currentSupply.toString() });
}

runMonitor().catch(error => {
  console.error('💥 Monitor failed:', error);
  triggerEmailAlert(`Critical error in monitor: ${error.message}`);
  process.exit(1);
});
