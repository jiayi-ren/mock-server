/**
 * JSON Structure Utility
 * Different ways to represent tabular data in JSON format
 * All structures are CSV-convertible via JSONPath
 * Optimized for performance and memory efficiency
 */

// Pre-allocated constants to avoid repeated allocations
const JSONPATH_MAP = Object.freeze({
  1: "$[*]",
  2: "$.data[*]",
  3: "$.race.entries[*]",
  4: "$[*]",
  5: "N/A (columnar format - transpose required)",
  6: "$.data[*]",
  7: "$.data[*]",
  8: "$.groups.*[*]",
  9: "$.api.response.payload.records[*]"
});

const DESCRIPTION_MAP = Object.freeze({
  1: "Flat array of objects",
  2: "Object with data property",
  3: "Nested object (race.entries)",
  4: "Array of arrays (no property names)",
  5: "Columnar format (properties as arrays)",
  6: "Object with metadata and data",
  7: "Paginated REST API response",
  8: "Grouped/categorized data",
  9: "Deep nested structure (3 levels)"
});

// Cache for timestamp to avoid repeated Date object creation
let cachedTimestamp = null;
let lastTimestampCheck = 0;
const TIMESTAMP_CACHE_MS = 1000; // Cache for 1 second

function getCachedTimestamp() {
  const now = Date.now();
  if (!cachedTimestamp || (now - lastTimestampCheck) > TIMESTAMP_CACHE_MS) {
    cachedTimestamp = new Date(now).toISOString();
    lastTimestampCheck = now;
  }
  return cachedTimestamp;
}

/**
 * Structure 1: Flat array of objects (most common)
 * [
 *   {"id": 1, "name": "John", "amount": 100},
 *   {"id": 2, "name": "Jane", "amount": 200}
 * ]
 * JSONPath: $[*]
 */
function applyStructure1(records) {
  return records;
}

/**
 * Structure 2: Object with data property
 * {
 *   "data": [
 *     {"id": 1, "name": "John"},
 *     {"id": 2, "name": "Jane"}
 *   ]
 * }
 * JSONPath: $.data[*]
 */
function applyStructure2(records) {
  return {
    data: records
  };
}

/**
 * Structure 3: Nested object with custom key
 * {
 *   "race": {
 *     "entries": [
 *       {"id": 11, "name": "John"},
 *       {"id": 22, "name": "Jane"}
 *     ]
 *   }
 * }
 * JSONPath: $.race.entries[*]
 */
function applyStructure3(records) {
  return {
    race: {
      entries: records
    }
  };
}

/**
 * Structure 4: Array of arrays (no property names)
 * [
 *   [1, "John", 100],
 *   [2, "Jane", 200]
 * ]
 * JSONPath: $[*]
 * Note: First row could be headers
 */
function applyStructure4(records) {
  if (!records || records.length === 0) {
    return [];
  }

  // Get all keys from first record (cache it)
  const keys = Object.keys(records[0]);
  const keyCount = keys.length;
  
  // Pre-allocate result array
  const arrayOfArrays = new Array(records.length);
  
  // Convert each record to an array of values
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const row = new Array(keyCount);
    for (let j = 0; j < keyCount; j++) {
      row[j] = record[keys[j]];
    }
    arrayOfArrays[i] = row;
  }

  return arrayOfArrays;
}

/**
 * Structure 5: Columnar format (arrays by property)
 * {
 *   "id": [1, 2, 3],
 *   "name": ["John", "Jane", "Bob"],
 *   "amount": [100, 200, 300]
 * }
 * JSONPath: N/A (requires special handling for CSV)
 * Note: This is the most space-efficient format
 */
function applyStructure5(records) {
  if (!records || records.length === 0) {
    return {};
  }

  const keys = Object.keys(records[0]);
  const columnar = {};
  const recordCount = records.length;

  // Pre-allocate arrays for each key
  for (let i = 0; i < keys.length; i++) {
    columnar[keys[i]] = new Array(recordCount);
  }

  // Populate columnar data (single pass)
  for (let i = 0; i < recordCount; i++) {
    const record = records[i];
    for (let j = 0; j < keys.length; j++) {
      columnar[keys[j]][i] = record[keys[j]];
    }
  }

  return columnar;
}

/**
 * Structure 6: Object with metadata and data array (API response style)
 * {
 *   "metadata": {
 *     "timestamp": "2024-11-07T10:30:00.000Z",
 *     "count": 2
 *   },
 *   "data": [
 *     {"id": 1, "name": "John"},
 *     {"id": 2, "name": "Jane"}
 *   ]
 * }
 * JSONPath: $.data[*]
 */
function applyStructure6(records) {
  return {
    metadata: {
      timestamp: getCachedTimestamp(),
      version: "1.0",
      record_count: records.length,
      generated_by: "mock-server"
    },
    data: records
  };
}

/**
 * Structure 7: Paginated response (REST API style)
 * {
 *   "data": [...],
 *   "links": {...},
 *   "meta": {...}
 * }
 * JSONPath: $.data[*]
 */
function applyStructure7(records) {
  return {
    data: records,
    links: {
      self: "/json",
      first: "/json?page=1",
      last: "/json?page=1",
      prev: null,
      next: null
    },
    meta: {
      current_page: 1,
      from: 1,
      last_page: 1,
      per_page: records.length,
      to: records.length,
      total: records.length,
      path: "/json"
    }
  };
}

/**
 * Structure 8: Grouped/categorized data
 * {
 *   "groups": {
 *     "category1": [...],
 *     "category2": [...]
 *   },
 *   "summary": {...}
 * }
 * JSONPath: $.groups.*[*] or $.groups.category1[*]
 */
function applyStructure8(records) {
  const groups = {};
  let groupCount = 0;
  
  // Single pass grouping
  const recordCount = records.length;
  for (let i = 0; i < recordCount; i++) {
    const record = records[i];
    let key;
    
    // Use correct property names from our schema
    if (record.string_category) {
      key = record.string_category;
    } else if (record.string_location) {
      key = record.string_location;
    } else if (record.string_status) {
      key = record.string_status;
    } else {
      // Split into groups of ~10 records
      key = `group_${Math.floor(i / 10) + 1}`;
    }
    
    if (!groups[key]) {
      groups[key] = [];
      groupCount++;
    }
    groups[key].push(record);
  }

  return {
    groups: groups,
    summary: {
      total_records: recordCount,
      group_count: groupCount,
      timestamp: getCachedTimestamp()
    }
  };
}

/**
 * Structure 9: Deep nested structure (3 levels)
 * {
 *   "api": {
 *     "response": {
 *       "payload": {
 *         "records": [...]
 *       }
 *     }
 *   }
 * }
 * JSONPath: $.api.response.payload.records[*]
 */
function applyStructure9(records) {
  return {
    api: {
      version: "v1",
      endpoint: "/json",
      timestamp: getCachedTimestamp(),
      response: {
        status: "ok",
        code: 200,
        payload: {
          records: records,
          metadata: {
            count: records.length,
            format: "json"
          }
        }
      }
    }
  };
}

/**
 * Apply JSON structure to records
 * @param {Array} records - Array of record objects
 * @param {number} structure - Structure type (1-9)
 * @returns {Object|Array} Structured JSON data
 */
function applyStructure(records, structure = 1) {
  switch (structure) {
    case 1:
      return applyStructure1(records);
    case 2:
      return applyStructure2(records);
    case 3:
      return applyStructure3(records);
    case 4:
      return applyStructure4(records);
    case 5:
      return applyStructure5(records);
    case 6:
      return applyStructure6(records);
    case 7:
      return applyStructure7(records);
    case 8:
      return applyStructure8(records);
    case 9:
      return applyStructure9(records);
    default:
      return applyStructure1(records);
  }
}

/**
 * Get JSONPath for extracting records from a structure
 * @param {number} structure - Structure type (1-9)
 * @returns {string} JSONPath expression
 */
function getJSONPath(structure) {
  return JSONPATH_MAP[structure] || JSONPATH_MAP[1];
}

/**
 * Get description for a structure
 * @param {number} structure - Structure type (1-9)
 * @returns {string} Description
 */
function getStructureDescription(structure) {
  return DESCRIPTION_MAP[structure] || DESCRIPTION_MAP[1];
}

/**
 * Get structure prefix for streaming (opening JSON before records array)
 * @param {number} structure - Structure type (1-9)
 * @returns {string|null} Opening JSON string, or null if streaming not supported
 */
function getStructurePrefix(structure) {
  const timestamp = getCachedTimestamp();
  
  switch (structure) {
    case 1:
      return '[';
    case 2:
      return '{"data":[';
    case 3:
      return '{"race":{"entries":[';
    case 4:
      return '[';
    case 5:
      return null; // Columnar format requires all records in memory
    case 6:
      return `{"metadata":{"timestamp":"${timestamp}","version":"1.0","record_count":0,"generated_by":"mock-server"},"data":[`;
    case 7:
      return '{"data":[';
    case 8:
      return null; // Grouped format requires all records in memory
    case 9:
      return `{"api":{"version":"v1","endpoint":"/json","timestamp":"${timestamp}","response":{"status":"ok","code":200,"payload":{"records":[`;
    default:
      return '[';
  }
}

/**
 * Get structure suffix for streaming (closing JSON after records array)
 * @param {number} structure - Structure type (1-9)
 * @param {number} recordCount - Total number of records
 * @returns {string|null} Closing JSON string, or null if streaming not supported
 */
function getStructureSuffix(structure, recordCount) {
  switch (structure) {
    case 1:
      return ']';
    case 2:
      return ']}';
    case 3:
      return ']}}';
    case 4:
      return ']';
    case 5:
      return null; // Columnar format requires all records in memory
    case 6:
      return ']}';
    case 7:
      return `],"links":{"self":"/json","first":"/json?page=1","last":"/json?page=1","prev":null,"next":null},"meta":{"current_page":1,"from":1,"last_page":1,"per_page":${recordCount},"to":${recordCount},"total":${recordCount},"path":"/json"}}`;
    case 8:
      return null; // Grouped format requires all records in memory
    case 9:
      return `],"metadata":{"count":${recordCount},"format":"json"}}}}}`;
    default:
      return ']';
  }
}

module.exports = { 
  applyStructure,
  getJSONPath,
  getStructureDescription,
  getStructurePrefix,
  getStructureSuffix,
  getCachedTimestamp
};
