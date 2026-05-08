const express = require("express");
const { body, validationResult } = require("express-validator");
const Tool = require("../models/Tool");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// @route   GET /api/tools
// @desc    Get all tools with filters
// @access  Private
router.get("/", protect, async (req, res) => {
  try {
    const {
      status,
      isInUse,
      location,
      search,
      productCode,
      category,
      page = 1,
      limit = 20,
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (isInUse !== undefined) query.isInUse = isInUse === "true";
    if (location) query.location = location;
    if (category) query.category = category;
    if (productCode) query.productCode = { $regex: productCode, $options: "i" };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { productCode: { $regex: search, $options: "i" } },
        { "characteristics.brand": { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tools = await Tool.find(query)
      .populate("currentUser", "username fullName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Tool.countDocuments(query);

    res.json({
      success: true,
      count: tools.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: tools,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
});

// @route   GET /api/tools/statistics
// @desc    Get tool statistics
// @access  Private
router.get("/statistics", protect, async (req, res) => {
  try {
    const totalTools = await Tool.countDocuments();
    const toolsInUse = await Tool.countDocuments({ isInUse: true });
    const toolsByStatus = await Tool.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const mostUsedTools = await Tool.find()
      .sort({ usageCount: -1 })
      .limit(10)
      .select("name productCode usageCount");

    const leastUsedTools = await Tool.find()
      .sort({ usageCount: 1 })
      .limit(10)
      .select("name productCode usageCount");

    const toolsByLocation = await Tool.aggregate([
      {
        $group: {
          _id: "$location",
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        totalTools,
        toolsInUse,
        toolsByStatus,
        toolsByLocation,
        mostUsedTools,
        leastUsedTools,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
});

// @route   GET /api/tools/in-use
// @desc    Get tools currently in use
// @access  Private
router.get("/in-use", protect, async (req, res) => {
  try {
    const tools = await Tool.find({ isInUse: true })
      .populate("currentUser", "username fullName department")
      .sort({ lastUsedDate: -1 });

    res.json({
      success: true,
      count: tools.length,
      data: tools,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
});

// @route   GET /api/tools/:id
// @desc    Get single tool
// @access  Private
router.get("/:id", protect, async (req, res) => {
  try {
    const tool = await Tool.findById(req.params.id).populate(
      "currentUser",
      "username fullName"
    );

    if (!tool) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy dụng cụ",
      });
    }

    res.json({
      success: true,
      data: tool,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
});

// @route   POST /api/tools
// @desc    Create new tool
// @access  Private
router.post(
  "/",
  protect,
  [
    body("productCode").notEmpty().withMessage("Vui lòng nhập mã sản phẩm"),
    body("name").notEmpty().withMessage("Vui lòng nhập tên dụng cụ"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    try {
      const { productCode } = req.body;

      if (!productCode) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng nhập mã sản phẩm",
        });
      }

      // Check if tool already exists (case-insensitive due to uppercase in schema)
      const existingTool = await Tool.findOne({
        productCode: productCode.toUpperCase().trim(),
      });
      if (existingTool) {
        return res.status(400).json({
          success: false,
          message: "Mã sản phẩm đã tồn tại",
        });
      }

      // Remove history from req.body if it exists, we'll add our own
      const { history, ...toolFields } = req.body;

      // Logic to assign slotIndex (1-9) — DB only
      const toolName = (toolFields.name || "").trim();

      // Kiểm tra tổng số tủ từ DB. Nếu >= 90 thì từ chối
      const totalDb = await Tool.countDocuments();
      if (totalDb >= 90) {
        return res.status(400).json({
          success: false,
          message: "Tủ dụng cụ đã đầy (90/90 dụng cụ)",
        });
      }

      // 1. Tìm ngăn đang chứa cùng tên và chưa đầy (DB count < 10)
      const slotsForName = await Tool.aggregate([
        { $match: { name: toolName } },
        { $group: { _id: "$slotIndex", count: { $sum: 1 } } },
        { $match: { count: { $lt: 10 } } },
        { $sort: { _id: 1 } }
      ]);

      let assignedSlotIndex;

      if (slotsForName.length > 0) {
        // Dùng ngăn đầu tiên còn chỗ
        assignedSlotIndex = slotsForName[0]._id;
      } else {
        // 2. Tên mới hoặc tất cả ngăn cùng tên đã đầy → tìm ngăn trống
        const occupiedSlots = await Tool.distinct("slotIndex");

        // Tìm chỉ số ngăn trống đầu tiên từ 1 tới 9
        for (let i = 1; i <= 9; i++) {
          if (!occupiedSlots.includes(i)) {
            assignedSlotIndex = i;
            break;
          }
        }
      }

      if (!assignedSlotIndex) {
        return res.status(400).json({
          success: false,
          message: "Tủ dụng cụ đã đầy (9/9 ngăn)",
        });
      }

      const toolData = {
        ...toolFields,
        slotIndex: assignedSlotIndex,
        history: [
          {
            action: "import",
            user: req.user._id,
            notes: "Nhập dụng cụ mới",
            date: new Date(),
          },
        ],
      };

      console.log(
        "Creating tool with data:",
        JSON.stringify(toolData, null, 2)
      );
      const tool = await Tool.create(toolData);

      res.status(201).json({
        success: true,
        message: "Thêm dụng cụ thành công",
        data: tool,
      });
    } catch (error) {
      console.error("Create tool error:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi server",
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  }
);

// @route   PUT /api/tools/:id
// @desc    Update tool
// @access  Private
router.put("/:id", protect, async (req, res) => {
  try {
    let tool = await Tool.findById(req.params.id);

    if (!tool) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy dụng cụ",
      });
    }

    // Add to history
    const historyEntry = {
      action: "update",
      user: req.user._id,
      notes: req.body.updateNotes || "Cập nhật thông tin dụng cụ",
      date: new Date(),
    };

    tool = await Tool.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        $push: { history: historyEntry },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    res.json({
      success: true,
      message: "Cập nhật dụng cụ thành công",
      data: tool,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
});

// @route   PUT /api/tools/:id/transfer
// @desc    Transfer tool between locations
// @access  Private
router.put(
  "/:id/transfer",
  protect,
  [body("toLocation").notEmpty().withMessage("Vui lòng chọn vị trí đích")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    try {
      const tool = await Tool.findById(req.params.id);

      if (!tool) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy dụng cụ",
        });
      }

      const { toLocation, notes } = req.body;

      const historyEntry = {
        action: "transfer",
        user: req.user._id,
        fromLocation: tool.location,
        toLocation,
        notes: notes || "Chuyển dụng cụ",
        date: new Date(),
      };

      tool.location = toLocation;
      tool.history.push(historyEntry);

      if (toLocation === "in_use") {
        tool.isInUse = true;
        tool.currentUser = req.user._id;
        tool.usageCount += 1;
        tool.lastUsedDate = new Date();
      } else if (toLocation === "warehouse") {
        tool.isInUse = false;
        tool.currentUser = null;
      }

      await tool.save();

      res.json({
        success: true,
        message: "Chuyển dụng cụ thành công",
        data: tool,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Lỗi server",
        error: error.message,
      });
    }
  }
);

// @route   DELETE /api/tools/:id
// @desc    Delete tool
// @access  Private (Admin only)
router.delete("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const tool = await Tool.findById(req.params.id);

    if (!tool) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy dụng cụ",
      });
    }

    await tool.deleteOne();

    res.json({
      success: true,
      message: "Xóa dụng cụ thành công",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
});

module.exports = router;
