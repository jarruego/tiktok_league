import axios from 'axios';

async function debugIsPlayoffParam() {
  const baseUrl = 'http://localhost:3000/api';
  
  console.log('🔍 Testing isPlayoff parameter validation...');
  
  // Test different variations of the isPlayoff parameter
  const testUrls = [
    `${baseUrl}/matches?isPlayoff=true`,
    `${baseUrl}/matches?isPlayoff=false`,
    `${baseUrl}/matches?isPlayoff=1`,
    `${baseUrl}/matches?isPlayoff=0`,
    `${baseUrl}/matches?isPlayoff=TRUE`,
    `${baseUrl}/matches?isPlayoff=FALSE`,
    `${baseUrl}/matches`,  // No isPlayoff param
    `${baseUrl}/matches?seasonId=1&isPlayoff=true`,
  ];

  for (const url of testUrls) {
    try {
      console.log(`\n📡 Testing: ${url}`);
      const response = await axios.get(url);
      console.log(`Status: ${response.status} ${response.statusText}`);
      console.log(`Success: Found ${response.data.length || 'N/A'} matches`);
    } catch (error) {
      if (error.response) {
        console.log(`Status: ${error.response.status} ${error.response.statusText}`);
        console.log(`Error body:`, error.response.data);
      } else {
        console.log(`Error: ${error.message}`);
      }
    }
  }
}

debugIsPlayoffParam().catch(console.error);
