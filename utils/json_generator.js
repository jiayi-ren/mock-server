/**
 * JSON Generator Utility
 * Generates record data with consistent field names and types
 * Optimized for memory efficiency and performance
 */

// Pre-allocate constant arrays to avoid recreation on every call
const STRING_NAMES = Object.freeze([
  'Johnson, Smith, and Jones Co.',
  'Sam "Mad Dog" Smith',
  'Barney & Company',
  "Johnson's Automotive",
  'O\'Reilly & Sons, Inc.',
  'The "Best" Company, Ltd.',
  'Smith & Wesson, LLC',
  'Acme Food Inc.',
  'Price: $1,234.56 (50% off!)',
  'Email: contact@example.com | Phone: (555) 123-4567',
  'Line1\nLine2\nLine3',
  'Tab\tSeparated\tValues',
  'Symbols: @#$%^&*()_+-=[]{}|\\;:\'",.<>/?',
  'Unicode: café, naïve, résumé, 你好',
  'Mixed: "It\'s 100% true!" she said, & left.',
  'Backslash\\Forward/Pipe|Tilde~',
  'Brackets: [array], {object}, <tag>',
  'Quotes: \'single\' "double" `backtick`',
  'Math: 2+2=4, x<5, y>3, a≤b, c≥d',
  'Newline\r\nCarriage\rReturn'
]);

const STRING_REMARKS = Object.freeze([
  'Pays on time',
  '',
  'Great to work with\nand always pays with cash.',
  'Needs follow-up',
  '',
  'VIP customer',
  'Contact: john@example.com',
  'Note: "Handle with care" - they said.',
  'Multi\nLine\nComment\nWith\nBreaks',
  'Special chars: ~!@#$%^&*()_+`-={}|[]\\:";\'<>?,./\t',
  'JSON-like: {"key": "value", "array": [1,2,3]}',
  'SQL-like: SELECT * FROM users WHERE id=1; DROP TABLE users;--',
  'HTML-like: <script>alert("XSS")</script>',
  'Path: C:\\Users\\Admin\\Documents\\file.txt',
  'URL: https://example.com/path?param=value&other=123',
  'Emoji: 😀 🎉 ✨ 🚀 ⚠️',
  'Mixed: It\'s "complicated" & requires 100% attention!',
  'Trailing spaces:   ',
  '   Leading spaces',
  '\tTab\tDelimited\tText\t'
]);

const CATEGORIES = Object.freeze(['Electronics', 'Clothing', 'Books', 'Home & Garden', 'Sports']);
const CITIES = Object.freeze(['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix']);
const LEVELS = Object.freeze(['INFO', 'WARN', 'ERROR', 'DEBUG']);

// Pre-allocated tag arrays - frozen to prevent accidental mutation
const TAG_ARRAYS = Object.freeze([
  Object.freeze(['tag1']),
  Object.freeze(['tag1', 'tag2']),
  Object.freeze(['tag1', 'tag2', 'tag3']),
  Object.freeze(['tag1', 'tag2', 'tag3', 'important'])
]);

// Pre-generate timestamps to avoid Date object creation in hot path
const TIMESTAMPS = [];
const BASE_TIME = Date.now();
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
for (let i = 0; i < 100; i++) {
  TIMESTAMPS.push(new Date(BASE_TIME - Math.random() * YEAR_MS).toISOString());
}
Object.freeze(TIMESTAMPS);

// Pre-generate description strings to avoid template literal overhead
const DESCRIPTIONS = [];
for (let i = 0; i < 100; i++) {
  DESCRIPTIONS.push(
    `Record #${i + 1}: Contains "quotes", commas, and special chars like @#$%^&*(). May also have\nnewlines and tabs\there.`
  );
}
Object.freeze(DESCRIPTIONS);

// Pre-generate user strings for metadata
const USER_STRINGS = [];
for (let i = 1; i <= 10; i++) {
  USER_STRINGS.push(`user${i}`);
}
Object.freeze(USER_STRINGS);

// Pre-calculate deterministic decimal amounts (avoid parseFloat/toFixed in hot path)
const DECIMAL_AMOUNTS = [];
for (let i = 0; i < 1000; i++) {
  DECIMAL_AMOUNTS.push(parseFloat(((i * 123.45) % 10000).toFixed(2)));
}
Object.freeze(DECIMAL_AMOUNTS);

// Pre-calculate deterministic rates (avoid parseFloat/toFixed in hot path)
const DECIMAL_RATES = [];
for (let i = 0; i < 1000; i++) {
  DECIMAL_RATES.push(parseFloat(((i * 7.89) % 100).toFixed(2)));
}
Object.freeze(DECIMAL_RATES);

const MAX_SIZE_KB = 1024 * 1024; // 1 GB (streaming enabled for >100MB)

/**
 * Generate a single record with all field types
 * @param {number} index - Record index
 * @param {boolean} useRandom - If true, use Math.random(); if false, use deterministic values
 * @returns {Object} Record with various field types
 */
function generateRecord(index, useRandom = false) {
  return {
    // Integer ID
    int_id: index + 1,
    
    // String with special characters (reference to pre-allocated string)
    string_name: STRING_NAMES[index % 20],
    
    // Decimal number (deterministic: use pre-calculated, random: calculate)
    decimal_amount: useRandom 
      ? parseFloat((Math.random() * 10000).toFixed(2))
      : DECIMAL_AMOUNTS[index % 1000],
    
    // Boolean (deterministic based on index)
    bool_active: useRandom 
      ? Math.random() > 0.5
      : (index % 3) !== 0,
    
    // String that may be empty (reference to pre-allocated string)
    string_remark: STRING_REMARKS[index % 20],
    
    // Category/enum string (reference to pre-allocated string)
    string_category: CATEGORIES[index % 5],
    
    // ISO timestamp string (reference to pre-generated timestamp)
    string_timestamp: TIMESTAMPS[index % 100],
    
    // Integer count (deterministic based on index)
    int_count: useRandom 
      ? Math.floor(Math.random() * 1000)
      : (index * 17) % 1000,
    
    // Percentage as decimal (deterministic: use pre-calculated, random: calculate)
    decimal_rate: useRandom 
      ? parseFloat((Math.random() * 100).toFixed(2))
      : DECIMAL_RATES[index % 1000],
    
    // Status/level string (reference to pre-allocated string)
    string_status: LEVELS[index % 4],
    
    // Nested object (must be created new each time)
    object_metadata: {
      created_by: USER_STRINGS[index % 10],
      priority: useRandom 
        ? Math.floor(Math.random() * 5) + 1
        : (index % 5) + 1,
      verified: useRandom 
        ? Math.random() > 0.3
        : (index % 7) < 5
    },
    
    // Array of strings (reference to frozen pre-allocated array)
    array_tags: TAG_ARRAYS[useRandom 
      ? Math.floor(Math.random() * 4)
      : index % 4],
    
    // Location string (reference to pre-allocated string)
    string_location: CITIES[index % 5],
    
    // Description (reference to pre-generated string)
    string_description: DESCRIPTIONS[index % 100]
  };
}

/**
 * Generate records up to target size
 * @param {number} targetSizeKB - Target size in KB
 * @param {boolean} useRandom - If true, use random values; if false, use deterministic values
 * @returns {Array} Array of record objects
 */
function generateRecords(targetSizeKB, useRandom = false) {
  const targetSize = targetSizeKB * 1024;
  
  // Generate first record to estimate average size
  const firstRecord = generateRecord(0, useRandom);
  
  // Calculate size and immediately discard the JSON string
  const avgRecordSize = Buffer.byteLength(JSON.stringify(firstRecord), 'utf8');
  
  // Estimate total records needed (with 5% buffer for variance)
  const estimatedRecords = Math.ceil((targetSize / avgRecordSize) * 1.05);
  
  // Pre-allocate array with estimated capacity
  const records = new Array(estimatedRecords);
  records[0] = firstRecord;
  
  let currentSize = avgRecordSize + 2; // +2 for array brackets
  let recordCount = 1;

  // Generate remaining records
  while (currentSize < targetSize && recordCount < estimatedRecords) {
    const record = generateRecord(recordCount, useRandom);
    records[recordCount] = record;
    
    // Only stringify and measure every 20th record for performance
    // Use average size for others (reduces memory churn)
    if (recordCount % 20 === 0) {
      const actualSize = Buffer.byteLength(JSON.stringify(record), 'utf8') + 1;
      currentSize += actualSize;
    } else {
      currentSize += avgRecordSize + 1; // +1 for comma
    }
    
    recordCount++;
    
    // Early exit if we've exceeded target
    if (currentSize >= targetSize) {
      break;
    }
  }

  // Trim array to actual size (remove unused pre-allocated slots)
  records.length = recordCount;
  
  return records;
}

/**
 * Main generator function
 * @param {number} format - Record format type (currently only 1, but kept for API compatibility)
 * @param {number} sizeKB - Target size in KB
 * @param {boolean} useRandom - If true, use random values; if false (default), use deterministic values
 * @returns {Array} Array of record objects
 */
function generateJSON(format = 1, sizeKB = 10, useRandom = false) {
  // Validate format (keeping 1-3 for backward compatibility, but all return same fields)
  if (![1, 2, 3].includes(format)) {
    throw new Error('Invalid format. Must be 1, 2, or 3');
  }

  // Validate size (max 1GB)
  if (sizeKB <= 0 || sizeKB > MAX_SIZE_KB) {
    throw new Error('Invalid size. Must be between 1 KB and 1 GB');
  }

  // All formats now return the same field structure
  return generateRecords(sizeKB, useRandom);
}

module.exports = { generateJSON, MAX_SIZE_KB };
