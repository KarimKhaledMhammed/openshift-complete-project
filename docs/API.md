# 📚 Bookstore API Documentation

## Base URL

```
http://localhost:3000/api
```

## Interactive Documentation

Swagger UI is available at: **http://localhost:3000/api/docs**

---

## Authentication

Currently, the API does not require authentication for read operations. Write operations (POST, PUT, DELETE) are open but should be protected in production.

---

## Endpoints

### Health & Monitoring

#### GET /api/health
**Liveness Probe** - Check if the application is running

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-11T15:30:00.000Z",
  "uptime": 123.456
}
```

#### GET /api/ready
**Readiness Probe** - Check if the application can serve traffic

**Response (Success):**
```json
{
  "status": "ready",
  "database": "connected",
  "cache": "connected",
  "timestamp": "2026-01-11T15:30:00.000Z"
}
```

**Response (Failure - 503):**
```json
{
  "status": "not ready",
  "database": "disconnected",
  "cache": "connected",
  "error": "Connection refused"
}
```

#### GET /api/metrics
**Prometheus Metrics** - Get application metrics

**Response:**
```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/api/books",status_code="200"} 42
...
```

---

### Books Management

#### GET /api/books
Get all books from the inventory

**Response:**
```json
[
  {
    "id": 1,
    "title": "The Great Gatsby",
    "author": "F. Scott Fitzgerald",
    "isbn": "9780743273565",
    "price": 12.99,
    "stock": 50,
    "created_at": "2026-01-10T10:00:00.000Z",
    "updated_at": "2026-01-10T10:00:00.000Z"
  }
]
```

**Features:**
- ✅ Redis caching (5-minute TTL)
- ✅ Ordered by creation date (newest first)

---

#### GET /api/books/:id
Get a single book by ID

**Parameters:**
- `id` (path, required) - Book ID

**Response (Success - 200):**
```json
{
  "id": 1,
  "title": "The Great Gatsby",
  "author": "F. Scott Fitzgerald",
  "isbn": "9780743273565",
  "price": 12.99,
  "stock": 50,
  "created_at": "2026-01-10T10:00:00.000Z",
  "updated_at": "2026-01-10T10:00:00.000Z",
  "fromCache": true
}
```

**Response (Not Found - 404):**
```json
{
  "error": "Book not found"
}
```

---

#### POST /api/books
Create a new book

**Request Body:**
```json
{
  "title": "1984",
  "author": "George Orwell",
  "isbn": "9780451524935",
  "price": 15.99,
  "stock": 100
}
```

**Validation Rules:**
- `title` (required) - String, max 255 characters
- `author` (required) - String, max 255 characters
- `isbn` (required) - Valid ISBN-10 or ISBN-13 format
- `price` (optional) - Number, 0-10000, default: 0
- `stock` (optional) - Integer, 0-100000, default: 0

**Response (Success - 201):**
```json
{
  "id": 9,
  "title": "1984",
  "author": "George Orwell",
  "isbn": "9780451524935",
  "price": 15.99,
  "stock": 100,
  "message": "Book created successfully"
}
```

**Response (Validation Error - 400):**
```json
{
  "error": "Invalid ISBN format. Must be ISBN-10 or ISBN-13"
}
```

**Response (Duplicate - 409):**
```json
{
  "error": "Book with this ISBN already exists"
}
```

---

#### PUT /api/books/:id
Update an existing book

**Parameters:**
- `id` (path, required) - Book ID

**Request Body:**
```json
{
  "title": "1984 (Updated Edition)",
  "author": "George Orwell",
  "isbn": "9780451524935",
  "price": 17.99,
  "stock": 75
}
```

**Validation Rules:** Same as POST

**Response (Success - 200):**
```json
{
  "id": 9,
  "title": "1984 (Updated Edition)",
  "author": "George Orwell",
  "isbn": "9780451524935",
  "price": 17.99,
  "stock": 75,
  "message": "Book updated successfully"
}
```

**Response (Not Found - 404):**
```json
{
  "error": "Book not found"
}
```

---

#### DELETE /api/books/:id
Delete a book from the inventory

**Parameters:**
- `id` (path, required) - Book ID

**Response (Success - 200):**
```json
{
  "message": "Book deleted successfully"
}
```

**Response (Not Found - 404):**
```json
{
  "error": "Book not found"
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 404 | Not Found |
| 409 | Conflict (duplicate ISBN) |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

---

## Structured Logging

All requests generate structured JSON logs with:
- `correlationId` - Unique request identifier
- `method` - HTTP method
- `path` - Request path
- `statusCode` - Response status
- `duration` - Request duration in seconds
- `timestamp` - ISO 8601 timestamp

**Example Log:**
```json
{
  "level": "info",
  "message": "HTTP Request",
  "correlationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "method": "GET",
  "path": "/api/books",
  "statusCode": 200,
  "duration": "0.042s",
  "timestamp": "2026-01-11T15:30:00.000Z",
  "service": "bookstore-api"
}
```

---

## Caching Strategy

- **Cache Key Format:** `books:all` or `books:{id}`
- **TTL:** 5 minutes (300 seconds)
- **Invalidation:** Automatic on POST, PUT, DELETE operations
- **Fallback:** If Redis is unavailable, queries go directly to MySQL

---

## Testing Examples

### Using cURL

```bash
# Get all books
curl http://localhost:3000/api/books

# Get single book
curl http://localhost:3000/api/books/1

# Create book
curl -X POST http://localhost:3000/api/books \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Book",
    "author": "Test Author",
    "isbn": "9781234567890",
    "price": 19.99,
    "stock": 50
  }'

# Update book
curl -X PUT http://localhost:3000/api/books/1 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Title",
    "author": "Updated Author",
    "isbn": "9781234567890",
    "price": 24.99,
    "stock": 25
  }'

# Delete book
curl -X DELETE http://localhost:3000/api/books/1

# Health check
curl http://localhost:3000/api/health

# Metrics
curl http://localhost:3000/api/metrics
```

---

## ISBN Validation

Accepted formats:
- **ISBN-10:** 10 digits (last can be X)
  - Example: `0451524935` or `043942089X`
- **ISBN-13:** 13 digits starting with 978 or 979
  - Example: `9780451524935`

Hyphens and spaces are automatically removed during validation.

---

## Rate Limiting

Currently not implemented. Consider adding in production:
- `express-rate-limit` for API rate limiting
- Redis-based rate limiting for distributed systems

---

## Future Enhancements

- [ ] API key authentication
- [ ] Pagination for GET /api/books
- [ ] Search and filtering
- [ ] Book categories/genres
- [ ] User reviews and ratings
- [ ] GraphQL endpoint
