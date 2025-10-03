// Simple debug test
console.log('Starting debug test...');

try {
  console.log('1. Testing basic imports...');
  const express = require('express');
  console.log('✅ Express imported successfully');
  
  const cors = require('cors');
  console.log('✅ CORS imported successfully');
  
  const multer = require('multer');
  console.log('✅ Multer imported successfully');
  
  const WebSocket = require('ws');
  console.log('✅ WebSocket imported successfully');
  
  const sharp = require('sharp');
  console.log('✅ Sharp imported successfully');
  
  const { v4: uuidv4 } = require('uuid');
  console.log('✅ UUID imported successfully');
  
  console.log('2. Testing basic server creation...');
  const app = express();
  console.log('✅ Express app created');
  
  app.use(cors());
  console.log('✅ CORS middleware added');
  
  app.get('/', (req, res) => {
    res.json({ message: 'Test server working!' });
  });
  console.log('✅ Route added');
  
  const server = require('http').createServer(app);
  console.log('✅ HTTP server created');
  
  const wss = new WebSocket.Server({ server, path: '/ws' });
  console.log('✅ WebSocket server created');
  
  console.log('3. Testing server startup...');
  server.listen(5000, () => {
    console.log('✅ Server started on port 5000');
    console.log('✅ All tests passed!');
    
    // Close server after 2 seconds
    setTimeout(() => {
      server.close();
      console.log('✅ Server closed');
      process.exit(0);
    }, 2000);
  });
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
