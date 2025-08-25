"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _express = _interopRequireDefault(require("express"));

var _productController = require("../controllers/product.controller.js");

var _authMiddleware = require("../middleware/authMiddleware.js");

var _uploadMiddleware = _interopRequireDefault(require("../middleware/uploadMiddleware.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var router = _express["default"].Router();

router.get("/", _productController.getAllProducts);
router.get("/search", _productController.searchProducts);
router.get("/slug/:slug", _productController.getProductBySlug);
router.get("/category/:slug/products", _productController.getProductsByCategorySlug);
router.post("/bulk", _productController.getBulkProductsByIds); // Define all upload fields needed based on your schema embedded images/fields

var productImageFields = [{
  name: "featuredImage",
  maxCount: 1
}, {
  name: "basePhotos",
  maxCount: 10
}, {
  name: "banners.one.bannerImage",
  maxCount: 1
}, {
  name: "banners.two.bannerImage",
  maxCount: 1
}, {
  name: "banners.one.icon",
  maxCount: 1
}, {
  name: "banners.two.icon",
  maxCount: 1
}, {
  name: "featuredBanner.bannerImage",
  maxCount: 1
}]; // CREATE PRODUCT

router.post("/", _authMiddleware.protect, _authMiddleware.isAdmin, _uploadMiddleware["default"].fields(productImageFields), _productController.createProduct); // UPDATE PRODUCT

router.put("/:id", _authMiddleware.protect, _authMiddleware.isAdmin, _uploadMiddleware["default"].fields(productImageFields), _productController.updateProduct);
router["delete"]("/:id", _authMiddleware.protect, _authMiddleware.isAdmin, _productController.deleteProduct);
router.post("/:id/attributes", _productController.addAttributesToProduct);
router.post("/:productId/specifications", _productController.updateProductSpecifications);
var _default = router;
exports["default"] = _default;