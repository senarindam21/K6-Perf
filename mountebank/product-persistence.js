/**
 * Product Persistence Utility
 * This module provides functions to save and retrieve product data from a JSON file
 * Use this with your Node.js backend to persist product data when using mountebank
 */

const fs = require('fs').promises;
const path = require('path');

// Configuration
const PRODUCTS_FILE_PATH = path.join(__dirname, 'data', 'products.json');
const BACKUP_DIR = path.join(__dirname, 'data', 'backups');

/**
 * Ensure the data directory exists
 */
async function ensureDataDirectory() {
    try {
        const dataDir = path.dirname(PRODUCTS_FILE_PATH);
        await fs.mkdir(dataDir, { recursive: true });
        await fs.mkdir(BACKUP_DIR, { recursive: true });
    } catch (error) {
        console.error('Error creating data directory:', error);
    }
}

/**
 * Generate a unique product ID
 */
function generateProductId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9).toUpperCase();
    return `PROD-${random}-${new Date().getFullYear()}`;
}

/**
 * Generate a product code based on product name and brand
 */
function generateProductCode(productName, brand) {
    const cleanName = productName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const cleanBrand = brand.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const nameCode = cleanName.substr(0, 8);
    const brandCode = cleanBrand.substr(0, 4);
    const numericSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${brandCode}-${nameCode}-${numericSuffix}`;
}

/**
 * Load existing products from the JSON file
 */
async function loadProducts() {
    try {
        await ensureDataDirectory();
        const data = await fs.readFile(PRODUCTS_FILE_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // File doesn't exist, return empty array
            return [];
        }
        console.error('Error loading products:', error);
        return [];
    }
}

/**
 * Save products array to the JSON file
 */
async function saveProducts(products) {
    try {
        await ensureDataDirectory();
        
        // Create backup before saving
        try {
            await createBackup();
        } catch (backupError) {
            console.warn('Warning: Could not create backup:', backupError.message);
        }
        
        const dataToSave = {
            products: products,
            metadata: {
                totalCount: products.length,
                lastUpdated: new Date().toISOString(),
                version: '1.0'
            }
        };
        
        await fs.writeFile(PRODUCTS_FILE_PATH, JSON.stringify(dataToSave, null, 2), 'utf8');
        console.log(`Products saved successfully. Total count: ${products.length}`);
        return true;
    } catch (error) {
        console.error('Error saving products:', error);
        return false;
    }
}

/**
 * Create a backup of the current products file
 */
async function createBackup() {
    try {
        const data = await fs.readFile(PRODUCTS_FILE_PATH, 'utf8');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(BACKUP_DIR, `products-backup-${timestamp}.json`);
        await fs.writeFile(backupPath, data, 'utf8');
        console.log(`Backup created: ${backupPath}`);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
        // File doesn't exist, no need to backup
    }
}

/**
 * Save a new product to the JSON file
 */
async function saveProductToFile(productData) {
    try {
        // Load existing products
        const existingProducts = await loadProducts();
        
        // Generate product ID and code if not provided
        const productId = productData.productId || generateProductId();
        const productCode = productData.productCode || generateProductCode(productData.productName, productData.brand);
        
        // Create enhanced product object
        const newProduct = {
            productId: productId,
            productCode: productCode,
            productName: productData.productName,
            status: productData.status || 'ACTIVE',
            category: productData.category,
            subCategory: productData.subCategory || null,
            brand: productData.brand,
            description: productData.description || null,
            price: productData.price || null,
            currency: productData.currency || 'USD',
            specifications: productData.specifications || {},
            tags: productData.tags || [],
            sku: productData.sku || `SKU-${productCode}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            estimatedAvailability: productData.estimatedAvailability || new Date(Date.now() + Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(),
            qrCode: `https://api.productservice.com/qr/${productId}`,
            deepLink: `productapp://product/${productId}`,
            metadata: {
                createdBy: productData.createdBy || 'system',
                source: productData.source || 'api',
                version: '1.0'
            }
        };
        
        // Add to existing products
        existingProducts.push(newProduct);
        
        // Save updated products array
        const saved = await saveProducts(existingProducts);
        
        if (saved) {
            console.log('Product saved successfully:', {
                productId: newProduct.productId,
                productName: newProduct.productName,
                productCode: newProduct.productCode
            });
            return newProduct;
        } else {
            throw new Error('Failed to save product to file');
        }
    } catch (error) {
        console.error('Error in saveProductToFile:', error);
        throw error;
    }
}

/**
 * Get a product by ID from the JSON file
 */
async function getProductById(productId) {
    try {
        const products = await loadProducts();
        const product = products.find(p => p.productId === productId);
        
        if (product) {
            console.log('Product found:', product.productName);
            return product;
        } else {
            console.log('Product not found with ID:', productId);
            return null;
        }
    } catch (error) {
        console.error('Error getting product by ID:', error);
        return null;
    }
}

/**
 * Get all products from the JSON file
 */
async function getAllProducts() {
    try {
        const products = await loadProducts();
        console.log(`Retrieved ${products.length} products`);
        return products;
    } catch (error) {
        console.error('Error getting all products:', error);
        return [];
    }
}

/**
 * Delete a product by ID
 */
async function deleteProductById(productId) {
    try {
        const products = await loadProducts();
        const initialCount = products.length;
        const filteredProducts = products.filter(p => p.productId !== productId);
        
        if (filteredProducts.length < initialCount) {
            await saveProducts(filteredProducts);
            console.log('Product deleted successfully:', productId);
            return true;
        } else {
            console.log('Product not found for deletion:', productId);
            return false;
        }
    } catch (error) {
        console.error('Error deleting product:', error);
        return false;
    }
}

/**
 * Update a product by ID
 */
async function updateProductById(productId, updateData) {
    try {
        const products = await loadProducts();
        const productIndex = products.findIndex(p => p.productId === productId);
        
        if (productIndex !== -1) {
            // Update the product
            products[productIndex] = {
                ...products[productIndex],
                ...updateData,
                updatedAt: new Date().toISOString()
            };
            
            await saveProducts(products);
            console.log('Product updated successfully:', productId);
            return products[productIndex];
        } else {
            console.log('Product not found for update:', productId);
            return null;
        }
    } catch (error) {
        console.error('Error updating product:', error);
        return null;
    }
}

/**
 * Search products by various criteria
 */
async function searchProducts(criteria) {
    try {
        const products = await loadProducts();
        let filteredProducts = products;
        
        if (criteria.category) {
            filteredProducts = filteredProducts.filter(p => 
                p.category.toLowerCase().includes(criteria.category.toLowerCase())
            );
        }
        
        if (criteria.brand) {
            filteredProducts = filteredProducts.filter(p => 
                p.brand.toLowerCase().includes(criteria.brand.toLowerCase())
            );
        }
        
        if (criteria.productName) {
            filteredProducts = filteredProducts.filter(p => 
                p.productName.toLowerCase().includes(criteria.productName.toLowerCase())
            );
        }
        
        if (criteria.status) {
            filteredProducts = filteredProducts.filter(p => p.status === criteria.status);
        }
        
        console.log(`Search found ${filteredProducts.length} products`);
        return filteredProducts;
    } catch (error) {
        console.error('Error searching products:', error);
        return [];
    }
}

/**
 * Get product statistics
 */
async function getProductStats() {
    try {
        const products = await loadProducts();
        
        const stats = {
            totalProducts: products.length,
            activeProducts: products.filter(p => p.status === 'ACTIVE').length,
            inactiveProducts: products.filter(p => p.status === 'INACTIVE').length,
            categoryCounts: {},
            brandCounts: {},
            recentProducts: products
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 5)
                .map(p => ({ productId: p.productId, productName: p.productName, createdAt: p.createdAt }))
        };
        
        // Count by category
        products.forEach(p => {
            stats.categoryCounts[p.category] = (stats.categoryCounts[p.category] || 0) + 1;
        });
        
        // Count by brand
        products.forEach(p => {
            stats.brandCounts[p.brand] = (stats.brandCounts[p.brand] || 0) + 1;
        });
        
        return stats;
    } catch (error) {
        console.error('Error getting product stats:', error);
        return null;
    }
}

// Export all functions
module.exports = {
    saveProductToFile,
    getProductById,
    getAllProducts,
    deleteProductById,
    updateProductById,
    searchProducts,
    getProductStats,
    generateProductId,
    generateProductCode,
    loadProducts,
    saveProducts,
    createBackup
};

// Example usage
if (require.main === module) {
    // This runs only if the file is executed directly
    console.log('Product Persistence Utility');
    console.log('Available functions:');
    console.log('- saveProductToFile(productData)');
    console.log('- getProductById(productId)');
    console.log('- getAllProducts()');
    console.log('- deleteProductById(productId)');
    console.log('- updateProductById(productId, updateData)');
    console.log('- searchProducts(criteria)');
    console.log('- getProductStats()');
    
    // Example: Create a test product
    // (Uncomment to test)
    /*
    async function testPersistence() {
        const testProduct = {
            productName: "Test Product",
            category: "Test Category",
            brand: "Test Brand",
            description: "This is a test product",
            price: 99.99
        };
        
        const savedProduct = await saveProductToFile(testProduct);
        console.log('Test product created:', savedProduct);
        
        const retrievedProduct = await getProductById(savedProduct.productId);
        console.log('Test product retrieved:', retrievedProduct);
        
        const stats = await getProductStats();
        console.log('Product stats:', stats);
    }
    
    testPersistence().catch(console.error);
    */
}
