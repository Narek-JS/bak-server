/**
 * Simple API test script for Bak Cameras Server
 * Run with: node test-api.js
 */

const http = require('http');
const WebSocket = require('ws');

const BASE_URL = 'http://localhost:5000';
const WS_URL = 'ws://localhost:5000/ws';

// Test HTTP endpoints
async function testHttpEndpoints() {
  console.log('🧪 Testing HTTP Endpoints...\n');

  // Test root endpoint
  try {
    const response = await makeRequest('/');
    console.log('✅ Root endpoint:', response.message);
  } catch (error) {
    console.log('❌ Root endpoint failed:', error.message);
  }

  // Test health endpoint
  try {
    const response = await makeRequest('/health');
    console.log('✅ Health check:', response.status);
    console.log('   Uptime:', Math.round(response.uptime), 'seconds');
    console.log('   Connected clients:', response.connectedClients);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
  }

  // Test API status
  try {
    const response = await makeRequest('/api/status');
    console.log('✅ API status:', response.message);
    console.log('   Version:', response.version);
    console.log('   Connected clients:', response.connectedClients);
  } catch (error) {
    console.log('❌ API status failed:', error.message);
  }

  // Test images list
  try {
    const response = await makeRequest('/api/images');
    console.log('✅ Images list:', response.data.totalImages, 'images found');
  } catch (error) {
    console.log('❌ Images list failed:', error.message);
  }
}

// Test WebSocket connection
function testWebSocket() {
  console.log('\n🔌 Testing WebSocket Connection...\n');

  return new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);

    ws.on('open', () => {
      console.log('✅ WebSocket connected successfully');
      
      // Send a test message
      const testData = Buffer.from('test video chunk');
      ws.send(testData);
      console.log('📤 Sent test video chunk');
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'connection') {
          console.log('✅ Received connection message:', message.message);
        } else if (message.type === 'detection') {
          console.log('✅ Received detection results:', message.data.length, 'detections');
        } else {
          console.log('📥 Received message:', message);
        }
      } catch (error) {
        console.log('📥 Received binary data:', data.length, 'bytes');
      }
    });

    ws.on('error', (error) => {
      console.log('❌ WebSocket error:', error.message);
      resolve();
    });

    ws.on('close', () => {
      console.log('🔌 WebSocket connection closed');
      resolve();
    });

    // Close connection after 3 seconds
    setTimeout(() => {
      ws.close();
    }, 3000);
  });
}

// Helper function to make HTTP requests
function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(new Error('Invalid JSON response'));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Main test function
async function runTests() {
  console.log('🚀 Bak Cameras Server API Test\n');
  console.log('================================\n');

  try {
    await testHttpEndpoints();
    await testWebSocket();
    
    console.log('\n================================');
    console.log('✅ All tests completed!');
    console.log('\n💡 Tips:');
    console.log('   - Make sure the server is running: npm run dev');
    console.log('   - Check server logs for detailed information');
    console.log('   - Test image upload with a tool like Postman');
  } catch (error) {
    console.log('\n❌ Test failed:', error.message);
    console.log('\n💡 Make sure the server is running on localhost:5000');
  }
}

// Run tests
runTests();
