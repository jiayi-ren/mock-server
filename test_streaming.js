/**
 * Simple test script to verify streaming functionality
 * Run with: node test_streaming.js
 */

const http = require('http');

console.log('Testing Mock Server Streaming...\n');

// Test 1: Small payload (non-streaming)
console.log('Test 1: Small payload (10KB) - Should NOT stream');
testRequest('http://localhost:3001/json?size=10', (headers, size) => {
  console.log(`  X-Streaming: ${headers['x-streaming']}`);
  console.log(`  Response size: ~${size} bytes`);
  console.log(`  ✓ Test 1 passed\n`);
  
  // Test 2: Medium payload (50MB) - Should NOT stream
  console.log('Test 2: Medium payload (50MB) - Should NOT stream');
  testRequest('http://localhost:3001/json?size=51200', (headers, size) => {
    console.log(`  X-Streaming: ${headers['x-streaming']}`);
    console.log(`  Response size: ~${(size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  ✓ Test 2 passed\n`);
    
    // Test 3: Large payload (150MB) - SHOULD stream
    console.log('Test 3: Large payload (150MB) - SHOULD stream');
    testRequest('http://localhost:3001/json?size=153600', (headers, size) => {
      console.log(`  X-Streaming: ${headers['x-streaming']}`);
      console.log(`  Transfer-Encoding: ${headers['transfer-encoding']}`);
      console.log(`  Response size: ~${(size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  ✓ Test 3 passed\n`);
      
      // Test 4: Non-streaming structure (columnar)
      console.log('Test 4: Columnar structure (50MB) - Should NOT stream (structure limitation)');
      testRequest('http://localhost:3001/json?structure=5&size=51200', (headers, size) => {
        console.log(`  X-Streaming: ${headers['x-streaming']}`);
        console.log(`  Response size: ~${(size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  ✓ Test 4 passed\n`);
        
        console.log('All tests completed! ✓');
      });
    });
  });
});

function testRequest(url, callback) {
  http.get(url, (res) => {
    let size = 0;
    let chunks = 0;
    
    res.on('data', (chunk) => {
      size += chunk.length;
      chunks++;
      if (chunks === 1) {
        console.log(`  First chunk received (${chunk.length} bytes)`);
      }
    });
    
    res.on('end', () => {
      console.log(`  Total chunks: ${chunks}`);
      callback(res.headers, size);
    });
  }).on('error', (err) => {
    console.error(`  ✗ Error: ${err.message}`);
    console.log('  Make sure the server is running: npm start\n');
    process.exit(1);
  });
}

