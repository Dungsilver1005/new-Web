const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const createAdminIfNotExists = require("./utils/createAdmin");
const getPlcData = require("./utils/plc_connected");
const Tool = require("./models/Tool");
const { triggerSlot } = require("./utils/plcTrigger");

// Load env vars
dotenv.config();

// Connect to database
// connectDB();

const app = express();

// CORS Configuration - Cho phép tất cả origin
const corsOptions = {
  origin: function (origin, callback) {
    // Cho phép requests không có origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // Cho phép tất cả origin trong production
    // Hoặc bạn có thể chỉ định các origin cụ thể:
    // const allowedOrigins = [
    //   'https://your-frontend-domain.com',
    //   'https://www.your-frontend-domain.com',
    //   'http://localhost:3000',
    //   'https://bktoolsysweb-1.onrender.com' // Backend Render
    // ];
    // if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
    //   callback(null, true);
    // } else {
    //   callback(new Error('Not allowed by CORS'));
    // }
    callback(null, true);
  },
  credentials: true, // Cho phép gửi cookies/credentials
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["Authorization"], // Cho phép frontend đọc Authorization header
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/tools", require("./routes/tool"));
app.use("/api/users", require("./routes/user"));
app.use("/api/export-receipts", require("./routes/exportReceipts"));
app.use("/api/tool-requests", require("./routes/toolRequests"));

// API lấy dữ liệu PLC
app.get("/api/plc-data", (req, res) => {
  const data = getPlcData();
  res.json({
    success: true,
    data: data
  });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Server is running" });
});

// Lắng nghe yêu cầu từ PLC
const startPLCListener = () => {
  let isLoopRunning = false;

  const loop = async () => {
    if (isLoopRunning) {
      return;
    }

    isLoopRunning = true;

    try {
      const data = await readPLC();

      // Chỉ xử lý khi trigger = true và actionType > 0
      if (data.trigger && data.actionType !== 0) {
        const pCode = String(data.productCode || "").trim();
        const actionType = data.actionType;
        let result = 2; // Mặc định là thất bại

        console.log(`📡 PLC Request: Action ${actionType} for Tool: ${pCode}`);

        switch (actionType) {
          case 1: {
            // Thêm mới (nhập kho)
            const existing = await Tool.findOne({
              productCode: pCode.toUpperCase(),
            });

            if (!existing) {
              await Tool.create({
                productCode: pCode.toUpperCase(),
                name: `Tool_${pCode}`,
                status: "available",
                history: [
                  {
                    action: "import",
                    notes: "Auto-added by PLC",
                    date: new Date(),
                  },
                ],
              });
              result = 1;
            }
            break;
          }

          case 2: {
            // Xóa/loại bỏ
            const deleted = await Tool.findOneAndDelete({
              productCode: pCode.toUpperCase(),
            });
            if (deleted) {
              result = 1;
            }
            break;
          }

          case 3: {
            // Mượn/Trả (đảo trạng thái isInUse)
            const tool = await Tool.findOne({
              productCode: pCode.toUpperCase(),
            });
            if (tool) {
              tool.isInUse = !tool.isInUse;
              await tool.save();
              result = 1;
            }
            break;
          }

          case 99: {
            // 99: tín hiệu riêng từ Web -> PLC, backend listener bỏ qua
            break;
          }

          default:
            break;
        }

        // Phản hồi + reset handshake với PLC
        await writePLC("resultCode", result);
        await writePLC("processDone", true);
        // Sau khi xử lý xong một lệnh từ PLC, đưa trigger về 0 và actionType về 0 (Idle)
        await writePLC("trigger", false);
        await writePLC("actionType", 0);

        console.log(
          `✅ Processed PLC action ${actionType} with result: ${result}`,
        );
      }
    } catch (err) {
      console.error("PLC Loop Error:", err.message || err);
    } finally {
      isLoopRunning = false;
      setTimeout(loop, 1000); // Quét lại sau 1s
    }
  };

  loop();
};

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0"; // Listen trên tất cả interfaces

// app.listen(PORT, HOST, () => {
//   console.log(`Server running on http://${HOST}:${PORT}`);
//   console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
// });
const startServer = async () => {
  try {
    await connectDB(); // 1️⃣ Kết nối DB trước

    await createAdminIfNotExists(); // 2️⃣ Tạo admin nếu chưa có

    // Khởi chạy theo dõi PLC
    watchTools();

    app.listen(PORT, HOST, () => {
      console.log(`Server running on http://${HOST}:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

async function processChange(change) {
    try {
        if (change.operationType === "update") {
            const updatedFields = change.updateDescription.updatedFields;
            const fullDocument = change.fullDocument; 
            
            // Kiểm tra xem trạng thái mượn (ví dụ: isInUse = true hoặc status = in_use) có được kích hoạt không
            if (updatedFields.isInUse === true || updatedFields.status === "in_use") {
               console.log(`🚀 Phát hiện dao ${fullDocument.productCode} vừa được mượn! Gọi PLC...`);
               
               // Lấy slotIndex từ thông tin Tool (ở đây tạm để mặc định là 1 nếu không có)
               const slotIndex = fullDocument.slotIndex || 1; 
               await triggerSlot(slotIndex);
            }
        }
    } catch (err) {
        console.error("❌ Lỗi khi xử lý processChange:", err);
    }
}

async function watchTools() {
    // Dùng trực tiếp Mongoose thay vì client raw (do file config/db dùng mongoose)
    const pipeline = [
        {
            $match: {
                operationType: { $in: ["update", "insert"] }
            }
        }
    ];

    // Bắt đầu theo dõi thông qua Model
    const changeStream = Tool.watch(pipeline, { fullDocument: "updateLookup" });

    console.log("📡 Đang lắng nghe sự thay đổi từ collection 'tools'...");

    // Lắng nghe sự kiện 'change'
    changeStream.on("change", (change) => {
        console.log("--------------------------------------");
        console.log("🔥 Có biến động mới!");
        
        // Gọi hàm xử lý logic
        processChange(change);
    });

    // Xử lý lỗi để tránh crash ứng dụng
    changeStream.on("error", (error) => {
        console.error("❌ Lỗi Change Stream:", error);
    });
}


startServer();
