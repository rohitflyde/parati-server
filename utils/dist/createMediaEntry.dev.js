"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createMediaEntry = void 0;

var _Media = _interopRequireDefault(require("../models/Media.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var createMediaEntry = function createMediaEntry(file, uploadedBy) {
  var now, media;
  return regeneratorRuntime.async(function createMediaEntry$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          now = new Date();
          _context.next = 3;
          return regeneratorRuntime.awrap(_Media["default"].create({
            fileName: file.originalname,
            filePath: file.path,
            fileSize: file.size,
            fileType: file.mimetype,
            title: file.originalname,
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            date: now.getDate(),
            uploadedBy: uploadedBy
          }));

        case 3:
          media = _context.sent;
          return _context.abrupt("return", media._id);

        case 5:
        case "end":
          return _context.stop();
      }
    }
  });
};

exports.createMediaEntry = createMediaEntry;