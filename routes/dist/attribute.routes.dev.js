"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _express = _interopRequireDefault(require("express"));

var _attributeController = require("../controllers/attribute.controller.js");

var _authMiddleware = require("../middleware/authMiddleware.js");

var _uploadMiddleware = _interopRequireDefault(require("../middleware/uploadMiddleware.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var router = _express["default"].Router(); // Admin Routes
// router.post('/', protect, isAdmin, createAttribute);


router.post("/", _attributeController.createAttribute);
router.post("/values", _uploadMiddleware["default"].single("thumbnail"), _attributeController.createAttributeValue); // Public Routes

router.get("/", _attributeController.getAttributesWithValues);
var _default = router;
exports["default"] = _default;