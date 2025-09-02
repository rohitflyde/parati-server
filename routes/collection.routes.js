import express from 'express';
import Collection from '../models/Collection.js';
import Product from '../models/Product.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// PUBLIC ROUTES

// Get all active collections
router.get('/', async (req, res) => {
    try {
        const {
            type,
            showOnHomepage,
            showInNavigation,
            includeProducts = false,
            limit,
            page = 1
        } = req.query;

        let query = { isActive: true };

        // Filters
        if (type) query.collectionType = type;
        if (showOnHomepage !== undefined) query.showOnHomepage = showOnHomepage === 'true';
        if (showInNavigation !== undefined) query.showInNavigation = showInNavigation === 'true';

        // Check for active date range
        const now = new Date();

        // Only add date filters if startDate or endDate exist
        // const dateFilters = [];
        // dateFilters.push({
        //     $or: [
        //         { startDate: { $exists: false } },
        //         { startDate: { $lte: now } }
        //     ]
        // });
        // dateFilters.push({
        //     $or: [
        //         { endDate: { $exists: false } },
        //         { endDate: { $gte: now } }
        //     ]
        // });

        // if (dateFilters.length > 0) {
        //     query.$and = dateFilters;
        // }

        const collectionsQuery = Collection.find(query)
            .populate('featuredImage bannerImage thumbnailImage')
            .sort({ displayOrder: 1, createdAt: -1 });

        if (limit) collectionsQuery.limit(parseInt(limit));
        if (page > 1) collectionsQuery.skip((page - 1) * (limit || 20));

        let collections = await collectionsQuery;

        // Include product count for each collection
        if (includeProducts === 'true') {
            const collectionsWithProductCount = await Promise.all(
                collections.map(async (collection) => {
                    const productCount = await Product.countDocuments({
                        collections: collection._id,
                        status: true
                    });
                    const collectionObj = collection.toObject();
                    collectionObj.productCount = productCount;
                    return collectionObj;
                })
            );
            collections = collectionsWithProductCount;
        }

        const total = await Collection.countDocuments(query);

        res.json({
            success: true,
            collections,
            total
        });

    } catch (error) {
        console.error('Collection fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch collections',
            error: error.message
        });
    }
});

// Get single collection by slug
router.get('/:slug', async (req, res) => {
    try {
        const collection = await Collection.findOne({
            slug: req.params.slug,
            isActive: true
        }).populate('featuredImage bannerImage thumbnailImage');

        if (!collection) {
            return res.status(404).json({
                success: false,
                message: 'Collection not found'
            });
        }

        // Check if collection is currently active (considering dates)
        if (!collection.isCurrentlyActive()) {
            return res.status(404).json({
                success: false,
                message: 'Collection is not currently active'
            });
        }

        // Increment view count
        await Collection.findByIdAndUpdate(collection._id, {
            $inc: { viewCount: 1 }
        });

        res.json({
            success: true,
            collection
        });

    } catch (error) {
        console.error('Collection fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch collection',
            error: error.message
        });
    }
});

// Get products by collection
router.get('/:slug/products', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            sort = "-createdAt",
            featured = false,
            brandId,
            categoryId,
            minPrice,
            maxPrice,
            inStock
        } = req.query;

        // Find collection
        const collection = await Collection.findOne({
            slug: req.params.slug,
            isActive: true
        });

        if (!collection || !collection.isCurrentlyActive()) {
            return res.status(404).json({
                success: false,
                message: 'Collection not found'
            });
        }

        // Build product query
        let productQuery = {
            collections: collection._id,
            status: true
        };

        // Additional filters
        if (featured === 'true') {
            productQuery['collectionData'] = {
                $elemMatch: {
                    collectionId: collection._id,
                    featuredInCollection: true
                }
            };
        }

        if (brandId) productQuery.brandId = brandId;
        if (categoryId) productQuery.categories = categoryId;
        if (inStock === 'true') productQuery.stockStatus = 'in_stock';

        // Price filtering (considering both salePrice and basePrice)
        if (minPrice || maxPrice) {
            const priceConditions = [];

            const basePriceCondition = {
                basePrice: {
                    ...(minPrice && { $gte: parseFloat(minPrice) }),
                    ...(maxPrice && { $lte: parseFloat(maxPrice) })
                }
            };

            const salePriceCondition = {
                salePrice: {
                    $exists: true,
                    $ne: null,
                    ...(minPrice && { $gte: parseFloat(minPrice) }),
                    ...(maxPrice && { $lte: parseFloat(maxPrice) })
                }
            };

            // If salePrice exists and is within range, use it; otherwise use basePrice
            productQuery.$or = [
                salePriceCondition,
                {
                    $and: [
                        { $or: [{ salePrice: { $exists: false } }, { salePrice: null }] },
                        basePriceCondition
                    ]
                }
            ];
        }

        // Custom sort for collection-specific ordering
        let sortOption = {};
        if (sort.includes('collectionOrder')) {
            sortOption = { 'collectionData.collectionDisplayOrder': sort.startsWith('-') ? -1 : 1 };
        } else {
            const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
            sortOption[sortField] = sort.startsWith('-') ? -1 : 1;
        }

        const products = await Product.find(productQuery)
            .populate('brandId categories featuredImage basePhotos collections')
            .sort(sortOption)
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await Product.countDocuments(productQuery);

        res.json({
            success: true,
            collection: {
                _id: collection._id,
                name: collection.name,
                title: collection.title,
                slug: collection.slug
            },
            products,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Collection products fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch collection products',
            error: error.message
        });
    }
});

// Get festival collections (special endpoint)
router.get('/type/festivals', async (req, res) => {
    try {
        const now = new Date();

        const collections = await Collection.find({
            collectionType: 'festival',
            isActive: true,
            $and: [
                {
                    $or: [
                        { startDate: { $exists: false } },
                        { startDate: { $lte: now } }
                    ]
                },
                {
                    $or: [
                        { endDate: { $exists: false } },
                        { endDate: { $gte: now } }
                    ]
                }
            ]
        })
            .populate('featuredImage thumbnailImage')
            .sort({ startDate: 1, displayOrder: 1 });

        res.json({
            success: true,
            collections
        });

    } catch (error) {
        console.error('Festival collections fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch festival collections',
            error: error.message
        });
    }
});

// ADMIN ROUTES (Protected)

// Create collection
router.post('/', protect, async (req, res) => {
    try {
        const collectionData = {
            ...req.body,
            createdBy: req.user.id
        };

        // Generate slug if not provided
        if (!collectionData.slug && collectionData.name) {
            collectionData.slug = collectionData.name
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
        }

        const collection = new Collection(collectionData);
        await collection.save();

        // Populate references before sending response
        await collection.populate('featuredImage bannerImage thumbnailImage');

        res.status(201).json({
            success: true,
            message: 'Collection created successfully',
            collection
        });

    } catch (error) {
        console.error('Collection creation error:', error);
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Collection name or slug already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to create collection',
            error: error.message
        });
    }
});

// Update collection
router.put('/:id', protect, async (req, res) => {
    try {
        const collection = await Collection.findByIdAndUpdate(
            req.params.id,
            {
                ...req.body,
                lastUpdatedBy: req.user.id
            },
            { new: true, runValidators: true }
        ).populate('featuredImage bannerImage thumbnailImage');

        if (!collection) {
            return res.status(404).json({
                success: false,
                message: 'Collection not found'
            });
        }

        res.json({
            success: true,
            message: 'Collection updated successfully',
            collection
        });

    } catch (error) {
        console.error('Collection update error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update collection',
            error: error.message
        });
    }
});

// Delete collection
router.delete('/:id', protect, async (req, res) => {
    try {
        const collection = await Collection.findByIdAndDelete(req.params.id);

        if (!collection) {
            return res.status(404).json({
                success: false,
                message: 'Collection not found'
            });
        }

        // Remove collection from all products
        await Product.updateMany(
            { collections: collection._id },
            {
                $pull: {
                    collections: collection._id
                },
                $set: {
                    collectionData: {
                        $filter: {
                            input: "$collectionData",
                            cond: { $ne: ["$$this.collectionId", collection._id] }
                        }
                    }
                }
            }
        );

        res.json({
            success: true,
            message: 'Collection deleted successfully'
        });

    } catch (error) {
        console.error('Collection deletion error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete collection',
            error: error.message
        });
    }
});

// Add products to collection
router.post('/:id/products', protect, async (req, res) => {
    try {
        const { productIds, featured = false, displayOrder = 0 } = req.body;
        const collectionId = req.params.id;

        // Verify collection exists
        const collection = await Collection.findById(collectionId);
        if (!collection) {
            return res.status(404).json({
                success: false,
                message: 'Collection not found'
            });
        }

        // Add products to collection
        const updateResults = await Promise.all(
            productIds.map(async (productId) => {
                try {
                    const product = await Product.findById(productId);
                    if (product) {
                        return await product.addToCollection(collectionId, {
                            featured,
                            displayOrder
                        });
                    }
                    return null;
                } catch (error) {
                    console.error(`Error adding product ${productId} to collection:`, error);
                    return null;
                }
            })
        );

        const successCount = updateResults.filter(result => result !== null).length;

        res.json({
            success: true,
            message: `${successCount} products added to collection`,
            addedCount: successCount
        });

    } catch (error) {
        console.error('Add products to collection error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add products to collection',
            error: error.message
        });
    }
});

// Remove products from collection
router.delete('/:id/products', protect, async (req, res) => {
    try {
        const { productIds } = req.body;
        const collectionId = req.params.id;

        const results = await Promise.all(
            productIds.map(async (productId) => {
                try {
                    const product = await Product.findById(productId);
                    if (product) {
                        return await product.removeFromCollection(collectionId);
                    }
                    return null;
                } catch (error) {
                    console.error(`Error removing product ${productId} from collection:`, error);
                    return null;
                }
            })
        );

        const successCount = results.filter(result => result !== null).length;

        res.json({
            success: true,
            message: `${successCount} products removed from collection`
        });

    } catch (error) {
        console.error('Remove products from collection error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove products from collection',
            error: error.message
        });
    }
});

// Get collection analytics
router.get('/:id/analytics', protect, async (req, res) => {
    try {
        const collection = await Collection.findById(req.params.id);

        if (!collection) {
            return res.status(404).json({
                success: false,
                message: 'Collection not found'
            });
        }

        const productCount = await Product.countDocuments({
            collections: collection._id,
            status: true
        });

        const featuredProductCount = await Product.countDocuments({
            collections: collection._id,
            "collectionData.featuredInCollection": true,
            status: true
        });

        res.json({
            success: true,
            analytics: {
                productCount,
                featuredProductCount,
                viewCount: collection.viewCount || 0,
                clickCount: collection.clickCount || 0,
                isCurrentlyActive: collection.isCurrentlyActive()
            }
        });

    } catch (error) {
        console.error('Collection analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch analytics',
            error: error.message
        });
    }
});

export default router;