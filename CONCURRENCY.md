# Concurrency Configuration Guide

## Dynamic Concurrency Limits

The server now **automatically adjusts** concurrent request limits based on request size!

### Current Configuration (512MB RAM)

| Request Size | Max Concurrent | Memory Usage | Reasoning |
|--------------|----------------|--------------|-----------|
| < 10 MB | **10 requests** | ~250 MB | Small requests, low memory |
| 10-30 MB | **5 requests** | ~225-375 MB | Medium requests |
| 30-50 MB | **3 requests** | ~225-375 MB | Large requests |
| 50-100 MB | **2 requests** | ~200-250 MB | Very large, non-streaming |
| > 100 MB | **5 requests** | ~150-200 MB | Streaming mode (efficient!) |

## How It Works

```javascript
function getMaxConcurrentForSize(sizeKB) {
  if (sizeKB < 10240) return 10;      // <10MB: allow 10 concurrent
  if (sizeKB < 30720) return 5;       // 10-30MB: allow 5 concurrent
  if (sizeKB < 51200) return 3;       // 30-50MB: allow 3 concurrent
  if (sizeKB < 102400) return 2;      // 50-100MB: allow 2 concurrent
  return 5;                            // >100MB with streaming: allow 5
}
```

## Examples

### ✅ Allowed: 5 concurrent 30MB requests

```bash
# These will all succeed (5 concurrent allowed for 30MB)
curl http://localhost:3001/json?size=30000 &
curl http://localhost:3001/json?size=30000 &
curl http://localhost:3001/json?size=30000 &
curl http://localhost:3001/json?size=30000 &
curl http://localhost:3001/json?size=30000 &
```

### ❌ Rejected: 6th concurrent 30MB request

```bash
# This 6th request will get 503 error
curl http://localhost:3001/json?size=30000 &  # Rejected!
```

**Response:**
```json
{
  "error": "Server busy",
  "message": "Too many concurrent requests for this size. Max: 5. Please try again in a moment.",
  "activeRequests": 5,
  "maxAllowed": 5,
  "requestSizeKB": 30000
}
```

### ✅ Allowed: 10 concurrent 5MB requests

```bash
# Small requests allow more concurrency
for i in {1..10}; do
  curl http://localhost:3001/json?size=5000 &
done
# All 10 succeed!
```

### ✅ Allowed: 5 concurrent 200MB streaming requests

```bash
# Streaming is memory-efficient, allows more concurrency
for i in {1..5}; do
  curl http://localhost:3001/json?size=200000 &
done
# All 5 succeed because streaming uses less memory!
```

## Environment Variable Override

You can set a fixed limit if you prefer:

```bash
# Set fixed limit (ignores dynamic sizing)
export MAX_CONCURRENT_REQUESTS=5
npm start
```

Or in your hosting platform:
```
MAX_CONCURRENT_REQUESTS=5
```

## Monitoring Concurrency

### Check current active requests:

```bash
curl http://localhost:3001/health
```

```json
{
  "status": "ok",
  "memory": {
    "heapUsedMB": 120,
    "heapTotalMB": 400,
    "heapUsagePercent": 30,
    "rssMB": 180
  },
  "activeRequests": 3,  // ← Current concurrent requests
  "uptime": 3600
}
```

### Load testing:

```bash
# Test with Apache Bench
ab -n 100 -c 10 "http://localhost:3001/json?size=10000"

# Test with wrk
wrk -t4 -c10 -d30s "http://localhost:3001/json?size=10000"
```

## Tuning for Different RAM Sizes

### 256MB RAM (Minimal)
```javascript
if (sizeKB < 10240) return 5;       // <10MB: 5 concurrent
if (sizeKB < 30720) return 2;       // 10-30MB: 2 concurrent
if (sizeKB < 51200) return 1;       // 30-50MB: 1 concurrent
if (sizeKB < 102400) return 1;      // 50-100MB: 1 concurrent
return 3;                            // >100MB streaming: 3 concurrent
```

### 512MB RAM (Current)
```javascript
if (sizeKB < 10240) return 10;      // <10MB: 10 concurrent
if (sizeKB < 30720) return 5;       // 10-30MB: 5 concurrent
if (sizeKB < 51200) return 3;       // 30-50MB: 3 concurrent
if (sizeKB < 102400) return 2;      // 50-100MB: 2 concurrent
return 5;                            // >100MB streaming: 5 concurrent
```

### 1GB RAM
```javascript
if (sizeKB < 10240) return 20;      // <10MB: 20 concurrent
if (sizeKB < 30720) return 10;      // 10-30MB: 10 concurrent
if (sizeKB < 51200) return 6;       // 30-50MB: 6 concurrent
if (sizeKB < 102400) return 4;      // 50-100MB: 4 concurrent
return 10;                           // >100MB streaming: 10 concurrent
```

### 2GB+ RAM
```javascript
if (sizeKB < 10240) return 50;      // <10MB: 50 concurrent
if (sizeKB < 30720) return 20;      // 10-30MB: 20 concurrent
if (sizeKB < 51200) return 12;      // 30-50MB: 12 concurrent
if (sizeKB < 102400) return 8;      // 50-100MB: 8 concurrent
return 20;                           // >100MB streaming: 20 concurrent
```

## Best Practices

### 1. Monitor Memory Usage

```bash
# Watch memory in real-time
watch -n 1 'curl -s http://localhost:3001/health | jq ".memory"'
```

If `heapUsagePercent` consistently > 70%, reduce concurrent limits.

### 2. Use Streaming for Large Requests

```bash
# Instead of this (uses more memory):
curl http://localhost:3001/json?size=50000

# Use this (memory efficient):
curl http://localhost:3001/json?size=150000  # Auto-streams >100MB
```

### 3. Implement Client-Side Retry

```javascript
async function fetchWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url);
    
    if (response.status === 503) {
      // Server busy, wait and retry
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      continue;
    }
    
    return response;
  }
  
  throw new Error('Max retries exceeded');
}
```

### 4. Use Request Queuing (Client-Side)

```javascript
// Queue requests instead of sending all at once
const queue = [];
let active = 0;
const MAX_CONCURRENT = 5;

async function queueRequest(url) {
  if (active >= MAX_CONCURRENT) {
    await new Promise(resolve => queue.push(resolve));
  }
  
  active++;
  try {
    return await fetch(url);
  } finally {
    active--;
    if (queue.length > 0) {
      queue.shift()();
    }
  }
}
```

## Troubleshooting

### Getting too many 503 errors?

**Option 1:** Reduce request size
```bash
# Instead of 50MB
curl http://localhost:3001/json?size=50000

# Try 30MB
curl http://localhost:3001/json?size=30000
```

**Option 2:** Increase concurrent limit (if you have more RAM)
```bash
export MAX_CONCURRENT_REQUESTS=10
```

**Option 3:** Add retry logic in your client

**Option 4:** Upgrade to more RAM

### Server still crashing?

1. Check actual memory usage:
   ```bash
   curl http://localhost:3001/health
   ```

2. Reduce limits further:
   ```javascript
   // In app.js, reduce all limits by 50%
   if (sizeKB < 10240) return 5;   // Was 10
   if (sizeKB < 30720) return 2;   // Was 5
   // etc.
   ```

3. Use PM2 with memory limits:
   ```bash
   pm2 start app.js --max-memory-restart 400M
   ```

## Summary

**For your 30MB requests on 512MB RAM:**

- ✅ **Max 5 concurrent requests** (automatically enforced)
- ✅ **~375 MB total memory usage** (safe)
- ✅ **Automatic rejection** when limit exceeded
- ✅ **Clear error messages** to clients

The server will now handle concurrency intelligently based on request size! 🎯

