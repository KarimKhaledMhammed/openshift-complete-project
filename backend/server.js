/**
 * Bookstore Backend API
 * OpenShift 4.18 Demo Application
 * With Redis Caching (BONUS)
 */

const express = require('express');
const mysql = require('mysql2/promise');
const redis = require('redis');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Database Configuration (from ConfigMap/Secret)
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

// Redis Configuration (BONUS: Caching Layer)
const redisConfig = {
    socket: {
        host: process.env.REDIS_HOST || 'redis',
        port: parseInt(process.env.REDIS_PORT) || 6379
    }
};
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 300; // 5 minutes default

let pool;
let redisClient;

// Initialize Database Connection
async function initDatabase() {
    try {
        pool = mysql.createPool(dbConfig);

        // Test connection
        const connection = await pool.getConnection();
        console.log('✅ Database connected successfully');
        connection.release();

        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

// Initialize Redis Connection (BONUS: Caching)
async function initRedis() {
    try {
        redisClient = redis.createClient(redisConfig);

        redisClient.on('error', (err) => {
            console.error('⚠️ Redis error:', err.message);
        });

        await redisClient.connect();
        console.log('✅ Redis connected successfully');
        return true;
    } catch (error) {
        console.error('⚠️ Redis connection failed (caching disabled):', error.message);
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
        console.error('Cache get error:', error.message);
        return null;
    }
}

async function setToCache(key, data, ttl = CACHE_TTL) {
    if (!redisClient?.isOpen) return;
    try {
        await redisClient.setEx(key, ttl, JSON.stringify(data));
    } catch (error) {
        console.error('Cache set error:', error.message);
    }
}

async function invalidateCache(pattern = 'books:*') {
    if (!redisClient?.isOpen) return;
    try {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
            await redisClient.del(keys);
        }
        // Also invalidate the all books cache
        await redisClient.del('books:all');
    } catch (error) {
        console.error('Cache invalidate error:', error.message);
    }
}

// ===================
// Health Check Routes (BONUS)
// ===================

// Liveness probe - is the app running?
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Readiness probe - can the app serve traffic?
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
        res.status(503).json({
            status: 'not ready',
            database: 'disconnected',
            cache: redisClient?.isOpen ? 'connected' : 'disconnected',
            error: error.message
        });
    }
});

// ===================
// Book API Routes
// ===================

// GET all books (with Redis caching)
app.get('/api/books', async (req, res) => {
    try {
        // Try cache first (BONUS: Redis Caching)
        const cached = await getFromCache('books:all');
        if (cached) {
            return res.json(cached);
        }

        const [rows] = await pool.query('SELECT * FROM books ORDER BY created_at DESC');

        // Cache the result
        await setToCache('books:all', rows);

        res.json(rows);
    } catch (error) {
        console.error('Error fetching books:', error);
        res.status(500).json({ error: 'Failed to fetch books' });
    }
});

// GET single book (with Redis caching)
app.get('/api/books/:id', async (req, res) => {
    try {
        const cacheKey = `books:${req.params.id}`;

        // Try cache first
        const cached = await getFromCache(cacheKey);
        if (cached) {
            return res.json({ ...cached, fromCache: true });
        }

        const [rows] = await pool.query('SELECT * FROM books WHERE id = ?', [req.params.id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Book not found' });
        }

        // Cache the result
        await setToCache(cacheKey, rows[0]);

        res.json(rows[0]);
    } catch (error) {
        console.error('Error fetching book:', error);
        res.status(500).json({ error: 'Failed to fetch book' });
    }
});

// POST new book
app.post('/api/books', async (req, res) => {
    try {
        const { title, author, isbn, price, stock } = req.body;

        // Validation
        if (!title || !author || !isbn) {
            return res.status(400).json({ error: 'Title, author, and ISBN are required' });
        }

        const [result] = await pool.query(
            'INSERT INTO books (title, author, isbn, price, stock) VALUES (?, ?, ?, ?, ?)',
            [title, author, isbn, price || 0, stock || 0]
        );

        // Invalidate cache after creating
        await invalidateCache();

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
        console.error('Error creating book:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Book with this ISBN already exists' });
        }

        res.status(500).json({ error: 'Failed to create book' });
    }
});

// PUT update book
app.put('/api/books/:id', async (req, res) => {
    try {
        const { title, author, isbn, price, stock } = req.body;
        const id = req.params.id;

        const [result] = await pool.query(
            'UPDATE books SET title = ?, author = ?, isbn = ?, price = ?, stock = ?, updated_at = NOW() WHERE id = ?',
            [title, author, isbn, price, stock, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Book not found' });
        }

        // Invalidate cache after updating
        await invalidateCache();

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
        console.error('Error updating book:', error);
        res.status(500).json({ error: 'Failed to update book' });
    }
});

// DELETE book
app.delete('/api/books/:id', async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM books WHERE id = ?', [req.params.id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Book not found' });
        }

        // Invalidate cache after deleting
        await invalidateCache();

        res.json({ message: 'Book deleted successfully' });
    } catch (error) {
        console.error('Error deleting book:', error);
        res.status(500).json({ error: 'Failed to delete book' });
    }
});

// ===================
// Error Handling
// ===================

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ===================
// Start Server
// ===================

async function startServer() {
    // Wait for database connection
    let retries = 5;
    while (retries > 0) {
        const connected = await initDatabase();
        if (connected) break;

        console.log(`⏳ Retrying database connection... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        retries--;
    }

    if (!pool) {
        console.error('❌ Could not connect to database. Exiting.');
        process.exit(1);
    }

    // Initialize Redis (optional - app works without it)
    await initRedis();

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Bookstore API running on port ${PORT}`);
        console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔗 Database: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
        console.log(`🔴 Redis: ${redisConfig.socket.host}:${redisConfig.socket.port} (${redisClient?.isOpen ? 'connected' : 'disconnected'})`);
    });
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('📴 SIGTERM received. Shutting down gracefully...');
    if (redisClient?.isOpen) {
        await redisClient.quit();
    }
    if (pool) {
        await pool.end();
    }
    process.exit(0);
});
