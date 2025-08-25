import Attribute from '../models/Attribute.js';
import Product from '../models/Product.js';
import Variant from '../models/Variant.js';

export const generateVariants = async (productId) => {
    try {
        const product = await Product.findById(productId);
        if (!product) throw new Error('Product not found');

        // Get variant attributes
        const variantAttributes = await Attribute.find({
            _id: { $in: product.variant_attributes },
            is_variant: true
        }).populate('values');

        if (variantAttributes.length === 0) {
            return []; // No variants needed
        }

        // Generate all possible combinations
        const combinations = cartesianProduct(
            variantAttributes.map(attr => attr.values)
        );

        // Create/update variants
        const variants = [];
        for (const combination of combinations) {
            const attributes = combination.map(value => ({
                attribute_id: value.attribute_id,
                attribute_value_id: value._id
            }));

            // Generate SKU (product.sku + attribute values)
            const skuParts = [product.sku];
            combination.forEach(val => skuParts.push(val.slug));
            const sku = skuParts.join('-').toUpperCase();

            // Find or create variant
            const variant = await Variant.findOneAndUpdate(
                { product_id: productId, sku },
                {
                    $set: {
                        attributes,
                        price: product.price, // Default to product price
                        inventory: {
                            quantity: 0,
                            backorder: false
                        }
                    }
                },
                { upsert: true, new: true }
            );

            variants.push(variant);
        }

        return variants;

    } catch (err) {
        console.error('Variant Generation Error:', err);
        throw err;
    }
};

// Helper for Cartesian product
function cartesianProduct(arrays) {
    return arrays.reduce((a, b) =>
        a.flatMap(x => b.map(y => [...x, y])),
        [[]]
    );
}