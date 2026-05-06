const express = require("express");
const { body, validationResult } = require("express-validator");
const mongoose = require("mongoose");
const ExportReceipt = require("../models/ExportReceipt");
const Tool = require("../models/Tool");
const { protect, authorize } = require("../middleware/auth");
const { triggerSlot } = require("../utils/plcTrigger");

const router = express.Router();

// Generate receipt number
const generateReceiptNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `XK-${year}${month}${day}-${random}`;
};

// @route   GET /api/export-receipts
// @desc    Get all export receipts
// @access  Private/Admin
router.get("/", protect, authorize("admin"), async (req, res) => {
  try {
    const receipts = await ExportReceipt.find()
      .populate("exportedBy", "username fullName")
      .populate("tools.tool")
      .sort({ exportDate: -1 });

    res.json({
      success: true,
      count: receipts.length,
      data: receipts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
});

// @route   GET /api/export-receipts/:id
// @desc    Get single export receipt
// @access  Private/Admin
router.get("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const receipt = await ExportReceipt.findById(req.params.id)
      .populate("exportedBy", "username fullName department")
      .populate("tools.tool");

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phiếu xuất kho",
      });
    }

    res.json({
      success: true,
      data: receipt,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
});

// @route   POST /api/export-receipts
// @desc    Create export receipt
// @access  Private/Admin
router.post(
  "/",
  protect,
  authorize("admin"),
  [
    body("tools").isArray().withMessage("Vui lòng chọn dụng cụ"),
    body("tools.*.tool").notEmpty().withMessage("Vui lòng chọn dụng cụ"),
  ],
  async (req, res) => {
    console.log("🚨🚨🚨 [POST /api/export-receipts] Request received! 🚨🚨🚨");
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    try {
      const { tools, purpose, department, notes } = req.body;

      // Verify all tools exist and are available
      for (const item of tools) {
        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(item.tool)) {
          return res.status(400).json({
            success: false,
            message: `ID dụng cụ không hợp lệ: ${item.tool}. Vui lòng sử dụng ID hợp lệ từ MongoDB.`,
          });
        }

        const tool = await Tool.findById(item.tool);
        if (!tool) {
          return res.status(404).json({
            success: false,
            message: `Không tìm thấy dụng cụ với ID: ${item.tool}`,
          });
        }
        if (tool.isInUse) {
          return res.status(400).json({
            success: false,
            message: `Dụng cụ ${tool.productCode} đang được sử dụng`,
          });
        }
      }

      // Create receipt
      const receipt = await ExportReceipt.create({
        receiptNumber: generateReceiptNumber(),
        exportedBy: req.user._id,
        tools,
        purpose,
        department,
        notes,
        status: "completed",
      });

      // Update tools status
      for (const item of tools) {
        const tool = await Tool.findById(item.tool);
        tool.isInUse = true;
        tool.currentUser = req.user._id;
        tool.location = "in_use";
        tool.usageCount += 1;
        tool.lastUsedDate = new Date();
        tool.history.push({
          action: "export",
          user: req.user._id,
          fromLocation: "warehouse",
          toLocation: "in_use",
          notes: `Xuất kho - Phiếu: ${receipt.receiptNumber}`,
          date: new Date(),
        });
        await tool.save();
      }

      // === GỬI TRIGGER PLC — mỗi slot chỉ trigger 1 lần ===
      console.log("🔍 [DEBUG] Bắt đầu trigger PLC, số tools:", tools.length);
      const triggeredSlots = new Set();
      for (const item of tools) {
        const toolDoc = await Tool.findById(item.tool);
        const slotIndex = toolDoc?.slotIndex;
        console.log("🔍 [DEBUG] Tool:", toolDoc?.productCode, "slotIndex:", slotIndex);
        if (slotIndex && !triggeredSlots.has(slotIndex)) {
          triggeredSlots.add(slotIndex);
          try {
            await triggerSlot(slotIndex);
            console.log(`Xuất ${toolDoc.productCode} tại slot ${slotIndex}`);
          } catch (plcErr) {
            console.error(`⚠️ Trigger PLC slot ${slotIndex} lỗi:`, plcErr);
            // Không block response — phiếu vẫn được tạo
          }
        }
      }

      const populatedReceipt = await ExportReceipt.findById(receipt._id)
        .populate("exportedBy", "username fullName")
        .populate("tools.tool");

      res.status(201).json({
        success: true,
        message: "Tạo phiếu xuất kho thành công",
        data: populatedReceipt,
      });
    } catch (error) {
      console.error("Create export receipt error:", error);

      // Handle Mongoose cast errors
      if (error.name === "CastError") {
        return res.status(400).json({
          success: false,
          message: "ID không hợp lệ. Vui lòng kiểm tra lại ID của dụng cụ.",
          error: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: "Lỗi server",
        error: error.message,
      });
    }
  }
);

// @route   DELETE /api/export-receipts/:id
// @desc    Delete export receipt
// @access  Private/Admin
router.delete("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const receipt = await ExportReceipt.findById(req.params.id).populate(
      "tools.tool"
    );

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phiếu xuất kho",
      });
    }

    // Nếu phiếu đã hoàn thành, cần trả dụng cụ về kho
    if (receipt.status === "completed" && receipt.tools) {
      for (const item of receipt.tools) {
        if (item.tool) {
          const tool = await Tool.findById(item.tool._id || item.tool);
          if (tool) {
            tool.isInUse = false;
            tool.currentUser = null;
            tool.location = "warehouse";
            tool.history.push({
              action: "import",
              user: req.user._id,
              fromLocation: "in_use",
              toLocation: "warehouse",
              notes: `Xóa phiếu xuất kho - Phiếu: ${receipt.receiptNumber}`,
              date: new Date(),
            });
            await tool.save();
          }
        }
      }
    }

    await receipt.deleteOne();

    res.json({
      success: true,
      message: "Xóa phiếu xuất kho thành công",
    });
  } catch (error) {
    console.error("Delete export receipt error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
});

module.exports = router;
