# API Crawler System

A comprehensive system for analyzing, crawling, and persisting API data in a structured format.

## 🌟 Features

1. **Dashboard with cURL Input** - Enter any cURL command to start crawling
2. **cURL Validation** - Test API calls before starting crawl jobs
3. **Configurable Intervals** - Set min/max intervals with randomization
4. **Schema Inference** - Automatically infer database schema from API responses
5. **Dynamic Table Creation** - Create database tables on-the-fly based on API structure
6. **Pagination Detection** - Auto-detect cursor, page-based, and offset pagination
7. **Retry Logic** - Automatic retry (3 attempts) with failure notifications
8. **Real-time Notifications** - Dashboard notifications for job status

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ cURL     │  │ Jobs     │  │ Tables   │  │ Notifications    │ │
│  │ Input    │  │ List     │  │ View     │  │ Panel            │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTP API
┌─────────────────────────────────────────────────────────────────┐
│                       Backend (FastAPI)                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ API Routers: /crawler, /jobs, /tables                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Services:                                                 │   │
│  │  • Curl Parser    - Parse cURL commands                  │   │
│  │  • Pagination     - Detect & handle pagination types     │   │
│  │  • Crawler        - Core crawling logic with retry       │   │
│  │  • Database       - Dynamic table creation & inserts     │   │
│  │  • Scheduler      - Background job scheduling            │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ SQLite Database: crawl_jobs, notifications, dynamic tables│ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTP
┌─────────────────────────────────────────────────────────────────┐
│              Mock Server (Express) - For Testing                 │
│  • Page-based pagination endpoints                               │
│  • Offset-based pagination endpoints                             │
│  • Cursor-based pagination endpoints                             │
│  • Flaky endpoint (tests retry logic)                           │
│  • Authenticated endpoint                                        │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
zed-base/
├── backend/                    # FastAPI Backend
│   ├── app/
│   │   ├── main.py            # Application entry point
│   │   ├── routers/           # API route handlers
│   │   │   ├── crawler.py     # Crawler endpoints
│   │   │   ├── jobs.py        # Job management endpoints
│   │   │   └── tables.py      # Table/data endpoints
│   │   ├── services/          # Business logic
│   │   │   ├── crawler.py     # Core crawling service
│   │   │   ├── curl_parser.py # cURL command parser
│   │   │   ├── database.py    # Database operations
│   │   │   ├── pagination.py  # Pagination detection
│   │   │   └── scheduler.py   # Job scheduling
│   │   └── models/            # Data models
│   │       ├── database.py    # SQLAlchemy models
│   │       └── schemas.py     # Pydantic schemas
│   └── requirements.txt
├── frontend/                   # React Frontend
│   ├── src/
│   │   ├── App.jsx            # Main application
│   │   ├── components/        # React components
│   │   │   ├── CurlInput.jsx  # cURL input form
│   │   │   ├── JobsList.jsx   # Jobs display
│   │   │   ├── TablesView.jsx # Data tables view
│   │   │   └── Notifications.jsx
│   │   ├── services/          # API service
│   │   └── hooks/             # Custom hooks
│   ├── package.json
│   ├── webpack.config.js
│   └── .babelrc
├── mock-server/               # Testing Mock Server
│   ├── server.js              # Express server with test endpoints
│   └── package.json
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Python 3.9+
- Node.js 18+
- npm or yarn

### 1. Start the Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Start the Frontend

```bash
cd frontend
npm install
npm start
# or: npm run dev
```

### 3. Start the Mock Server (for testing)

```bash
cd mock-server
npm install
npm start
```

### 4. Open the Dashboard

Navigate to `http://localhost:3000` in your browser.

## 📖 API Endpoints

### Crawler Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/crawler/validate` | Validate a cURL command |
| POST | `/api/crawler/start` | Start a new crawl job |
| GET | `/api/crawler/notifications` | Get notifications |

### Job Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs/` | List all jobs |
| GET | `/api/jobs/{id}` | Get job details |
| POST | `/api/jobs/{id}/pause` | Pause a job |
| POST | `/api/jobs/{id}/resume` | Resume a job |
| POST | `/api/jobs/{id}/stop` | Stop a job |

### Table Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tables/` | List all tables |
| GET | `/api/tables/{name}` | Get table info |
| GET | `/api/tables/{name}/data` | Get table data |

## 🧪 Testing with Mock Server

The mock server provides various endpoints to test different scenarios:

### Page-Based Pagination

```bash
# Basic page pagination
curl "http://localhost:3001/api/users?page=1&per_page=10"

# Products with limit
curl "http://localhost:3001/api/products?page=1&limit=20"
```

**Response format:**
```json
{
  "data": [...],
  "pagination": {
    "currentPage": 1,
    "perPage": 10,
    "totalPages": 15,
    "totalItems": 150
  }
}
```

### Offset-Based Pagination

```bash
# Posts with offset
curl "http://localhost:3001/api/posts?offset=0&limit=25"

# Orders with skip
curl "http://localhost:3001/api/orders?skip=0&take=15"
```

**Response format:**
```json
{
  "items": [...],
  "meta": {
    "offset": 0,
    "limit": 25,
    "total": 500,
    "has_more": true
  }
}
```

### Cursor-Based Pagination

```bash
# Comments with cursor
curl "http://localhost:3001/api/comments?cursor=0&limit=20"

# Feed with after parameter
curl "http://localhost:3001/api/feed?after=0"

# Events with continuation token
curl "http://localhost:3001/api/events"
```

**Response format:**
```json
{
  "data": [...],
  "next_cursor": "abc123",
  "has_more": true
}
```

### No Pagination (Simple)

```bash
# Categories list
curl "http://localhost:3001/api/categories"

# Config object
curl "http://localhost:3001/api/config"
```

### Special Test Endpoints

```bash
# Flaky endpoint (fails randomly, tests retry logic)
curl "http://localhost:3001/api/flaky?page=1"

# Slow endpoint (delayed response)
curl "http://localhost:3001/api/slow?page=1&delay=3000"

# Authenticated endpoint
curl -X POST "http://localhost:3001/api/auth/data" \
  -H "Authorization: Bearer test-token-123" \
  -H "Content-Type: application/json" \
  -d '{"filter": "active"}'

# Empty results
curl "http://localhost:3001/api/empty"
```

## ⚙️ Configuration Options

When starting a crawl job:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `curl_command` | string | required | The cURL command to execute |
| `table_name` | string | required | Name for the database table |
| `start_interval` | int | 5 | Minimum seconds between requests |
| `end_interval` | int | 15 | Maximum seconds between requests |
| `randomize_interval` | bool | true | Randomize interval between min/max |
| `max_pages` | int | null | Maximum pages to crawl (null = unlimited) |
| `start_date` | datetime | null | Start crawling at this date |
| `end_date` | datetime | null | Stop crawling at this date |

## 🔄 Pagination Detection

The system automatically detects pagination types:

### Page-Based
Detects parameters: `page`, `p`, `pageNumber`, `page_number`

### Offset-Based
Detects parameters: `offset`, `skip`, `start`

### Cursor-Based
Detects parameters/fields: `cursor`, `after`, `next_token`, `continuation`
Also checks response for: `next_cursor`, `nextToken`, `links.next`

## 🔁 Retry Logic

- **Max Retries:** 3 attempts per request
- **Backoff:** Exponential (2^attempt seconds)
- **On Failure:** Job marked as failed, notification sent to dashboard

## 📊 Schema Inference

The system infers SQL column types from JSON data:

| JSON Type | SQL Type |
|-----------|----------|
| string | TEXT |
| integer | INTEGER |
| float/number | REAL |
| boolean | INTEGER (0/1) |
| object/array | TEXT (JSON string) |
| null | TEXT |

## 🔒 Security Notes

- cURL commands are stored in the database (avoid sensitive tokens in production)
- The system supports Bearer token authentication in cURL headers
- CORS is configured for localhost:3000 development only

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check if port 8000 is in use
lsof -i :8000

# Install missing dependencies
pip install -r requirements.txt
```

### Frontend connection issues
```bash
# Ensure backend is running on port 8000
# Check browser console for CORS errors
```

### Mock server issues
```bash
# Ensure port 3001 is available
lsof -i :3001

# Reinstall dependencies
rm -rf node_modules && npm install
```

## 📝 License

MIT License - See LICENSE file for details