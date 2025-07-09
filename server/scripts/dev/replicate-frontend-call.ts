import axios from 'axios';

async function replicateFrontendCall() {
  console.log('🔍 Replicating exact frontend call...');
  
  const API_BASE_URL = 'http://localhost:3000';
  
  // Simulate the exact same filters the frontend is sending
  const filters = {
    isPlayoff: true,
    page: 1,
    limit: 50,
    seasonId: 1
  };
  
  const params = new URLSearchParams();
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.append(key, value.toString());
    }
  });
  
  const url = `${API_BASE_URL}/api/matches?${params}`;
  console.log(`📡 Making request to: ${url}`);
  
  try {
    const response = await axios.get(url);
    console.log(`✅ Success: ${response.status} ${response.statusText}`);
    console.log(`📊 Data:`, response.data);
  } catch (error) {
    if (error.response) {
      console.log(`❌ Error: ${error.response.status} ${error.response.statusText}`);
      console.log(`📄 Error body:`, error.response.data);
    } else {
      console.log(`💥 Network error: ${error.message}`);
    }
  }
}

replicateFrontendCall().catch(console.error);
