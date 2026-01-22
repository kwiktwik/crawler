/**
 * Mock API Server for Testing API Crawler
 * 
 * This server provides various endpoints to test different pagination types
 * and scenarios.
 */

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

// ============================================
// SAMPLE DATA
// ============================================

const generateUsers = (count) => {
  const users = [];
  for (let i = 1; i <= count; i++) {
    users.push({
      id: i,
      name: `User ${i}`,
      email: `user${i}@example.com`,
      age: 20 + (i % 50),
      city: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'][i % 5],
      created_at: new Date(Date.now() - i * 86400000).toISOString()
    });
  }
  return users;
};

const generateProducts = (count) => {
  const products = [];
  const categories = ['Electronics', 'Clothing', 'Books', 'Home', 'Sports'];
  for (let i = 1; i <= count; i++) {
    products.push({
      id: i,
      name: `Product ${i}`,
      description: `Description for product ${i}`,
      price: parseFloat((Math.random() * 1000).toFixed(2)),
      category: categories[i % 5],
      in_stock: i % 3 !== 0,
      rating: parseFloat((Math.random() * 5).toFixed(1))
    });
  }
  return products;
};

const generatePosts = (count) => {
  const posts = [];
  for (let i = 1; i <= count; i++) {
    posts.push({
      id: i,
      title: `Post Title ${i}`,
      body: `This is the body content for post ${i}. It contains some sample text.`,
      author_id: (i % 10) + 1,
      likes: Math.floor(Math.random() * 1000),
      comments_count: Math.floor(Math.random() * 100),
      published_at: new Date(Date.now() - i * 3600000).toISOString()
    });
  }
  return posts;
};

// Generate datasets
const USERS = generateUsers(150);
const PRODUCTS = generateProducts(200);
const POSTS = generatePosts(500);

// ============================================
// PAGE-BASED PAGINATION ENDPOINTS
// ============================================

/**
 * GET /api/users
 * Page-based pagination with page and per_page parameters
 * 
 * Example cURL:
 * curl "http://localhost:3001/api/users?page=1&per_page=10"
 */
app.get('/api/users', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const perPage = parseInt(req.query.per_page) || 10;
  
  const startIndex = (page - 1) * perPage;
  const endIndex = startIndex + perPage;
  const paginatedUsers = USERS.slice(startIndex, endIndex);
  
  res.json({
    data: paginatedUsers,
    pagination: {
      currentPage: page,
      perPage: perPage,
      totalPages: Math.ceil(USERS.length / perPage),
      totalItems: USERS.length
    }
  });
});

/**
 * GET /api/products
 * Page-based pagination with page and limit parameters
 * 
 * Example cURL:
 * curl "http://localhost:3001/api/products?page=1&limit=20"
 */
app.get('/api/products', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedProducts = PRODUCTS.slice(startIndex, endIndex);
  
  const totalPages = Math.ceil(PRODUCTS.length / limit);
  
  res.json({
    results: paginatedProducts,
    page: page,
    total_pages: totalPages,
    total_count: PRODUCTS.length,
    has_more: page < totalPages
  });
});

// ============================================
// OFFSET-BASED PAGINATION ENDPOINTS
// ============================================

/**
 * GET /api/posts
 * Offset-based pagination with offset and limit parameters
 * 
 * Example cURL:
 * curl "http://localhost:3001/api/posts?offset=0&limit=25"
 */
app.get('/api/posts', (req, res) => {
  const offset = parseInt(req.query.offset) || 0;
  const limit = parseInt(req.query.limit) || 25;
  
  const paginatedPosts = POSTS.slice(offset, offset + limit);
  
  res.json({
    items: paginatedPosts,
    meta: {
      offset: offset,
      limit: limit,
      total: POSTS.length,
      has_more: offset + limit < POSTS.length
    }
  });
});

/**
 * GET /api/orders
 * Offset pagination with skip parameter
 * 
 * Example cURL:
 * curl "http://localhost:3001/api/orders?skip=0&take=15"
 */
app.get('/api/orders', (req, res) => {
  const skip = parseInt(req.query.skip) || 0;
  const take = parseInt(req.query.take) || 15;
  
  // Generate orders on the fly
  const orders = [];
  for (let i = skip; i < Math.min(skip + take, 100); i++) {
    orders.push({
      id: `ORD-${1000 + i}`,
      customer_id: (i % 20) + 1,
      total: parseFloat((Math.random() * 500 + 50).toFixed(2)),
      status: ['pending', 'processing', 'shipped', 'delivered'][i % 4],
      created_at: new Date(Date.now() - i * 7200000).toISOString()
    });
  }
  
  res.json({
    data: orders,
    skip: skip,
    take: take,
    total: 100
  });
});

// ============================================
// CURSOR-BASED PAGINATION ENDPOINTS
// ============================================

/**
 * GET /api/comments
 * Cursor-based pagination with next_cursor in response
 * 
 * Example cURL:
 * curl "http://localhost:3001/api/comments?cursor=0&limit=20"
 */
app.get('/api/comments', (req, res) => {
  const cursor = parseInt(req.query.cursor) || 0;
  const limit = parseInt(req.query.limit) || 20;
  
  const comments = [];
  for (let i = cursor; i < Math.min(cursor + limit, 300); i++) {
    comments.push({
      id: i + 1,
      post_id: (i % 50) + 1,
      user_id: (i % 30) + 1,
      content: `This is comment ${i + 1}. Great post!`,
      created_at: new Date(Date.now() - i * 1800000).toISOString()
    });
  }
  
  const nextCursor = cursor + limit < 300 ? cursor + limit : null;
  
  res.json({
    data: comments,
    next_cursor: nextCursor,
    has_more: nextCursor !== null
  });
});

/**
 * GET /api/feed
 * Cursor-based pagination with next URL
 * 
 * Example cURL:
 * curl "http://localhost:3001/api/feed?after=0"
 */
app.get('/api/feed', (req, res) => {
  const after = parseInt(req.query.after) || 0;
  const limit = 15;
  
  const items = [];
  for (let i = after; i < Math.min(after + limit, 200); i++) {
    items.push({
      id: `feed_${i + 1}`,
      type: ['post', 'photo', 'video', 'link'][i % 4],
      content: `Feed item ${i + 1} content`,
      author: `Author ${(i % 20) + 1}`,
      timestamp: new Date(Date.now() - i * 900000).toISOString()
    });
  }
  
  const nextAfter = after + limit < 200 ? after + limit : null;
  
  res.json({
    entries: items,
    links: {
      self: `http://localhost:${PORT}/api/feed?after=${after}`,
      next: nextAfter ? `http://localhost:${PORT}/api/feed?after=${nextAfter}` : null
    }
  });
});

/**
 * GET /api/events
 * Cursor pagination with continuation token (encoded)
 * 
 * Example cURL:
 * curl "http://localhost:3001/api/events"
 */
app.get('/api/events', (req, res) => {
  let offset = 0;
  if (req.query.continuation) {
    try {
      const decoded = Buffer.from(req.query.continuation, 'base64').toString();
      offset = parseInt(decoded);
    } catch (e) {
      offset = 0;
    }
  }
  
  const limit = 30;
  const events = [];
  for (let i = offset; i < Math.min(offset + limit, 250); i++) {
    events.push({
      event_id: `EVT_${i + 1}`,
      name: `Event ${i + 1}`,
      type: ['click', 'view', 'purchase', 'signup'][i % 4],
      user_id: `user_${(i % 100) + 1}`,
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
      properties: {
        source: ['web', 'mobile', 'api'][i % 3],
        version: '1.0'
      }
    });
  }
  
  const nextOffset = offset + limit;
  const continuation = nextOffset < 250 ? Buffer.from(String(nextOffset)).toString('base64') : null;
  
  res.json({
    records: events,
    continuation: continuation,
    has_more: continuation !== null
  });
});

// ============================================
// NO PAGINATION (SIMPLE) ENDPOINTS
// ============================================

/**
 * GET /api/categories
 * Simple endpoint with no pagination
 * 
 * Example cURL:
 * curl "http://localhost:3001/api/categories"
 */
app.get('/api/categories', (req, res) => {
  res.json([
    { id: 1, name: 'Electronics', slug: 'electronics' },
    { id: 2, name: 'Clothing', slug: 'clothing' },
    { id: 3, name: 'Books', slug: 'books' },
    { id: 4, name: 'Home & Garden', slug: 'home-garden' },
    { id: 5, name: 'Sports', slug: 'sports' }
  ]);
});

/**
 * GET /api/config
 * Simple object response
 * 
 * Example cURL:
 * curl "http://localhost:3001/api/config"
 */
app.get('/api/config', (req, res) => {
  res.json({
    app_name: 'Test API',
    version: '1.0.0',
    features: {
      comments: true,
      likes: true,
      shares: false
    },
    limits: {
      max_upload_size: 10485760,
      rate_limit: 100
    }
  });
});

// ============================================
// SPECIAL TEST ENDPOINTS
// ============================================

/**
 * GET /api/flaky
 * Endpoint that fails randomly (for testing retry logic)
 * 
 * Example cURL:
 * curl "http://localhost:3001/api/flaky?page=1"
 */
let flakyCallCount = 0;
app.get('/api/flaky', (req, res) => {
  flakyCallCount++;
  
  // Fail on 1st and 2nd attempt, succeed on 3rd
  if (flakyCallCount % 3 !== 0) {
    return res.status(500).json({ error: 'Random server error', attempt: flakyCallCount });
  }
  
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const data = [];
  const startId = (page - 1) * limit + 1;
  
  for (let i = 0; i < limit && startId + i <= 50; i++) {
    data.push({
      id: startId + i,
      value: `Item ${startId + i}`,
      timestamp: new Date().toISOString()
    });
  }
  
  res.json({
    data: data,
    page: page,
    total_pages: 5,
    note: 'This endpoint sometimes fails to test retry logic'
  });
});

/**
 * GET /api/slow
 * Endpoint with delayed response
 * 
 * Example cURL:
 * curl "http://localhost:3001/api/slow?page=1"
 */
app.get('/api/slow', (req, res) => {
  const delay = parseInt(req.query.delay) || 2000;
  const page = parseInt(req.query.page) || 1;
  
  setTimeout(() => {
    res.json({
      data: [
        { id: page, message: `Slow response page ${page}` }
      ],
      page: page,
      total_pages: 3
    });
  }, delay);
});

/**
 * POST /api/auth/data
 * Endpoint requiring authentication header
 * 
 * Example cURL:
 * curl -X POST "http://localhost:3001/api/auth/data" \
 *   -H "Authorization: Bearer test-token-123" \
 *   -H "Content-Type: application/json" \
 *   -d '{"filter": "active"}'
 */
app.post('/api/auth/data', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid Authorization header' });
  }
  
  const token = authHeader.split(' ')[1];
  if (token !== 'test-token-123') {
    return res.status(403).json({ error: 'Forbidden', message: 'Invalid token' });
  }
  
  const filter = req.body?.filter || 'all';
  
  res.json({
    data: [
      { id: 1, name: 'Secure Item 1', status: 'active' },
      { id: 2, name: 'Secure Item 2', status: 'active' },
      { id: 3, name: 'Secure Item 3', status: 'inactive' }
    ].filter(item => filter === 'all' || item.status === filter),
    authenticated: true,
    user: 'test-user'
  });
});

/**
 * GET /api/empty
 * Endpoint returning empty results
 * 
 * Example cURL:
 * curl "http://localhost:3001/api/empty"
 */
app.get('/api/empty', (req, res) => {
  res.json({
    data: [],
    total: 0,
    page: 1,
    total_pages: 0
  });
});

// ============================================
// SERVER START
// ============================================

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║               Mock API Server for API Crawler                  ║
╠═══════════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}                      ║
║                                                                ║
║  Available Endpoints:                                          ║
║                                                                ║
║  PAGE-BASED PAGINATION:                                        ║
║    GET /api/users?page=1&per_page=10                          ║
║    GET /api/products?page=1&limit=20                          ║
║                                                                ║
║  OFFSET-BASED PAGINATION:                                      ║
║    GET /api/posts?offset=0&limit=25                           ║
║    GET /api/orders?skip=0&take=15                             ║
║                                                                ║
║  CURSOR-BASED PAGINATION:                                      ║
║    GET /api/comments?cursor=0&limit=20                        ║
║    GET /api/feed?after=0                                       ║
║    GET /api/events (uses continuation token)                   ║
║                                                                ║
║  NO PAGINATION:                                                ║
║    GET /api/categories                                         ║
║    GET /api/config                                             ║
║                                                                ║
║  SPECIAL TEST ENDPOINTS:                                       ║
║    GET /api/flaky?page=1     (fails randomly)                  ║
║    GET /api/slow?page=1      (delayed response)                ║
║    POST /api/auth/data       (requires auth)                   ║
║    GET /api/empty            (empty results)                   ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});
