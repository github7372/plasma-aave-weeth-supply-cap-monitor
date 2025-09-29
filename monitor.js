const { ethers } = require('ethers');
const fs = require('fs');

// Configuration
const RPC_URL = 'https://rpc.plasma.to';
const WEETH_ADDRESS = '0xA3D68b74bF0528fdD07263c60d6488749044914b';
const ABI = [
  "function totalSupply() view returns (uint256)"
];
const DATA_FILE = 'previous_data.json';

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
  return { lastCheck: null, totalSupply: null };
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

async function getWeETHTotalSupply() {
  try {
    const totalSupply = await contract.totalSupply();
    console.log('weETH totalSupply:', ethers.formatUnits(totalSupply, 18));
    return totalSupply;
  } catch (error) {
    console.error('Error fetching totalSupply:', error);
    throw error;
  }
}

async function runMonitor() {
  const previousData = loadPreviousData();
  const currentSupply = await getWeETHTotalSupply();

  // Compare with previous data and trigger alert if necessary
  if (previousData.totalSupply && !previousData.totalSupply.eq(currentSupply)) {
    triggerEmailAlert(`weETH supply changed! Old: ${previousData.totalSupply}, New: ${currentSupply}`);
  }

  // Save current state
  savePreviousData({ ...previousData, totalSupply: currentSupply.toString() });
}

runMonitor().catch(console.error);
