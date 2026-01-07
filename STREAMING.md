# Streaming Implementation Guide

## Overview

The mock server now supports **streaming for large JSON payloads**, allowing you to generate and serve **1GB responses on a 512MB RAM host**.

## How It Works

### Automatic Streaming Threshold

- **≤ 100 MB**: Generated in-memory (traditional approach)
- **> 100 MB**: Automatically streamed in chunks

### Memory Efficiency

Instead of building the entire JSON in memory:

```
Traditional (100MB payload):
RAM Usage: ~250-300 MB (records + JSON string + response buffer)

Streaming (1GB payload):
RAM Usage: ~50-100 MB (only current chunk in memory)
```

### Implementation Details

1. **Chunked Generation**: Records are generated in 10MB chunks
2. **Immediate Streaming**: Each chunk is sent to the client as soon as it's ready
3. **Structure Wrapping**: JSON structure prefix/suffix added around streamed records
4. **Transfer-Encoding**: Uses HTTP chunked transfer encoding

## Structure Support

### ✅ Streaming Supported (Structures 1-4, 6-7, 9)

These structures can wrap an array of records, allowing streaming:

- **Structure 1**: Flat array `[{...}, {...}]`
- **Structure 2**: Data wrapper `{"data": [{...}]}`
- **Structure 3**: Nested `{"race": {"entries": [{...}]}}`
- **Structure 4**: Array of arrays `[[...], [...]]`
- **Structure 6**: With metadata `{"metadata": {...}, "data": [{...}]}`
- **Structure 7**: Paginated API `{"data": [{...}], "links": {...}}`
- **Structure 9**: Deep nested `{"api": {"response": {"payload": {"records": [{...}]}}}}`

### ❌ Streaming NOT Supported (Structures 5, 8)

These structures require all records in memory:

- **Structure 5**: Columnar format - needs to transpose all data
- **Structure 8**: Grouped data - needs to categorize all records

For these structures, the 100MB limit still applies.

## Configuration

### Server Configuration

**package.json**:
```json
{
  "scripts": {
    "start": "node --max-old-space-size=400 app.js"
  }
}
```

- `--max-old-space-size=400`: Limits Node.js heap to 400MB
- Leaves ~100MB for OS and other processes on 512MB hosts

### Streaming Threshold

**app.js**:
```javascript
const STREAMING_THRESHOLD_KB = 102400; // 100 MB
```

Adjust this value if needed based on your host's RAM.

## API Usage

### Response Headers

The API includes a new header to indicate streaming status:

```bash
curl -I http://localhost:3001/json?size=200000

# Response headers:
X-JSONPath: $[*]
X-Deterministic: true
X-Streaming: true              # ← New header
Transfer-Encoding: chunked     # ← HTTP chunked transfer
```

### Examples

```bash
# Small payload - no streaming (fast)
curl http://localhost:3001/json?size=10

# Medium payload - no streaming
curl http://localhost:3001/json?size=50000

# Large payload - automatic streaming (works on 512MB RAM!)
curl http://localhost:3001/json?size=500000

# 1GB payload with nested structure
curl http://localhost:3001/json?structure=3&size=1000000

# Columnar format - limited to 100MB (no streaming support)
curl http://localhost:3001/json?structure=5&size=50000
```

## Testing

Run the included test suite:

```bash
# Terminal 1: Start server
npm start

# Terminal 2: Run tests
npm test
```

The test verifies:
1. Small payloads don't trigger streaming
2. Medium payloads don't trigger streaming
3. Large payloads automatically stream
4. Non-streaming structures respect the 100MB limit

## Performance Characteristics

### Time to First Byte (TTFB)

- **Traditional**: Wait for entire payload generation
- **Streaming**: Immediate (first chunk sent right away)

### Memory Usage

| Payload Size | Traditional RAM | Streaming RAM |
|--------------|----------------|---------------|
| 10 MB        | ~30 MB         | ~30 MB        |
| 100 MB       | ~250 MB        | ~250 MB       |
| 500 MB       | ~1.2 GB ❌     | ~100 MB ✅    |
| 1 GB         | ~2.5 GB ❌     | ~100 MB ✅    |

### Generation Speed

Streaming adds minimal overhead (~5-10%) due to:
- Chunked generation
- Multiple JSON.stringify calls
- HTTP chunked encoding

## Limitations

1. **Non-streaming structures** (5, 8) still limited to 100MB
2. **Deterministic mode** with streaming may have slight variations in final size
3. **Very large payloads** (>1GB) may take several minutes to generate

## Troubleshooting

### Out of Memory Errors

If you still get OOM errors:

1. **Reduce streaming threshold**:
   ```javascript
   const STREAMING_THRESHOLD_KB = 51200; // 50 MB
   ```

2. **Reduce chunk size**:
   ```javascript
   streamJSON(res, structure, recordFormat, sizeKB, useRandom, 5120); // 5MB chunks
   ```

3. **Increase heap size** (if you have more RAM):
   ```json
   "start": "node --max-old-space-size=800 app.js"
   ```

### Slow Response Times

For very large payloads (>500MB):

- This is expected - generation takes time
- Client will receive data progressively
- Consider reducing payload size or using pagination

## Future Improvements

Potential enhancements:

1. **Streaming for Structure 5** (columnar): Transpose in chunks
2. **Streaming for Structure 8** (grouped): Stream by group
3. **Configurable chunk size**: Add query parameter
4. **Progress headers**: Send X-Progress header with each chunk
5. **Compression**: Add gzip streaming support

