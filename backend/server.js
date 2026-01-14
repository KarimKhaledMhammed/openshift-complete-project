/**
 * Bookstore Backend API
 * OpenShift 4.18 Demo Application
 * With Redis Caching, Swagger Docs, Structured Logging, and Metrics
 */

const express = require('express');
const mysql = require('mysql2/promise');
const redis = require('redis');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');
const promClient = require('prom-client');

const app = express();
const PORT = process.env.PORT || 3000;

// ===================
// Structured Logging Setup (BONUS)
// ===================
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'bookstore-api' },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// ===================
// Prometheus Metrics Setup (BONUS)
// ===================
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const httpRequestDuration = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register]
});

const httpRequestTotal = new promClient.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register]
});

// ===================
// Middleware
// ===================

// Correlation ID middleware
app.use((req, res, next) => {
    req.correlationId = req.headers['x-correlation-id'] || uuidv4();
    res.setHeader('X-Correlation-ID', req.correlationId);
    next();
});

// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;

        logger.info('HTTP Request', {
            correlationId: req.correlationId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}s`,
            userAgent: req.headers['user-agent']
        });

        // Record metrics
        httpRequestDuration.labels(req.method, req.path, res.statusCode).observe(duration);
        httpRequestTotal.labels(req.method, req.path, res.statusCode).inc();
    });

    next();
});

app.use(helmet());
app.use(cors());
app.use(express.json());

// ===================
// Swagger/OpenAPI Configuration (BONUS)
// ===================
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Bookstore API',
            version: '1.0.0',
            description: 'A comprehensive bookstore management API with Redis caching',
            contact: {
                name: 'API Support',
                email: 'support@bookstore.com'
            }
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Development server'
            }
        ],
        tags: [
            { name: 'Health', description: 'Health check endpoints' },
            { name: 'Books', description: 'Book management operations' },
            { name: 'Metrics', description: 'Prometheus metrics' }
        ]
    },
    apis: ['./server.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Database Configuration
const dbConfig = {
    host: process.env.DB_HOST || 'mysql',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'bookstore',
    password: process.env.DB_PASSWORD || 'bookstore123',
    database: process.env.DB_NAME || 'bookstore',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Redis Configuration
const redisConfig = {
    socket: {
        host: process.env.REDIS_HOST || 'redis',
        port: parseInt(process.env.REDIS_PORT) || 6379
    }
};
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 300;

let pool;
let redisClient;

// ===================
// Validation Functions (BONUS)
// ===================

function validateISBN(isbn) {
    // ISBN-10 or ISBN-13 format
    const isbn10Regex = /^(?:\d{9}X|\d{10})$/;
    const isbn13Regex = /^(?:97[89]\d{10})$/;
    const cleanISBN = isbn.replace(/[-\s]/g, '');

    return isbn10Regex.test(cleanISBN) || isbn13Regex.test(cleanISBN);
}

function validatePrice(price) {
    const numPrice = parseFloat(price);
    return !isNaN(numPrice) && numPrice >= 0 && numPrice <= 10000;
}

function validateStock(stock) {
    const numStock = parseInt(stock);
    return !isNaN(numStock) && numStock >= 0 && numStock <= 100000;
}

// Initialize Database Connection
async function initDatabase() {
    try {
        pool = mysql.createPool(dbConfig);
        const connection = await pool.getConnection();
        logger.info('Database connected successfully', { correlationId: 'init' });
        connection.release();
        return true;
    } catch (error) {
        logger.error('Database connection failed', {
            correlationId: 'init',
            error: error.message
        });
        return false;
    }
}

// Initialize Redis Connection
async function initRedis() {
    try {
        redisClient = redis.createClient(redisConfig);

        redisClient.on('error', (err) => {
            logger.warn('Redis error', { error: err.message });
        });

        await redisClient.connect();
        logger.info('Redis connected successfully', { correlationId: 'init' });
        return true;
    } catch (error) {
        logger.warn('Redis connection failed (caching disabled)', {
            correlationId: 'init',
            error: error.message
        });
        return false;
    }
}

// Cache Helper Functions
async function getFromCache(key) {
    if (!redisClient?.isOpen) return null;
    try {
        const cached = await redisClient.get(key);
        return cached ? JSON.parse(cached) : null;
    } catch (error) {
        logger.error('Cache get error', { error: error.message });
        return null;
    }
}

async function setToCache(key, data, ttl = CACHE_TTL) {
    if (!redisClient?.isOpen) return;
    try {
        await redisClient.setEx(key, ttl, JSON.stringify(data));
    } catch (error) {
        logger.error('Cache set error', { error: error.message });
    }
}

async function invalidateCache(pattern = 'books:*') {
    if (!redisClient?.isOpen) return;
    try {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
            await redisClient.del(keys);
        }
        await redisClient.del('books:all');
    } catch (error) {
        logger.error('Cache invalidate error', { error: error.message });
    }
}

// ===================
// Health Check Routes
// ===================

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Liveness probe
 *     description: Check if the application is running
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Application is healthy
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

/**
 * @swagger
 * /api/ready:
 *   get:
 *     summary: Readiness probe
 *     description: Check if the application can serve traffic
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Application is ready
 *       503:
 *         description: Application is not ready
 */
app.get('/api/ready', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();

        res.json({
            status: 'ready',
            database: 'connected',
            cache: redisClient?.isOpen ? 'connected' : 'disconnected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Readiness check failed', {
            correlationId: req.correlationId,
            error: error.message
        });

        res.status(503).json({
            status: 'not ready',
            database: 'disconnected',
            cache: redisClient?.isOpen ? 'connected' : 'disconnected',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/metrics:
 *   get:
 *     summary: Prometheus metrics
 *     description: Get application metrics in Prometheus format
 *     tags: [Metrics]
 *     responses:
 *       200:
 *         description: Metrics in Prometheus format
 */
app.get('/api/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
});

// ===================
// Book API Routes
// ===================

/**
 * @swagger
 * /api/books:
 *   get:
 *     summary: Get all books
 *     description: Retrieve all books from the database (with Redis caching)
 *     tags: [Books]
 *     responses:
 *       200:
 *         description: List of books
 *       500:
 *         description: Server error
 */
app.get('/api/books', async (req, res) => {
    try {
        const cached = await getFromCache('books:all');
        if (cached) {
            logger.info('Cache hit for all books', { correlationId: req.correlationId });
            return res.json(cached);
        }

        const [rows] = await pool.query('SELECT * FROM books ORDER BY created_at DESC');
        await setToCache('books:all', rows);

        logger.info('Fetched all books from database', {
            correlationId: req.correlationId,
            count: rows.length
        });

        res.json(rows);
    } catch (error) {
        logger.error('Error fetching books', {
            correlationId: req.correlationId,
            error: error.message
        });
        res.status(500).json({ error: 'Failed to fetch books' });
    }
});

/**
 * @swagger
 * /api/books/{id}:
 *   get:
 *     summary: Get book by ID
 *     description: Retrieve a single book by its ID
 *     tags: [Books]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Book ID
 *     responses:
 *       200:
 *         description: Book details
 *       404:
 *         description: Book not found
 */
app.get('/api/books/:id', async (req, res) => {
    try {
        const cacheKey = `books:${req.params.id}`;
        const cached = await getFromCache(cacheKey);

        if (cached) {
            logger.info('Cache hit for book', {
                correlationId: req.correlationId,
                bookId: req.params.id
            });
            return res.json({ ...cached, fromCache: true });
        }

        const [rows] = await pool.query('SELECT * FROM books WHERE id = ?', [req.params.id]);

        if (rows.length === 0) {
            logger.warn('Book not found', {
                correlationId: req.correlationId,
                bookId: req.params.id
            });
            return res.status(404).json({ error: 'Book not found' });
        }

        await setToCache(cacheKey, rows[0]);
        res.json(rows[0]);
    } catch (error) {
        logger.error('Error fetching book', {
            correlationId: req.correlationId,
            error: error.message
        });
        res.status(500).json({ error: 'Failed to fetch book' });
    }
});

/**
 * @swagger
 * /api/books:
 *   post:
 *     summary: Create a new book
 *     description: Add a new book to the inventory
 *     tags: [Books]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - author
 *               - isbn
 *             properties:
 *               title:
 *                 type: string
 *               author:
 *                 type: string
 *               isbn:
 *                 type: string
 *               price:
 *                 type: number
 *               stock:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Book created successfully
 *       400:
 *         description: Invalid input
 */
app.post('/api/books', async (req, res) => {
    try {
        const { title, author, isbn, price, stock } = req.body;

        // Validation (BONUS)
        if (!title || !author || !isbn) {
            return res.status(400).json({
                error: 'Title, author, and ISBN are required'
            });
        }

        if (!validateISBN(isbn)) {
            return res.status(400).json({
                error: 'Invalid ISBN format. Must be ISBN-10 or ISBN-13'
            });
        }

        if (price !== undefined && !validatePrice(price)) {
            return res.status(400).json({
                error: 'Invalid price. Must be between 0 and 10000'
            });
        }

        if (stock !== undefined && !validateStock(stock)) {
            return res.status(400).json({
                error: 'Invalid stock. Must be between 0 and 100000'
            });
        }

        const [result] = await pool.query(
            'INSERT INTO books (title, author, isbn, price, stock) VALUES (?, ?, ?, ?, ?)',
            [title, author, isbn, price || 0, stock || 0]
        );

        await invalidateCache();

        logger.info('Book created', {
            correlationId: req.correlationId,
            bookId: result.insertId,
            title
        });

        res.status(201).json({
            id: result.insertId,
            title,
            author,
            isbn,
            price,
            stock,
            message: 'Book created successfully'
        });
    } catch (error) {
        logger.error('Error creating book', {
            correlationId: req.correlationId,
            error: error.message
        });

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Book with this ISBN already exists' });
        }

        res.status(500).json({ error: 'Failed to create book' });
    }
});

/**
 * @swagger
 * /api/books/{id}:
 *   put:
 *     summary: Update a book
 *     description: Update an existing book's information
 *     tags: [Books]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               author:
 *                 type: string
 *               isbn:
 *                 type: string
 *               price:
 *                 type: number
 *               stock:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Book updated successfully
 *       404:
 *         description: Book not found
 */
app.put('/api/books/:id', async (req, res) => {
    try {
        const { title, author, isbn, price, stock } = req.body;
        const id = req.params.id;

        // Validation (BONUS)
        if (isbn && !validateISBN(isbn)) {
            return res.status(400).json({
                error: 'Invalid ISBN format. Must be ISBN-10 or ISBN-13'
            });
        }

        if (price !== undefined && !validatePrice(price)) {
            return res.status(400).json({
                error: 'Invalid price. Must be between 0 and 10000'
            });
        }

        if (stock !== undefined && !validateStock(stock)) {
            return res.status(400).json({
                error: 'Invalid stock. Must be between 0 and 100000'
            });
        }

        const [result] = await pool.query(
            'UPDATE books SET title = ?, author = ?, isbn = ?, price = ?, stock = ?, updated_at = NOW() WHERE id = ?',
            [title, author, isbn, price, stock, id]
        );

        if (result.affectedRows === 0) {
            logger.warn('Book not found for update', {
                correlationId: req.correlationId,
                bookId: id
            });
            return res.status(404).json({ error: 'Book not found' });
        }

        await invalidateCache();

        logger.info('Book updated', {
            correlationId: req.correlationId,
            bookId: id
        });

        res.json({
            id: parseInt(id),
            title,
            author,
            isbn,
            price,
            stock,
            message: 'Book updated successfully'
        });
    } catch (error) {
        logger.error('Error updating book', {
            correlationId: req.correlationId,
            error: error.message
        });
        res.status(500).json({ error: 'Failed to update book' });
    }
});

/**
 * @swagger
 * /api/books/{id}:
 *   delete:
 *     summary: Delete a book
 *     description: Remove a book from the inventory
 *     tags: [Books]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Book deleted successfully
 *       404:
 *         description: Book not found
 */
app.delete('/api/books/:id', async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM books WHERE id = ?', [req.params.id]);

        if (result.affectedRows === 0) {
            logger.warn('Book not found for deletion', {
                correlationId: req.correlationId,
                bookId: req.params.id
            });
            return res.status(404).json({ error: 'Book not found' });
        }

        await invalidateCache();

        logger.info('Book deleted', {
            correlationId: req.correlationId,
            bookId: req.params.id
        });

        res.json({ message: 'Book deleted successfully' });
    } catch (error) {
        logger.error('Error deleting book', {
            correlationId: req.correlationId,
            error: error.message
        });
        res.status(500).json({ error: 'Failed to delete book' });
    }
});

// ===================
// Error Handling
// ===================

app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
    logger.error('Unhandled error', {
        correlationId: req.correlationId,
        error: err.message,
        stack: err.stack
    });
    res.status(500).json({ error: 'Internal server error' });
});

// ===================
// Start Server
// ===================

async function startServer() {
    let retries = 5;
    while (retries > 0) {
        const connected = await initDatabase();
        if (connected) break;

        logger.warn('Retrying database connection', { attemptsLeft: retries });
        await new Promise(resolve => setTimeout(resolve, 5000));
        retries--;
    }

    if (!pool) {
        logger.error('Could not connect to database. Exiting.');
        process.exit(1);
    }

    await initRedis();

    app.listen(PORT, '0.0.0.0', () => {
        logger.info('Bookstore API started', {
            port: PORT,
            environment: process.env.NODE_ENV || 'development',
            database: `${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`,
            redis: `${redisConfig.socket.host}:${redisConfig.socket.port}`,
            redisStatus: redisClient?.isOpen ? 'connected' : 'disconnected',
            swaggerDocs: `http://localhost:${PORT}/api/docs`
        });
    });
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    if (redisClient?.isOpen) {
        await redisClient.quit();
    }
    if (pool) {
        await pool.end();
    }
    process.exit(0);
});
