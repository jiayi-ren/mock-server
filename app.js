const express = require("express");
const cors = require("cors");
const { generateJSON, MAX_SIZE_KB } = require("./utils/json_generator");
const { applyStructure, getJSONPath, getStructureDescription } = require("./utils/json_structure");
const { streamJSON, supportsStreaming } = require("./utils/json_streaming");
const { streamNDJSON, streamSSE } = require("./utils/json_streaming_ndjson");

const app = express();
const port = process.env.PORT || 3001;

// Track active requests to prevent memory exhaustion
let activeRequests = 0;

// Dynamic limits based on request size
function getMaxConcurrentForSize(sizeKB) {
  if (sizeKB < 10240) return 10;      // <10MB: allow 10 concurrent
  if (sizeKB < 30720) return 5;       // 10-30MB: allow 5 concurrent
  if (sizeKB < 51200) return 3;       // 30-50MB: allow 3 concurrent
  if (sizeKB < 102400) return 2;      // 50-100MB: allow 2 concurrent
  return 5;                            // >100MB with streaming: allow 5
}

// Enable CORS for all routes
app.use(cors());

// Serve static files from public directory
app.use('/demo', express.static('public'));

// Middleware to limit concurrent requests (basic check)
app.use((req, res, next) => {
  // Get request size if available
  const sizeKB = parseFloat(req.query.size) || 10;
  const maxForSize = getMaxConcurrentForSize(sizeKB);
  
  if (activeRequests >= maxForSize) {
    return res.status(503).json({
      error: 'Server busy',
      message: `Too many concurrent requests for this size. Max: ${maxForSize}. Please try again in a moment.`,
      activeRequests,
      maxAllowed: maxForSize,
      requestSizeKB: sizeKB
    });
  }
  
  activeRequests++;
  let decremented = false;
  
  const decrementCounter = () => {
    if (!decremented) {
      activeRequests--;
      decremented = true;
    }
  };
  
  res.on('finish', decrementCounter);
  res.on('close', decrementCounter);
  
  next();
});

// Health check endpoint with memory stats
app.get("/health", (req, res) => {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const rssMB = Math.round(memUsage.rss / 1024 / 1024);
  
  res.status(200).json({
    status: "ok",
    memory: {
      heapUsedMB,
      heapTotalMB,
      heapUsagePercent: Math.round((heapUsedMB / heapTotalMB) * 100),
      rssMB
    },
    activeRequests,
    uptime: Math.round(process.uptime())
  });
});

// Root endpoint with documentation
app.get("/", (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Mock Server API</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 1200px; margin: 40px auto; padding: 0 20px; }
          h1 { color: #333; }
          h2 { color: #555; margin-top: 30px; }
          code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
          pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
          table { border-collapse: collapse; width: 100%; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #f8f8f8; font-weight: bold; }
          .example { margin: 10px 0; }
          a { color: #0066cc; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <h1>Mock Server API</h1>
        <p>Generate JSON test data with configurable structure, format, and size.</p>
        
        <h2>Endpoint: GET /json</h2>
        
        <h3>Query Parameters</h3>
        <table>
          <tr>
            <th>Parameter</th>
            <th>Type</th>
            <th>Default</th>
            <th>Description</th>
          </tr>
          <tr>
            <td><code>structure</code></td>
            <td>1-9</td>
            <td>1</td>
            <td>JSON structure format - how tabular data is represented in JSON</td>
          </tr>
          <tr>
            <td><code>record-format</code></td>
            <td>1-3</td>
            <td>1</td>
            <td>Record data type (users, products, or logs)</td>
          </tr>
          <tr>
            <td><code>size</code></td>
            <td>number</td>
            <td>10</td>
            <td>Target size in KB (1 - ${MAX_SIZE_KB} / 1 GB, streaming enabled for >100 MB)</td>
          </tr>
          <tr>
            <td><code>random</code></td>
            <td>boolean</td>
            <td>false</td>
            <td>If true, use random values; if false (default), use deterministic values</td>
          </tr>
        </table>
        <p><strong>Note:</strong> By default, responses are <em>deterministic</em> - the same query parameters will always return identical data. This is useful for testing, caching, and reproducibility. Set <code>random=true</code> to get different data on each request.</p>

        <h3>Structure Formats (Different JSON Representations)</h3>
        <table>
          <tr>
            <th>#</th>
            <th>Format</th>
            <th>JSONPath</th>
            <th>Example</th>
          </tr>
          <tr>
            <td>1</td>
            <td>Flat array of objects</td>
            <td><code>$[*]</code></td>
            <td><code>[{id:1, name:"John"}, ...]</code></td>
          </tr>
          <tr>
            <td>2</td>
            <td>Object with data property</td>
            <td><code>$.data[*]</code></td>
            <td><code>{data: [{id:1}, ...]}</code></td>
          </tr>
          <tr>
            <td>3</td>
            <td>Nested object (custom key)</td>
            <td><code>$.race.entries[*]</code></td>
            <td><code>{race: {entries: [...]}}</code></td>
          </tr>
          <tr>
            <td>4</td>
            <td>Array of arrays</td>
            <td><code>$[*]</code></td>
            <td><code>[[1,"John",100], [2,"Jane",200]]</code></td>
          </tr>
          <tr>
            <td>5</td>
            <td>Columnar (properties as arrays)</td>
            <td><code>N/A</code></td>
            <td><code>{id:[1,2], name:["John","Jane"]}</code></td>
          </tr>
          <tr>
            <td>6</td>
            <td>With metadata</td>
            <td><code>$.data[*]</code></td>
            <td><code>{metadata:{...}, data:[...]}</code></td>
          </tr>
          <tr>
            <td>7</td>
            <td>Paginated REST API</td>
            <td><code>$.data[*]</code></td>
            <td><code>{data:[...], links:{...}, meta:{...}}</code></td>
          </tr>
          <tr>
            <td>8</td>
            <td>Grouped/categorized</td>
            <td><code>$.groups.*[*]</code></td>
            <td><code>{groups: {cat1:[...], cat2:[...]}}</code></td>
          </tr>
          <tr>
            <td>9</td>
            <td>Deep nested (3 levels)</td>
            <td><code>$.api.response.payload.records[*]</code></td>
            <td><code>{api:{response:{payload:{records:[...]}}}}</code></td>
          </tr>
        </table>

        <h3>Record Fields (Same for all formats)</h3>
        <p>All records contain the following fields with type-indicating names:</p>
        <table>
          <tr>
            <th>Field Name</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
          <tr>
            <td><code>int_id</code></td>
            <td>Integer</td>
            <td>Unique ID number</td>
          </tr>
          <tr>
            <td><code>string_name</code></td>
            <td>String</td>
            <td>Name with special characters (commas, quotes, ampersands, apostrophes)</td>
          </tr>
          <tr>
            <td><code>decimal_amount</code></td>
            <td>Decimal</td>
            <td>Monetary amount or value</td>
          </tr>
          <tr>
            <td><code>bool_active</code></td>
            <td>Boolean</td>
            <td>Active/inactive status</td>
          </tr>
          <tr>
            <td><code>string_remark</code></td>
            <td>String</td>
            <td>Notes/remarks (may be empty, may contain newlines)</td>
          </tr>
          <tr>
            <td><code>string_category</code></td>
            <td>String</td>
            <td>Category/classification</td>
          </tr>
          <tr>
            <td><code>string_timestamp</code></td>
            <td>String (ISO)</td>
            <td>ISO 8601 timestamp</td>
          </tr>
          <tr>
            <td><code>int_count</code></td>
            <td>Integer</td>
            <td>Count/quantity</td>
          </tr>
          <tr>
            <td><code>decimal_rate</code></td>
            <td>Decimal</td>
            <td>Rate/percentage</td>
          </tr>
          <tr>
            <td><code>string_status</code></td>
            <td>String</td>
            <td>Status level (INFO, WARN, ERROR, DEBUG)</td>
          </tr>
          <tr>
            <td><code>object_metadata</code></td>
            <td>Object</td>
            <td>Nested metadata object</td>
          </tr>
          <tr>
            <td><code>array_tags</code></td>
            <td>Array</td>
            <td>Array of tag strings</td>
          </tr>
          <tr>
            <td><code>string_location</code></td>
            <td>String</td>
            <td>Location/city name</td>
          </tr>
          <tr>
            <td><code>string_description</code></td>
            <td>String</td>
            <td>Description with special characters and newlines</td>
          </tr>
        </table>
        <p><em>Note: The <code>record-format</code> parameter is kept for API compatibility but currently all formats return the same fields.</em></p>

        <h3>Examples</h3>
        <div class="example">
          <strong>Default (10KB, flat array of objects):</strong><br>
          <a href="/json">/json</a>
        </div>
        <div class="example">
          <strong>Array of arrays (no property names):</strong><br>
          <a href="/json?structure=4&size=5">/json?structure=4&size=5</a>
        </div>
        <div class="example">
          <strong>Columnar format (most space-efficient):</strong><br>
          <a href="/json?structure=5&size=10">/json?structure=5&size=10</a>
        </div>
        <div class="example">
          <strong>With data wrapper:</strong><br>
          <a href="/json?structure=2&size=20">/json?structure=2&size=20</a>
        </div>
        <div class="example">
          <strong>Nested structure (race.entries):</strong><br>
          <a href="/json?structure=3&size=15">/json?structure=3&size=15</a>
        </div>
        <div class="example">
          <strong>Grouped by category:</strong><br>
          <a href="/json?structure=8&size=50">/json?structure=8&size=50</a>
        </div>

        <h3>Progressive Streaming Endpoints</h3>
        <p>For <strong>true progressive streaming</strong> visible in the browser (data appears as it's generated):</p>
        <ul>
          <li><a href="/stream/ndjson?size=50000">GET /stream/ndjson</a> - NDJSON format (newline-delimited JSON, one record per line)</li>
          <li><a href="/stream/sse?size=50000">GET /stream/sse</a> - Server-Sent Events format</li>
        </ul>
        <p><strong>Parameters:</strong> <code>size</code> (KB), <code>record-format</code> (1-3), <code>random</code> (true/false)</p>
        <p><em>Note: The <code>/json</code> endpoint uses HTTP chunked transfer but browsers buffer the complete JSON before displaying. Use these endpoints to see data streaming progressively in real-time.</em></p>
        
        <div style="margin: 20px 0; padding: 15px; background: #e8f4f8; border-radius: 5px;">
          <strong>🎬 <a href="/demo/stream-demo.html">View Live Streaming Demo</a></strong> - Interactive page showing progressive streaming in action!
        </div>

        <h3>Other Endpoints</h3>
        <ul>
          <li><a href="/health">GET /health</a> - Health check</li>
        </ul>
      </body>
    </html>
  `;
  res.type('html').send(html);
});

// JSON endpoint with configurable structure, record format, and size
app.get("/json", (req, res) => {
  try {
    // Parse query parameters
    const structure = parseInt(req.query['structure']) || 1;
    const recordFormat = parseInt(req.query['record-format']) || 1;
    const sizeKB = parseFloat(req.query['size']) || 10;
    const useRandom = req.query['random'] === 'true' || req.query['random'] === '1';
    const STREAMING_THRESHOLD_KB = 102400; // 100 MB
    
    // Memory check disabled - hosting platform manages memory dynamically
    // (heap grows as needed, so static checks don't work)

    // Validate structure
    if (![1, 2, 3, 4, 5, 6, 7, 8, 9].includes(structure)) {
      return res.status(400).json({
        error: 'Invalid structure parameter. Must be 1-9.',
        jsonpath_hint: getJSONPath(1)
      });
    }

    // Validate record format
    if (![1, 2, 3].includes(recordFormat)) {
      return res.status(400).json({
        error: 'Invalid record-format parameter. Must be 1, 2, or 3.'
      });
    }

    // Validate size (max 1GB)
    if (sizeKB <= 0 || sizeKB > MAX_SIZE_KB) {
      return res.status(400).json({
        error: `Invalid size parameter. Must be between 1 and ${MAX_SIZE_KB} (1 GB).`
      });
    }

    // Add headers for convenience
    res.set('X-JSONPath', getJSONPath(structure));
    res.set('X-Deterministic', useRandom ? 'false' : 'true');

    // Use streaming for large payloads (> 100MB) if structure supports it
    if (sizeKB > STREAMING_THRESHOLD_KB && supportsStreaming(structure)) {
      res.set('X-Streaming', 'true');
      streamJSON(res, structure, recordFormat, sizeKB, useRandom);
    } else {
      // For small payloads or non-streaming structures, generate all at once
      res.set('X-Streaming', 'false');
      
      // Generate record data (deterministic by default)
      const records = generateJSON(recordFormat, sizeKB, useRandom);

      // Apply structure wrapper
      const data = applyStructure(records, structure);

      // Send response
      res.json(data);
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate JSON',
      message: error.message
    });
  }
});

// NDJSON streaming endpoint (visible progressive streaming in browser)
app.get("/stream/ndjson", (req, res) => {
  try {
    const recordFormat = parseInt(req.query['record-format']) || 1;
    const sizeKB = parseFloat(req.query['size']) || 100;
    const useRandom = req.query['random'] === 'true' || req.query['random'] === '1';

    if (sizeKB <= 0 || sizeKB > MAX_SIZE_KB) {
      return res.status(400).json({
        error: `Invalid size parameter. Must be between 1 and ${MAX_SIZE_KB} (1 GB).`
      });
    }
    
    // Memory check disabled - hosting platform manages memory dynamically

    res.set('X-Deterministic', useRandom ? 'false' : 'true');
    streamNDJSON(res, recordFormat, sizeKB, useRandom);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to stream NDJSON',
        message: error.message
      });
    }
  }
});

// Server-Sent Events streaming endpoint (visible progressive streaming in browser)
app.get("/stream/sse", (req, res) => {
  try {
    const recordFormat = parseInt(req.query['record-format']) || 1;
    const sizeKB = parseFloat(req.query['size']) || 100;
    const useRandom = req.query['random'] === 'true' || req.query['random'] === '1';

    if (sizeKB <= 0 || sizeKB > MAX_SIZE_KB) {
      return res.status(400).json({
        error: `Invalid size parameter. Must be between 1 and ${MAX_SIZE_KB} (1 GB).`
      });
    }
    
    // Memory check disabled - hosting platform manages memory dynamically

    res.set('X-Deterministic', useRandom ? 'false' : 'true');
    streamSSE(res, recordFormat, sizeKB, useRandom);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to stream SSE',
        message: error.message
      });
    }
  }
});

const server = app.listen(port, () => console.log(`Server is listening on port ${port}!`));

server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;
