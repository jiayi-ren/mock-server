/**
 * Streaming JSON Generator
 * Generates large JSON payloads by streaming records in chunks
 * Memory-efficient for payloads > 100MB
 */

const { generateJSON } = require('./json_generator');
const { getStructurePrefix, getStructureSuffix } = require('./json_structure');

/**
 * Check if structure supports streaming
 * @param {number} structure - Structure type (1-9)
 * @returns {boolean} True if streaming is supported
 */
function supportsStreaming(structure) {
  // Structures 5 (columnar) and 8 (grouped) need all records in memory
  // to build the final structure, so they don't support streaming
  return structure !== 5 && structure !== 8;
}

/**
 * Stream JSON response in chunks
 * @param {Object} res - Express response object
 * @param {number} structure - Structure type (1-9)
 * @param {number} recordFormat - Record format (1-3)
 * @param {number} sizeKB - Target size in KB
 * @param {boolean} useRandom - Use random values
 * @param {number} chunkSizeKB - Size of each chunk in KB (default 10MB)
 */
function streamJSON(res, structure, recordFormat, sizeKB, useRandom, chunkSizeKB = 5120) {
  // Check if structure supports streaming
  if (!supportsStreaming(structure)) {
    throw new Error(`Structure ${structure} does not support streaming. Use non-streaming endpoint for this structure.`);
  }

  // Set headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Transfer-Encoding', 'chunked');
  
  // Send structure prefix
  const prefix = getStructurePrefix(structure);
  res.write(prefix);

  let totalGenerated = 0;
  let recordCount = 0;
  let isFirstRecord = true;

  // Generate and stream in chunks
  while (totalGenerated < sizeKB) {
    const remainingKB = sizeKB - totalGenerated;
    const currentChunkSize = Math.min(chunkSizeKB, remainingKB);
    
    if (currentChunkSize < 1) break;

    try {
      // Generate chunk of records
      const records = generateJSON(recordFormat, currentChunkSize, useRandom);
      
      // Convert records to appropriate format for structure 4 (array of arrays)
      let recordsToSend = records;
      if (structure === 4) {
        recordsToSend = records.map(record => Object.values(record));
      }
      
      // Stream each record
      for (let i = 0; i < recordsToSend.length; i++) {
        if (!isFirstRecord) {
          res.write(',');
        }
        res.write(JSON.stringify(recordsToSend[i]));
        isFirstRecord = false;
        recordCount++;
      }
      
      // Estimate size (rough approximation)
      totalGenerated += currentChunkSize;
      
    } catch (error) {
      // If we hit an error, close the JSON properly and end
      const suffix = getStructureSuffix(structure, recordCount);
      res.write(suffix);
      res.end();
      throw error;
    }
  }

  // Send structure suffix
  const suffix = getStructureSuffix(structure, recordCount);
  res.write(suffix);
  res.end();
}

module.exports = {
  streamJSON,
  supportsStreaming
};

