"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getAttributesWithValues = exports.createAttributeValue = exports.createAttribute = void 0;

var _Attribute = _interopRequireDefault(require("../models/Attribute.js"));

var _AttributeValue = _interopRequireDefault(require("../models/AttributeValue.js"));

var _mongoose = _interopRequireDefault(require("mongoose"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

// CREATE ATTRIBUTE
var createAttribute = function createAttribute(req, res) {
  var _req$body, name, input_type, is_variant, attribute;

  return regeneratorRuntime.async(function createAttribute$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          _req$body = req.body, name = _req$body.name, input_type = _req$body.input_type, is_variant = _req$body.is_variant; // Validate required fields

          if (!(!name || !input_type)) {
            _context.next = 4;
            break;
          }

          return _context.abrupt("return", res.status(400).json({
            success: false,
            message: 'Name and input_type are required'
          }));

        case 4:
          _context.next = 6;
          return regeneratorRuntime.awrap(_Attribute["default"].create(req.body));

        case 6:
          attribute = _context.sent;
          return _context.abrupt("return", res.status(201).json({
            success: true,
            message: 'Attribute created successfully',
            data: attribute
          }));

        case 10:
          _context.prev = 10;
          _context.t0 = _context["catch"](0);
          return _context.abrupt("return", res.status(500).json({
            success: false,
            message: 'Failed to create attribute',
            error: process.env.NODE_ENV === 'development' ? _context.t0.message : undefined
          }));

        case 13:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[0, 10]]);
}; // CREATE ATTRIBUTE VALUE


exports.createAttribute = createAttribute;

var createAttributeValue = function createAttributeValue(req, res) {
  var _req$body2, attribute_id, label, value, attributeExists, valueExists, attributeValue;

  return regeneratorRuntime.async(function createAttributeValue$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _context2.prev = 0;
          _req$body2 = req.body, attribute_id = _req$body2.attribute_id, label = _req$body2.label, value = _req$body2.value; // Validate required fields

          if (!(!attribute_id || !label || !value)) {
            _context2.next = 4;
            break;
          }

          return _context2.abrupt("return", res.status(400).json({
            success: false,
            message: 'attribute_id, label and value are required'
          }));

        case 4:
          _context2.next = 6;
          return regeneratorRuntime.awrap(_Attribute["default"].exists({
            _id: attribute_id
          }));

        case 6:
          attributeExists = _context2.sent;

          if (attributeExists) {
            _context2.next = 9;
            break;
          }

          return _context2.abrupt("return", res.status(404).json({
            success: false,
            message: 'Attribute not found'
          }));

        case 9:
          _context2.next = 11;
          return regeneratorRuntime.awrap(_AttributeValue["default"].exists({
            attribute_id: attribute_id,
            $or: [{
              value: value
            }, {
              label: label
            }]
          }));

        case 11:
          valueExists = _context2.sent;

          if (!valueExists) {
            _context2.next = 14;
            break;
          }

          return _context2.abrupt("return", res.status(409).json({
            success: false,
            message: 'Value or label already exists for this attribute'
          }));

        case 14:
          _context2.next = 16;
          return regeneratorRuntime.awrap(_AttributeValue["default"].create(req.body));

        case 16:
          attributeValue = _context2.sent;
          return _context2.abrupt("return", res.status(201).json({
            success: true,
            message: 'Attribute value created successfully',
            data: attributeValue
          }));

        case 20:
          _context2.prev = 20;
          _context2.t0 = _context2["catch"](0);
          return _context2.abrupt("return", res.status(500).json({
            success: false,
            message: 'Failed to create attribute value',
            error: process.env.NODE_ENV === 'development' ? _context2.t0.message : undefined
          }));

        case 23:
        case "end":
          return _context2.stop();
      }
    }
  }, null, null, [[0, 20]]);
}; // GET ATTRIBUTES WITH VALUES


exports.createAttributeValue = createAttributeValue;

var getAttributesWithValues = function getAttributesWithValues(req, res) {
  var _req$query, is_variant, is_filterable, query, attributes;

  return regeneratorRuntime.async(function getAttributesWithValues$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _context3.prev = 0;
          _req$query = req.query, is_variant = _req$query.is_variant, is_filterable = _req$query.is_filterable;
          query = {};
          if (is_variant !== undefined) query.is_variant = is_variant;
          if (is_filterable !== undefined) query.is_filterable = is_filterable;
          _context3.next = 7;
          return regeneratorRuntime.awrap(_Attribute["default"].find(query).populate('values').sort({
            filter_order: 1,
            name: 1
          }));

        case 7:
          attributes = _context3.sent;
          return _context3.abrupt("return", res.status(200).json({
            success: true,
            data: attributes
          }));

        case 11:
          _context3.prev = 11;
          _context3.t0 = _context3["catch"](0);
          return _context3.abrupt("return", res.status(500).json({
            success: false,
            message: 'Failed to fetch attributes',
            error: process.env.NODE_ENV === 'development' ? _context3.t0.message : undefined
          }));

        case 14:
        case "end":
          return _context3.stop();
      }
    }
  }, null, null, [[0, 11]]);
};

exports.getAttributesWithValues = getAttributesWithValues;