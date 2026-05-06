const mongoose = require("mongoose");

const toolSchema = new mongoose.Schema({
  productCode: {
    type: String,
    required: [true, "Vui lòng nhập mã sản phẩm"],
    unique: true,
    trim: true,
    uppercase: true,
  },
  name: {
    type: String,
    required: [true, "Vui lòng nhập tên dụng cụ"],
    trim: true,
  },
  category: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: ["new", "old", "usable", "unusable"],
    default: "new",
  },
  isInUse: {
    type: Boolean,
    default: false,
  },
  currentUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  location: {
    type: String,
    enum: ["warehouse", "in_use", "maintenance", "disposed"],
    default: "warehouse",
  },
  // Thông tin hình học và đặc điểm
  geometry: {
    length: Number,
    width: Number,
    height: Number,
    diameter: Number,
    shape: String,
    material: String,
  },
  characteristics: {
    hardness: String,
    coating: String,
    brand: String,
    model: String,
    specifications: String,
  },
  // Thông tin chế độ cắt
  cuttingParameters: {
    speed: Number,
    feed: Number,
    depth: Number,
    notes: String,
  },
  // Catalog thông tin
  catalogInfo: {
    manufacturer: String,
    catalogNumber: String,
    source: {
      type: String,
      enum: ["manufacturer", "experience"],
    },
    reference: String,
  },
  // Thống kê sử dụng
  usageCount: {
    type: Number,
    default: 0,
  },
  lastUsedDate: {
    type: Date,
  },
  // Lịch sử
  history: [
    {
      action: {
        type: String,
        enum: ["import", "export", "transfer", "update", "maintenance"],
      },
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      fromLocation: String,
      toLocation: String,
      notes: String,
      date: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  slotIndex: {
    type: Number,
    min: 1,
    max: 9,
  },
});

toolSchema.pre("save", async function () {
  this.updatedAt = new Date();
});

module.exports = mongoose.model("Tool", toolSchema);
