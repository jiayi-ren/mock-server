# Consuming Streaming Endpoints

This guide shows how to consume the different streaming endpoints with various HTTP clients.

## Quick Summary

| Endpoint | Format | Client Support | Use Case |
|----------|--------|----------------|----------|
| `/json` | JSON Array | All (but buffers) | Standard API, memory-efficient server |
| `/stream/ndjson` | NDJSON | Streaming clients | Progressive processing |
| `/stream/sse` | Server-Sent Events | EventSource, streaming clients | Real-time updates |

## Endpoint Comparison

### `/json` - Chunked Transfer (HTTP/1.1)

**How it works:**
- Server sends data in chunks using `Transfer-Encoding: chunked`
- Memory efficient on server (generates 1GB on 512MB RAM)
- **But**: Clients must buffer entire response before parsing JSON array

**When to use:**
- Standard REST API consumption
- You want a complete JSON array
- Server memory efficiency is important

**Client behavior:**
```javascript
// Even with streaming, you get data all at once:
const response = await fetch('/json?size=100000');
const data = await response.json(); // Waits for complete response
console.log(data); // Complete array
```

### `/stream/ndjson` - Newline Delimited JSON

**How it works:**
- Each record is a separate JSON object on its own line
- Client can process records as they arrive
- True progressive streaming

**When to use:**
- Processing large datasets progressively
- Want to start processing before download completes
- Building real-time dashboards

**Format:**
```
{"id":1,"name":"Record 1"}
{"id":2,"name":"Record 2"}
{"id":3,"name":"Record 3"}
```

**Client behavior:**
```javascript
const response = await fetch('/stream/ndjson?size=100000');
const reader = response.body.getReader();
const decoder = new TextDecoder();

let buffer = '';
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop(); // Keep incomplete line
  
  for (const line of lines) {
    if (line.trim()) {
      const record = JSON.parse(line);
      processRecord(record); // Process immediately!
    }
  }
}
```

### `/stream/sse` - Server-Sent Events

**How it works:**
- Standard SSE protocol (text/event-stream)
- Built-in browser support with EventSource API
- Automatic reconnection on disconnect

**When to use:**
- Real-time updates in browser
- Want built-in reconnection
- Standard SSE tooling

**Format:**
```
data: {"id":1,"name":"Record 1"}

data: {"id":2,"name":"Record 2"}

event: done
data: {"status":"complete"}
```

**Client behavior (Browser):**
```javascript
const eventSource = new EventSource('/stream/sse?size=100000');

eventSource.onmessage = (event) => {
  const record = JSON.parse(event.data);
  processRecord(record); // Process immediately!
};

eventSource.addEventListener('done', () => {
  eventSource.close();
});
```

## Client Examples

### 1. Native Node.js (http/https)

**Best for:** Server-side consumption, full control

```javascript
const http = require('http');

http.get('http://localhost:3001/stream/ndjson?size=10000', (res) => {
  let buffer = '';
  
  res.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();
    
    for (const line of lines) {
      if (line.trim()) {
        const record = JSON.parse(line);
        console.log(record);
      }
    }
  });
  
  res.on('end', () => {
    console.log('Stream complete');
  });
});
```

### 2. Fetch API (Node.js 18+ / Browser)

**Best for:** Modern JavaScript, cross-platform

```javascript
async function consumeStream() {
  const response = await fetch('http://localhost:3001/stream/ndjson?size=10000');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    
    for (const line of lines) {
      if (line.trim()) {
        const record = JSON.parse(line);
        console.log(record);
      }
    }
  }
}
```

### 3. Axios (with responseType: 'stream')

**Best for:** Node.js with axios already installed

```javascript
const axios = require('axios');

async function consumeStream() {
  const response = await axios({
    method: 'get',
    url: 'http://localhost:3001/stream/ndjson?size=10000',
    responseType: 'stream' // Important!
  });

  let buffer = '';
  
  response.data.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();
    
    for (const line of lines) {
      if (line.trim()) {
        const record = JSON.parse(line);
        console.log(record);
      }
    }
  });
  
  await new Promise((resolve) => {
    response.data.on('end', resolve);
  });
}
```

**⚠️ Warning:** Without `responseType: 'stream'`, axios buffers everything!

### 4. EventSource (Browser only, SSE)

**Best for:** Browser-based real-time updates

```javascript
const eventSource = new EventSource('http://localhost:3001/stream/sse?size=10000');

eventSource.onmessage = (event) => {
  const record = JSON.parse(event.data);
  console.log(record);
};

eventSource.addEventListener('done', () => {
  console.log('Stream complete');
  eventSource.close();
});

eventSource.onerror = (error) => {
  console.error('Stream error:', error);
  eventSource.close();
};
```

### 5. curl (Command line)

**NDJSON:**
```bash
curl -N http://localhost:3001/stream/ndjson?size=10000

# Process line by line
curl -N http://localhost:3001/stream/ndjson?size=10000 | while read line; do
  echo "Record: $line"
done
```

**SSE:**
```bash
curl -N http://localhost:3001/stream/sse?size=10000
```

**Regular JSON (chunked but buffered):**
```bash
curl http://localhost:3001/json?size=10000
```

## Performance Comparison

### Memory Usage (Client Side)

| Method | Memory Usage | Processing Start |
|--------|--------------|------------------|
| `/json` | Full dataset in memory | After complete download |
| `/stream/ndjson` | Only current record | Immediately |
| `/stream/sse` | Only current record | Immediately |

### Example: 500MB Dataset

**Using `/json`:**
- Client memory: ~500MB
- Time to first record: 30 seconds (full download)
- Total time: 30 seconds

**Using `/stream/ndjson`:**
- Client memory: ~1KB (per record)
- Time to first record: 100ms
- Total time: 30 seconds (but processing starts immediately)

## Common Patterns

### Pattern 1: Process and Discard

```javascript
// Good for large datasets - process without storing
let totalAmount = 0;
let recordCount = 0;

for await (const record of streamRecords('/stream/ndjson?size=500000')) {
  totalAmount += record.decimal_amount;
  recordCount++;
  // Record is garbage collected after this iteration
}

console.log(`Average: ${totalAmount / recordCount}`);
```

### Pattern 2: Filter and Collect

```javascript
// Only keep records that match criteria
const filtered = [];

for await (const record of streamRecords('/stream/ndjson?size=500000')) {
  if (record.decimal_amount > 1000) {
    filtered.push(record);
  }
}

console.log(`Found ${filtered.length} high-value records`);
```

### Pattern 3: Real-time Display

```javascript
// Update UI as data arrives
const eventSource = new EventSource('/stream/sse?size=100000');

eventSource.onmessage = (event) => {
  const record = JSON.parse(event.data);
  addToTable(record); // Update UI immediately
  updateStats(record); // Update dashboard
};
```

## Testing

Run the examples:

```bash
# Make sure server is running
npm start

# In another terminal
node examples/consume-streams.js
```

This will demonstrate all consumption methods with actual streaming data.

## Best Practices

1. **Always buffer incomplete data** - NDJSON and SSE may split in the middle of a record
2. **Handle errors gracefully** - Network issues can interrupt streams
3. **Use appropriate format**:
   - `/json` - Standard REST API clients
   - `/stream/ndjson` - Large dataset processing
   - `/stream/sse` - Real-time browser updates
4. **Set timeouts** - Streams can run for a long time
5. **Process incrementally** - Don't store everything in memory

## Troubleshooting

### "Response buffered entirely"

**Problem:** Client waits for complete response despite streaming endpoint

**Solution:** 
- Use `responseType: 'stream'` in axios
- Use `response.body.getReader()` in fetch
- Use `res.on('data')` in Node.js http

### "Incomplete JSON parse error"

**Problem:** Trying to parse incomplete records

**Solution:** Buffer data until you have a complete line (NDJSON) or message (SSE)

### "Memory usage still high"

**Problem:** Storing all records in an array

**Solution:** Process and discard records, don't accumulate them

## Further Reading

- [NDJSON Specification](http://ndjson.org/)
- [Server-Sent Events (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Streams API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API)

