const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Configuration
const RPC_URL = 'https://rpc.plasma.to';
const WEETH_ADDRESS = '0xAf1a7a488c8348b41d5860C04162af7d3D38A996';
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

// Send alert via GitHub Actions output
function triggerEmailAlert(message) {
  console.log('🚨 ALERT TRIGGERED:', message);
  console.log(`::set-output name=alert::true`);
  console.log(`::set-output name=message::${message}`);
  console.log(`::set-output name=timestamp::${new Date().toISOString()}`);
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
    // First run
    triggerEmailAlert(`Plasma Aave Monitor started! Current weETH totalSupply: ${ethers.formatUnits(currentSupply, 18)}`);
  } else if (previousData.totalSupply && previousData.totalSupply !== currentSupply.toString()) {
    // Supply changed
    triggerEmailAlert(`weETH supply changed! Old: ${previousData.totalSupply}, New: ${currentSupply.toString()}`);
  } else {
    // No change
    console.log('😴 No change detected in weETH totalSupply');
    console.log(`::set-output name=alert::false`);
  }

  // Save current state
  savePreviousData({ lastCheck: new Date().toISOString(), totalSupply: currentSupply.toString() });
}

runMonitor().catch(error => {
  console.error('💥 Monitor failed:', error);
  triggerEmailAlert(`Critical error in monitor: ${error.message}`);
  process.exit(1);
});
