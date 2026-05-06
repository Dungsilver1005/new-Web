const nodes7 = require('nodes7');
const conn = new nodes7();

const plcConfig = {
    host: '192.168.0.1',
    port: 102,
    rack: 0,
    slot: 1
};
let plcData = {
    SL1: 0,
    SL2: 0,
    SL3: 0,
    SL4: 0,
    SL5: 0,
    SL6: 0,
    SL7: 0,
    SL8: 0,
    SL9: 0
};

// 9 biến tương ứng với 9 ngăn
const variables = {
    SL1: 'DB1,INT0',
    SL2: 'DB1,INT2',
    SL3: 'DB1,INT4',
    SL4: 'DB1,INT6',
    SL5: 'DB1,INT8',
    SL6: 'DB1,INT10',
    SL7: 'DB1,INT12',
    SL8: 'DB1,INT14',
    SL9: 'DB1,INT16'
};

conn.initiateConnection(plcConfig, (err) => {

    if (err) {
        console.error("❌ Lỗi kết nối PLC:", err);
        return;
    }

    console.log("✅ Đã kết nối PLC. Đang đọc dữ liệu 9 ngăn...");

    // map tên biến -> địa chỉ PLC
    conn.setTranslationCB((name) => variables[name]);

    // khai báo các biến cần đọc
    conn.addItems([
        'SL1',
        'SL2',
        'SL3',
        'SL4',
        'SL5',
        'SL6',
        'SL7',
        'SL8',
        'SL9',
    ]);

    // đọc dữ liệu mỗi 500ms
    setInterval(() => {

        conn.readAllItems((err, values) => {

            if (err) {
                console.error("❌ Lỗi đọc PLC:", err);
                return;
            }

            // ✅ CÁCH FIX SỰ ĐỒNG BỘ: Chỉ update các key hợp lệ từ values, giữ lại cấu trúc ban đầu
            if (values && typeof values === 'object') {
                plcData = {
                    SL1: values.SL1 !== undefined ? values.SL1 : plcData.SL1,
                    SL2: values.SL2 !== undefined ? values.SL2 : plcData.SL2,
                    SL3: values.SL3 !== undefined ? values.SL3 : plcData.SL3,
                    SL4: values.SL4 !== undefined ? values.SL4 : plcData.SL4,
                    SL5: values.SL5 !== undefined ? values.SL5 : plcData.SL5,
                    SL6: values.SL6 !== undefined ? values.SL6 : plcData.SL6,
                    SL7: values.SL7 !== undefined ? values.SL7 : plcData.SL7,
                    SL8: values.SL8 !== undefined ? values.SL8 : plcData.SL8,
                    SL9: values.SL9 !== undefined ? values.SL9 : plcData.SL9,
                };
            }

            console.log(`[${new Date().toLocaleTimeString()}] Dữ liệu nhận từ PLC mượt:`, plcData);

        });

    }, 1000);
});
module.exports = () => plcData;




// let plcData = {
//     SL1: 0,
//     SL2: 0,
//     SL3: 0,
//     SL4: 0,
//     SL5: 0,
//     SL6: 0,
//     SL7: 0,
//     SL8: 0,
//     SL9: 0
// };

// // Fake PLC data mỗi 2s (Ngẫu nhiên)
// setInterval(() => {

//     plcData = {
//         SL1: Math.floor(Math.random() * 10),
//         SL2: Math.floor(Math.random() * 10),
//         SL3: Math.floor(Math.random() * 10),
//         SL4: Math.floor(Math.random() * 10),
//         SL5: Math.floor(Math.random() * 10),
//         SL6: Math.floor(Math.random() * 10),
//         SL7: Math.floor(Math.random() * 10),
//         SL8: Math.floor(Math.random() * 10),
//         SL9: Math.floor(Math.random() * 10)
//     };

//     console.log("Fake PLC (Random):", plcData);

// }, 2000);


// Fake PLC tĩnh (Cố định từ 1 đến 9)
// setInterval(() => {

//     plcData = {
//         SL1: 1,
//         SL2: 2,
//         SL3: 3,
//         SL4: 4,
//         SL5: 5,
//         SL6: 6,
//         SL7: 7,
//         SL8: 8,
//         SL9: 9
//     };

//     console.log("Fake PLC (Static):", plcData);

// }, 2000);

// module.exports = () => plcData;