const nodes7 = require("nodes7");
const conn = new nodes7();

const plcConfig = {
  host: "192.168.0.1",
  port: 102,
  rack: 0,
  slot: 1,
};

// Cấu hình biến SL trong DB1
// Giả sử SL là biến đầu tiên trong DB1, kiểu INT thì địa chỉ là DB1,INT0
const variables = {
  SL: "DB1,INT0",
};

conn.initiateConnection(plcConfig, (err) => {
  if (err) return console.error("❌ Lỗi kết nối:", err);

  console.log("✅ Đã kết nối. Đang đọc SL từ DB1...");

  conn.setTranslationCB((name) => variables[name]);
  conn.addItems(["SL"]);

  setInterval(() => {
    conn.readAllItems((err, values) => {
      if (err) return;
      // Hiển thị giá trị SL
      console.log(
        `[${new Date().toLocaleTimeString()}] Giá trị SL = ${values.SL}`,
      );
    });
  }, 500);
});
