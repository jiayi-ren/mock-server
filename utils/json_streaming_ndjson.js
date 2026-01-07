/**
 * NDJSON Streaming (Newline Delimited JSON)
 * True streaming that browsers can display progressively
 * Each record is sent as a separate line, allowing progressive rendering
 */

const { generateJSON } = require('./json_generator');

/**
 * Stream JSON as NDJSON (newline-delimited JSON)
 * This allows browsers to display data progressively as it arrives
 * 
 * @param {Object} res - Express response object
 * @param {number} recordFormat - Record format (1-3)
 * @param {number} sizeKB - Target size in KB
 * @param {boolean} useRandom - Use random values
 * @param {number} chunkSizeKB - Size of each chunk in KB (default 10MB)
 */
function streamNDJSON(res, recordFormat, sizeKB, useRandom, chunkSizeKB = 10240) {
  // Set headers for NDJSON streaming
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  let totalGenerated = 0;
  let recordCount = 0;

  // Generate and stream in chunks
  const streamInterval = setInterval(() => {
    if (totalGenerated >= sizeKB) {
      clearInterval(streamInterval);
      res.end();
      return;
    }

    const remainingKB = sizeKB - totalGenerated;
    const currentChunkSize = Math.min(chunkSizeKB, remainingKB);
    
    if (currentChunkSize < 1) {
      clearInterval(streamInterval);
      res.end();
      return;
    }

    try {
      // Generate chunk of records
      const records = generateJSON(recordFormat, currentChunkSize, useRandom);
      
      // Stream each record as a separate line (NDJSON format)
      for (let i = 0; i < records.length; i++) {
        res.write(JSON.stringify(records[i]) + '\n');
        recordCount++;
      }
      
      // Estimate size
      totalGenerated += currentChunkSize;
      
    } catch (error) {
      clearInterval(streamInterval);
      res.end();
      throw error;
    }
  }, 100); // Send a chunk every 100ms for visible streaming
}

/**
 * Stream JSON as Server-Sent Events (SSE)
 * Another format that browsers can display progressively
 * 
 * @param {Object} res - Express response object
 * @param {number} recordFormat - Record format (1-3)
 * @param {number} sizeKB - Target size in KB
 * @param {boolean} useRandom - Use random values
 * @param {number} chunkSizeKB - Size of each chunk in KB
 */
function streamSSE(res, recordFormat, sizeKB, useRandom, chunkSizeKB = 10240) {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  
  let totalGenerated = 0;
  let recordCount = 0;

  // Generate and stream in chunks
  const streamInterval = setInterval(() => {
    if (totalGenerated >= sizeKB) {
      clearInterval(streamInterval);
      res.write('event: done\ndata: {"status": "complete"}\n\n');
      res.end();
      return;
    }

    const remainingKB = sizeKB - totalGenerated;
    const currentChunkSize = Math.min(chunkSizeKB, remainingKB);
    
    if (currentChunkSize < 1) {
      clearInterval(streamInterval);
      res.end();
      return;
    }

    try {
      // Generate chunk of records
      const records = generateJSON(recordFormat, currentChunkSize, useRandom);
      
      // Stream each record as SSE event
      for (let i = 0; i < records.length; i++) {
        res.write(`data: ${JSON.stringify(records[i])}\n\n`);
        recordCount++;
      }
      
      // Estimate size
      totalGenerated += currentChunkSize;
      
    } catch (error) {
      clearInterval(streamInterval);
      res.end();
      throw error;
    }
  }, 100); // Send a chunk every 100ms for visible streaming
}

module.exports = {
  streamNDJSON,
  streamSSE
};

