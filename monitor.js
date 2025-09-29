const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Configuration
const RPC_URL = 'https://rpc.plasma.to';
const CONTRACT_ADDRESS = '0xAf1a7a488c8348b41d5860C04162af7d3D38A996'; // Aave contract
const WEETH_ADDRESS = '0xA3D68b74bF0528fdD07263c60d6488749044914b';
const ABI = ["function totalSupply() view returns (uint256)"];

// Save file in GitHub workspace
const DATA_FILE = path.join(process.env.GITHUB_WORKSPACE || '.', 'previous_data.json');

// Provider & Contract
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

// Save data
function savePreviousData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log('💾 Saved current data to previous_data.json');
  } catch (error) {
    console.error('❌ Failed to save data:', error.message);
  }
}

// Alert function
function triggerEmailAlert(message) {
  console.log('🚨 ALERT:', message);
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    fs.appendFileSync(githubOutput, `alert=true\n`);
    fs.appendFileSync(githubOutput, `message=${message}\n`);
    fs.appendFileSync(githubOutput, `timestamp=${new Date().toISOString()}\n`);
  }
}

// No alert
function setNoAlert() {
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    fs.appendFileSync(githubOutput, `alert=false\n`);
  }
}

// Get totalSupply
async function getWeETHTotalSupply() {
  const totalSupply = await contract.totalSupply();
  console.log('weETH totalSupply:', ethers.formatUnits(totalSupply, 18));
  return totalSupply;
}

// Main
async function runMonitor() {
  const previousData = loadPreviousData();
  const currentSupply = await getWeETHTotalSupply();

  if (!previousData) {
    triggerEmailAlert(`Plasma Aave Monitor started! Current weETH totalSupply: ${ethers.formatUnits(currentSupply, 18)}`);
  } else if (previousData.totalSupply && previousData.totalSupply !== currentSupply.toString()) {
    triggerEmailAlert(`weETH supply changed! Old: ${previousData.totalSupply}, New: ${currentSupply.toString()}`);
  } else {
    console.log('😴 No change detected');
    setNoAlert();
  }

  savePreviousData({ lastCheck: new Date().toISOString(), totalSupply: currentSupply.toString() });
}

runMonitor().catch(error => {
  console.error('💥 Monitor failed:', error);
  triggerEmailAlert(`Critical error in monitor: ${error.message}`);
  process.exit(1);
});
