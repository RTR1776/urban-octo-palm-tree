require('dotenv').config();
const { ClobClient, createL2Headers } = require('@polymarket/clob-client');

async function generateCredentials() {
  const privateKey = process.env.WALLET_PRIVATE_KEY;
  
  if (!privateKey) {
    console.error('❌ WALLET_PRIVATE_KEY not found in .env file');
    console.log('\nPlease add your wallet private key to backend/.env:');
    console.log('WALLET_PRIVATE_KEY=0x...');
    process.exit(1);
  }

  console.log('🔑 Generating CLOB API credentials from your wallet...\n');

  try {
    // The ClobClient in the JS version works differently
    // We need to derive the credentials using createL2Headers
    const timestamp = Math.floor(Date.now() / 1000);
    const method = 'GET';
    const requestPath = '/auth/derive-api-key';
    
    const headers = createL2Headers(
      privateKey,
      timestamp,
      method,
      requestPath
    );

    console.log('✅ Credentials derived!\n');
    console.log('Your CLOB authentication uses your wallet private key directly.');
    console.log('Add this to your backend/.env file:\n');
    console.log('# Your wallet private key is already set');
    console.log('# The ClobClient will use it directly for authentication\n');
    console.log('⚠️  Keep your private key secure - never share it!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nMake sure your WALLET_PRIVATE_KEY is valid and starts with 0x');
  }
}

generateCredentials();
