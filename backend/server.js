const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
<<<<<<< HEAD
const { initPLC, readPLC, writePLC } = require("./utils/plcConnector");
const Tool = require("./models/Tool");
=======
const createAdminIfNotExists = require("./utils/createAdmin");
const getPlcData = require("./utils/plc_connected");
const Tool = require("./models/Tool");
const { triggerSlot } = require("./utils/plcTrigger");
>>>>>>> a48e80b

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



const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0"; // Listen trên tất cả interfaces

<<<<<<< HEAD
app.listen(PORT, HOST, async () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);

  try {
    await initPLC();
    console.log("PLC initialized");
    startPLCListener();
  } catch (err) {
    console.error("Không thể kết nối PLC:", err.message || err);
  }
});
=======
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
>>>>>>> a48e80b
