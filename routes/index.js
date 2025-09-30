import express from 'express';
import userRoutes from './user.routes.js';
import productRoutes from './product.routes.js';
import subcategoryRoutes from './subcategory.routes.js';
import customerRoutes from '../routes/customer.routes.js'
import mediaRoutes from '../routes/media.routes.js'
import addressRoutes from '../routes/address.routes.js'
import homepagecontentRoutes from '../routes/homepage.routes.js'
import siteConfigRoutes from '../routes/SiteConfig.routes.js'
import orderRoutes from '../routes/order.routes.js'


//NEW
import brandRoutes from '../routes/brand.routes.js'
import categoryRoutes from './category.routes.js'
import tagRoutes from './tag.routes.js';
import variantRoutes from './variants.routes.js'
import attributeRoutes from './attribute.routes.js'
import featureRoutes from './feature.routes.js'
import cartRoutes from './cart.routes.js'
import checkoutRoutes from './checkout.routes.js'
import locationRoutes from './location.routes.js';
import subCategoryRoutes from "./subcategory.routes.js"
import reviewRoutes from "./review.routes.js";
import navigationRoutes from "./navigation.routes.js";
import collectionRoutes from './collection.routes.js'
import logsRoutes from './logs.routes.js'

const router = express.Router();

router.use('/users/me/address', addressRoutes)
router.use('/customer', customerRoutes)
router.use('/media', mediaRoutes)

 
//NEW
router.use('/users', userRoutes);
router.use('/brand', brandRoutes)
router.use('/categories', categoryRoutes);
router.use('/tags', tagRoutes);
router.use('/attribute', attributeRoutes)
router.use('/variant', variantRoutes)
router.use('/feature', featureRoutes)
router.use('/products', productRoutes);
router.use('/cart', cartRoutes)
router.use('/chekout', checkoutRoutes)
router.use('/pincode', locationRoutes);
router.use('/orders', orderRoutes)
router.use("/subCategory", subCategoryRoutes)
router.use('/reviews', reviewRoutes)
router.use('/collections', collectionRoutes)
router.use('/logs', logsRoutes)





// SITE CONTENT 
router.use('/site-content', homepagecontentRoutes)
router.use('/site-content/config', siteConfigRoutes)
router.use('/site-content/mega-menu', navigationRoutes)



export default router;
