/**
 * Product API Controller
 * Express.js controller for handling product creation and retrieval
 * Integrates with mountebank imposters and provides real persistence
 */

const express = require('express');
const { saveProductToFile, getProductById, getAllProducts, searchProducts, getProductStats } = require('./product-persistence');

/**
 * Validate JWT token (simplified for demo purposes)
 */
function validateJWT(token) {
    // In a real application, you would validate the JWT properly
    // For demo purposes, we'll just check if it exists and has the Bearer prefix
    if (!token || !token.startsWith('Bearer ')) {
        return false;
    }
    
    // You can add actual JWT validation here using libraries like jsonwebtoken
    // const jwt = require('jsonwebtoken');
    // try {
    //     const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
    //     return decoded;
    // } catch (error) {
    //     return false;
    // }
    
    return true; // For demo purposes, assume all Bearer tokens are valid
}

/**
 * Middleware to check authorization
 */
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!validateJWT(authHeader)) {
        return res.status(401).json({
            success: false,
            message: "Authentication required",
            error: "Invalid or missing authorization token",
            errorCode: "UNAUTHORIZED",
            timestamp: new Date().toISOString()
        });
    }
    
    next();
}

/**
 * Middleware to validate request body for product creation
 */
function validateProductData(req, res, next) {
    const { productName, category, brand } = req.body;
    const errors = [];
    
    if (!productName || typeof productName !== 'string' || productName.trim().length === 0) {
        errors.push({
            field: "productName",
            message: "Product name is required and must not be empty",
            code: "FIELD_REQUIRED"
        });
    }
    
    if (!category || typeof category !== 'string' || category.trim().length === 0) {
        errors.push({
            field: "category",
            message: "Category is required",
            code: "FIELD_REQUIRED"
        });
    }
    
    if (!brand || typeof brand !== 'string' || brand.trim().length === 0) {
        errors.push({
            field: "brand",
            message: "Brand is required",
            code: "FIELD_REQUIRED"
        });
    }
    
    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: errors,
            errorCode: "VALIDATION_ERROR",
            timestamp: new Date().toISOString()
        });
    }
    
    next();
}

/**
 * POST /api/createProduct
 * Create a new product and save it to the JSON file
 */
async function createProduct(req, res) {
    try {
        const startTime = Date.now();
        const requestId = req.headers['x-request-id'] || `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        console.log(`[${requestId}] Creating product:`, req.body.productName);
        
        // Save product using persistence utility
        const savedProduct = await saveProductToFile(req.body);
        
        const responseTime = Date.now() - startTime;
        
        // Success response
        res.status(201).json({
            success: true,
            message: "Product created successfully",
            data: {
                productId: savedProduct.productId,
                productCode: savedProduct.productCode,
                productName: savedProduct.productName,
                status: savedProduct.status,
                category: savedProduct.category,
                subCategory: savedProduct.subCategory,
                brand: savedProduct.brand,
                sku: savedProduct.sku,
                createdAt: savedProduct.createdAt,
                estimatedAvailability: savedProduct.estimatedAvailability,
                qrCode: savedProduct.qrCode,
                deepLink: savedProduct.deepLink
            },
            metadata: {
                requestId: requestId,
                responseTime: `${responseTime}ms`,
                timestamp: new Date().toISOString()
            }
        });
        
        // Set additional headers
        res.set({
            'Location': `/api/getProductDetails?productId=${savedProduct.productId}`,
            'X-Request-ID': requestId,
            'X-Response-Time': `${responseTime}ms`,
            'Cache-Control': 'no-cache',
            'X-API-Version': 'v1.0',
            'ETag': `"${Math.random().toString(36).substr(2, 9)}"`
        });
        
        console.log(`[${requestId}] Product created successfully: ${savedProduct.productId}`);
        
    } catch (error) {
        console.error('Error creating product:', error);
        
        res.status(500).json({
            success: false,
            message: "Internal server error occurred while creating product",
            error: error.message,
            errorCode: "INTERNAL_SERVER_ERROR",
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * GET /api/getProductDetails
 * Retrieve product details by product ID
 */
async function getProductDetails(req, res) {
    try {
        const startTime = Date.now();
        const requestId = req.headers['x-request-id'] || `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const productId = req.query.productId;
        
        console.log(`[${requestId}] Getting product details for:`, productId);
        
        // Validate product ID
        if (!productId || typeof productId !== 'string' || productId.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: "Product ID is required",
                error: "Missing or invalid productId parameter",
                errorCode: "INVALID_PRODUCT_ID",
                timestamp: new Date().toISOString()
            });
        }
        
        // Get product from persistence layer
        const product = await getProductById(productId);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
                error: `No product found with ID: ${productId}`,
                errorCode: "PRODUCT_NOT_FOUND",
                timestamp: new Date().toISOString()
            });
        }
        
        const responseTime = Date.now() - startTime;
        
        // Success response
        res.status(200).json({
            success: true,
            message: "Product details retrieved successfully",
            data: {
                productId: product.productId,
                productCode: product.productCode,
                productName: product.productName,
                status: product.status,
                category: product.category,
                subCategory: product.subCategory,
                brand: product.brand,
                description: product.description,
                price: product.price,
                currency: product.currency,
                specifications: product.specifications,
                tags: product.tags,
                sku: product.sku,
                createdAt: product.createdAt,
                updatedAt: product.updatedAt,
                estimatedAvailability: product.estimatedAvailability,
                qrCode: product.qrCode,
                deepLink: product.deepLink,
                availability: {
                    inStock: Math.random() > 0.3, // Random availability for demo
                    quantity: Math.floor(Math.random() * 100) + 1,
                    location: "Warehouse A"
                }
            },
            metadata: {
                requestId: requestId,
                responseTime: `${responseTime}ms`,
                timestamp: new Date().toISOString(),
                cached: false
            }
        });
        
        // Set additional headers
        res.set({
            'X-Request-ID': requestId,
            'X-Response-Time': `${responseTime}ms`,
            'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
            'X-API-Version': 'v1.0',
            'ETag': `"${product.updatedAt}"`
        });
        
        console.log(`[${requestId}] Product details retrieved successfully: ${product.productName}`);
        
    } catch (error) {
        console.error('Error getting product details:', error);
        
        res.status(500).json({
            success: false,
            message: "Internal server error occurred while retrieving product details",
            error: error.message,
            errorCode: "INTERNAL_SERVER_ERROR",
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * GET /api/products
 * Get all products with optional filtering
 */
async function getAllProductsEndpoint(req, res) {
    try {
        const startTime = Date.now();
        const requestId = req.headers['x-request-id'] || `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        console.log(`[${requestId}] Getting all products with filters:`, req.query);
        
        let products;
        
        // Check if any filter criteria are provided
        const hasFilters = req.query.category || req.query.brand || req.query.productName || req.query.status;
        
        if (hasFilters) {
            // Use search functionality
            products = await searchProducts(req.query);
        } else {
            // Get all products
            products = await getAllProducts();
        }
        
        const responseTime = Date.now() - startTime;
        
        res.status(200).json({
            success: true,
            message: `Retrieved ${products.length} products successfully`,
            data: products.map(product => ({
                productId: product.productId,
                productCode: product.productCode,
                productName: product.productName,
                status: product.status,
                category: product.category,
                brand: product.brand,
                price: product.price,
                currency: product.currency,
                createdAt: product.createdAt
            })),
            metadata: {
                totalCount: products.length,
                requestId: requestId,
                responseTime: `${responseTime}ms`,
                timestamp: new Date().toISOString(),
                filters: req.query
            }
        });
        
        res.set({
            'X-Request-ID': requestId,
            'X-Response-Time': `${responseTime}ms`,
            'X-API-Version': 'v1.0'
        });
        
        console.log(`[${requestId}] Retrieved ${products.length} products successfully`);
        
    } catch (error) {
        console.error('Error getting products:', error);
        
        res.status(500).json({
            success: false,
            message: "Internal server error occurred while retrieving products",
            error: error.message,
            errorCode: "INTERNAL_SERVER_ERROR",
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * GET /api/products/stats
 * Get product statistics
 */
async function getProductStatsEndpoint(req, res) {
    try {
        const startTime = Date.now();
        const requestId = req.headers['x-request-id'] || `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        console.log(`[${requestId}] Getting product statistics`);
        
        const stats = await getProductStats();
        const responseTime = Date.now() - startTime;
        
        res.status(200).json({
            success: true,
            message: "Product statistics retrieved successfully",
            data: stats,
            metadata: {
                requestId: requestId,
                responseTime: `${responseTime}ms`,
                timestamp: new Date().toISOString()
            }
        });
        
        res.set({
            'X-Request-ID': requestId,
            'X-Response-Time': `${responseTime}ms`,
            'X-API-Version': 'v1.0'
        });
        
        console.log(`[${requestId}] Product statistics retrieved successfully`);
        
    } catch (error) {
        console.error('Error getting product statistics:', error);
        
        res.status(500).json({
            success: false,
            message: "Internal server error occurred while retrieving product statistics",
            error: error.message,
            errorCode: "INTERNAL_SERVER_ERROR",
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * Setup Express router with all product routes
 */
function setupProductRoutes() {
    const router = express.Router();
    
    // Middleware
    router.use(express.json());
    
    // Routes
    router.post('/api/createProduct', requireAuth, validateProductData, createProduct);
    router.get('/api/getProductDetails', requireAuth, getProductDetails);
    router.get('/api/products', requireAuth, getAllProductsEndpoint);
    router.get('/api/products/stats', requireAuth, getProductStatsEndpoint);
    
    return router;
}

/**
 * Create a complete Express app with product routes
 */
function createProductApp() {
    const app = express();
    
    // Basic middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // CORS middleware (if needed)
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Client-ID, X-Request-ID');
        
        if (req.method === 'OPTIONS') {
            res.sendStatus(200);
        } else {
            next();
        }
    });
    
    // Request logging middleware
    app.use((req, res, next) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${req.method} ${req.path} - ${req.ip}`);
        next();
    });
    
    // Setup product routes
    app.use(setupProductRoutes());
    
    // Health check endpoint
    app.get('/health', (req, res) => {
        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage()
        });
    });
    
    // 404 handler
    app.use((req, res) => {
        res.status(404).json({
            success: false,
            message: "Endpoint not found",
            error: `No route found for ${req.method} ${req.path}`,
            errorCode: "ENDPOINT_NOT_FOUND",
            timestamp: new Date().toISOString()
        });
    });
    
    // Error handler
    app.use((error, req, res, next) => {
        console.error('Unhandled error:', error);
        
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
            errorCode: "INTERNAL_SERVER_ERROR",
            timestamp: new Date().toISOString()
        });
    });
    
    return app;
}

// Export functions
module.exports = {
    createProduct,
    getProductDetails,
    getAllProductsEndpoint,
    getProductStatsEndpoint,
    setupProductRoutes,
    createProductApp,
    requireAuth,
    validateProductData
};

// If this file is run directly, start the server
if (require.main === module) {
    const app = createProductApp();
    const port = process.env.PORT || 3000;
    
    app.listen(port, () => {
        console.log(`Product API server running on port ${port}`);
        console.log(`Health check: http://localhost:${port}/health`);
        console.log(`Create Product: POST http://localhost:${port}/api/createProduct`);
        console.log(`Get Product: GET http://localhost:${port}/api/getProductDetails?productId=PRODUCT_ID`);
        console.log(`Get All Products: GET http://localhost:${port}/api/products`);
        console.log(`Get Stats: GET http://localhost:${port}/api/products/stats`);
    });
}
