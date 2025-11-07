# Mock Server

A flexible Express-based mock server that generates JSON test data with configurable structures and sizes. Perfect for testing CSV conversion via JSONPath, API mocking, and data format testing.

## Features

- **CORS Enabled**: All endpoints support Cross-Origin Resource Sharing
- **Dynamic JSON Generation**: Generate JSON payloads on-demand
- **9 Different JSON Structures**: From flat arrays to deep nested objects, array of arrays, and columnar format
- **Consistent Field Types**: All records include integers, decimals, booleans, strings with special characters, nested objects, and arrays
- **Flexible Sizing**: Generate payloads from 1 KB up to 64 MB
- **CSV-Friendly**: All structures include JSONPath expressions for easy CSV conversion

## Installation

```bash
npm install
```

## Usage

Start the server:

```bash
npm start
```

The server will run on port 3001 by default (configurable via `PORT` environment variable).

Visit `http://localhost:3001` for interactive documentation.

## API Endpoints

### GET /json

Generates and returns JSON data based on query parameters.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `structure` | 1-9 | 1 | JSON structure format - how tabular data is represented |
| `record-format` | 1-3 | 1 | (Kept for compatibility - currently all return same fields) |
| `size` | number | 10 | Target size in KB (1 - 65536 KB / 64 MB) |
| `random` | boolean | false | If true, use random values; if false (default), use deterministic values |

**Important:** By default, responses are **deterministic** - the same query parameters will always return identical data. This is useful for:
- Testing and reproducibility
- Caching
- Comparing outputs
- Consistent benchmarking

Set `random=true` to get different data on each request.

#### Structure Formats

Different ways to represent the same tabular data in JSON:

| # | Format | JSONPath | Example |
|---|--------|----------|---------|
| 1 | Flat array of objects | `$[*]` | `[{id:1, name:"John"}, ...]` |
| 2 | Object with data property | `$.data[*]` | `{data: [{id:1}, ...]}` |
| 3 | Nested object (custom key) | `$.race.entries[*]` | `{race: {entries: [...]}}` |
| 4 | Array of arrays | `$[*]` | `[[1,"John",100], [2,"Jane",200]]` |
| 5 | Columnar (properties as arrays) | N/A | `{id:[1,2], name:["John","Jane"]}` |
| 6 | With metadata | `$.data[*]` | `{metadata:{...}, data:[...]}` |
| 7 | Paginated REST API | `$.data[*]` | `{data:[...], links:{...}, meta:{...}}` |
| 8 | Grouped/categorized | `$.groups.*[*]` | `{groups: {cat1:[...], cat2:[...]}}` |
| 9 | Deep nested (3 levels) | `$.api.response.payload.records[*]` | `{api:{response:{payload:{records:[...]}}}}` |

#### Record Fields

All records contain the same fields with type-indicating names:

| Field Name | Type | Description |
|------------|------|-------------|
| `int_id` | Integer | Unique ID number |
| `string_name` | String | Name with special characters (commas, quotes, ampersands, apostrophes) |
| `decimal_amount` | Decimal | Monetary amount or value |
| `bool_active` | Boolean | Active/inactive status |
| `string_remark` | String | Notes/remarks (may be empty, may contain newlines) |
| `string_category` | String | Category/classification |
| `string_timestamp` | String (ISO) | ISO 8601 timestamp |
| `int_count` | Integer | Count/quantity |
| `decimal_rate` | Decimal | Rate/percentage |
| `string_status` | String | Status level (INFO, WARN, ERROR, DEBUG) |
| `object_metadata` | Object | Nested metadata object |
| `array_tags` | Array | Array of tag strings |
| `string_location` | String | Location/city name |
| `string_description` | String | Description with special characters and newlines |

#### Examples

```bash
# Default: 10KB, flat array of objects (deterministic)
curl http://localhost:3001/json

# Same request will return EXACTLY the same data
curl http://localhost:3001/json

# Array of arrays (no property names) - 5KB
curl http://localhost:3001/json?structure=4&size=5

# Columnar format (most space-efficient) - 10KB
curl http://localhost:3001/json?structure=5&size=10

# With data wrapper - 20KB
curl http://localhost:3001/json?structure=2&size=20

# Nested structure (race.entries) - 15KB
curl http://localhost:3001/json?structure=3&size=15

# Grouped by category - 50KB
curl http://localhost:3001/json?structure=8&size=50

# Deep nested API response - 100KB
curl http://localhost:3001/json?structure=9&size=100

# Random data (different on each request)
curl http://localhost:3001/json?random=true

# Random 50KB columnar data
curl http://localhost:3001/json?structure=5&size=50&random=true
```

#### Response Headers

The API includes helpful headers:

- `X-JSONPath`: JSONPath expression to extract records from the response structure
- `X-Deterministic`: `true` if response is deterministic, `false` if random

```bash
curl -I http://localhost:3001/json?structure=3
# X-JSONPath: $.race.entries[*]
# X-Deterministic: true

curl -I http://localhost:3001/json?random=true
# X-Deterministic: false
```

### GET /health

Health check endpoint.

```bash
curl http://localhost:3001/health
# {"status":"ok"}
```

### GET /

Returns an interactive HTML documentation page with examples and clickable links.

## Structure Examples

### Structure 1: Flat Array of Objects
```json
[
  {
    "int_id": 1,
    "string_name": "Johnson, Smith, and Jones Co.",
    "decimal_amount": 345.33,
    "bool_active": true,
    "string_remark": "Pays on time",
    ...
  },
  {
    "int_id": 2,
    "string_name": "Sam \"Mad Dog\" Smith",
    "decimal_amount": 993.44,
    "bool_active": false,
    "string_remark": "",
    ...
  }
]
```

### Structure 2: Object with Data Property
```json
{
  "data": [
    {"int_id": 1, "string_name": "Johnson, Smith, and Jones Co.", ...},
    {"int_id": 2, "string_name": "Sam \"Mad Dog\" Smith", ...}
  ]
}
```

### Structure 3: Nested Object (race.entries)
```json
{
  "race": {
    "entries": [
      {"int_id": 11, "string_name": "Johnson, Smith, and Jones Co.", ...},
      {"int_id": 22, "string_name": "Sam \"Mad Dog\" Smith", ...}
    ]
  }
}
```

### Structure 4: Array of Arrays
```json
[
  [1, "Johnson, Smith, and Jones Co.", 345.33, true, "Pays on time", ...],
  [2, "Sam \"Mad Dog\" Smith", 993.44, false, "", ...]
]
```

### Structure 5: Columnar Format
```json
{
  "int_id": [1, 2, 3, 4],
  "string_name": [
    "Johnson, Smith, and Jones Co.",
    "Sam \"Mad Dog\" Smith",
    "Barney & Company",
    "Johnson's Automotive"
  ],
  "decimal_amount": [345.33, 993.44, 0, 2344],
  "bool_active": [true, false, true, true],
  "string_remark": ["Pays on time", "", "Great to work with\nand always pays with cash.", ""],
  ...
}
```

### Structure 6: With Metadata
```json
{
  "metadata": {
    "timestamp": "2024-11-07T10:30:00.000Z",
    "version": "1.0",
    "record_count": 100
  },
  "data": [
    {"int_id": 1, "string_name": "Johnson, Smith, and Jones Co.", ...}
  ]
}
```

### Structure 7: Paginated REST API
```json
{
  "data": [
    {"int_id": 1, "string_name": "Johnson, Smith, and Jones Co.", ...}
  ],
  "links": {
    "self": "/json",
    "first": "/json?page=1",
    "last": "/json?page=1"
  },
  "meta": {
    "current_page": 1,
    "per_page": 100,
    "total": 100
  }
}
```

### Structure 8: Grouped/Categorized
```json
{
  "groups": {
    "Electronics": [
      {"int_id": 1, "string_name": "...", "string_category": "Electronics", ...}
    ],
    "Clothing": [
      {"int_id": 2, "string_name": "...", "string_category": "Clothing", ...}
    ]
  },
  "summary": {
    "total_records": 100,
    "group_count": 5
  }
}
```

### Structure 9: Deep Nested
```json
{
  "api": {
    "version": "v1",
    "endpoint": "/json",
    "response": {
      "status": "ok",
      "code": 200,
      "payload": {
        "records": [
          {"int_id": 1, "string_name": "...", ...}
        ],
        "metadata": {
          "count": 100
        }
      }
    }
  }
}
```

## CSV Conversion

All structures (except columnar) are designed to work with JSONPath for CSV conversion. Use the provided JSONPath expressions with tools like:

- `jq` (command line)
- `jsonpath` libraries (Python, JavaScript, etc.)
- Online JSON to CSV converters

### Examples with jq

```bash
# Extract records from Structure 1 (flat array)
curl http://localhost:3001/json?structure=1&size=5 | jq '.[]'

# Extract records from Structure 3 (nested)
curl http://localhost:3001/json?structure=3&size=5 | jq '.race.entries[]'

# Convert Structure 1 to CSV format
curl http://localhost:3001/json?structure=1&size=5 | \
  jq -r '.[] | [.int_id, .string_name, .decimal_amount] | @csv'

# Extract from grouped structure
curl http://localhost:3001/json?structure=8&size=10 | jq '.groups[] | .[]'
```

## Special Characters Handling

The generated data includes various special characters to test CSV conversion edge cases:

- **Commas**: `"Johnson, Smith, and Jones Co."`
- **Quotes**: `"Sam \"Mad Dog\" Smith"`
- **Ampersands**: `"Barney & Company"`
- **Apostrophes**: `"Johnson's Automotive"`
- **Newlines**: `"Great to work with\nand always pays with cash."`
- **Empty strings**: `""`
- **Special symbols**: `@#$%^&*()`

## Error Responses

- `400 Bad Request`: Invalid parameter values
- `500 Internal Server Error`: Failed to generate JSON

## License

MIT
