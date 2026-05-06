// ============================================================
// ==================== PLC THẬT (nodes7) =====================
// ============================================================
// Uncomment phần này khi có PLC thật, comment phần Mock bên dưới

const nodes7 = require('nodes7');
const conn = new nodes7();

const plcConfig = {
    host: '192.168.0.1',
    port: 102,
    rack: 0,
    slot: 1
};

// Mapping slotIndex (1→9) sang địa chỉ PLC BOOL
const TRIGGER_MAP = {
    1: 'DB15,X0.0',
    2: 'DB15,X0.1',
    3: 'DB15,X0.2',
    4: 'DB15,X0.3',
    5: 'DB15,X0.4',
    6: 'DB15,X0.5',
    7: 'DB15,X0.6',
    8: 'DB15,X0.7',
    9: 'DB15,X1.0',
};

// Mapping tên biến → địa chỉ PLC (cho setTranslationCB)
const triggerVariables = {};
for (let i = 1; i <= 9; i++) {
    triggerVariables[`SL${i}_TRIGGER`] = TRIGGER_MAP[i];
}

let isConnected = false;

// Kết nối PLC (lazy, 1 lần duy nhất)
function connectTrigger() {
    return new Promise((resolve, reject) => {
        if (isConnected) return resolve();

        conn.initiateConnection(plcConfig, (err) => {
            if (err) {
                console.error("❌ PLC Trigger kết nối lỗi:", err);
                return reject(err);
            }

            console.log("✅ PLC Trigger đã kết nối");
            isConnected = true;

            // Mapping tên biến → địa chỉ
            conn.setTranslationCB((name) => triggerVariables[name]);

            resolve();
        });
    });
}

// Ghi 1 bit BOOL với Promise wrapper
function writeBit(varName, value) {
    return new Promise((resolve, reject) => {
        conn.writeItems(varName, value, (err) => {
            if (err) {
                console.error(`❌ Ghi ${varName} = ${value} lỗi:`, err);
                return reject(err);
            }
            resolve(true);
        });
    });
}

// Delay helper
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gửi xung trigger đến 1 slot trên PLC
 * TRUE → delay 5000ms → FALSE
 * @param {number} slotIndex - Số ngăn (1 → 9)
 */
async function triggerSlot(slotIndex) {
    // Validate
    if (!slotIndex || slotIndex < 1 || slotIndex > 9) {
        throw new Error(`slotIndex không hợp lệ: ${slotIndex} (phải từ 1 đến 9)`);
    }

    const varName = `SL${slotIndex}_TRIGGER`;

    try {
        await connectTrigger();

        // Bước 1: Ghi TRUE
        await writeBit(varName, true);
        console.log(`🔔 Trigger ON slot ${slotIndex}`);

        // Bước 2: Delay 5000ms
        await delay(5000);

        // Bước 3: Ghi FALSE (reset)
        await writeBit(varName, false);
        console.log(`🔕 Trigger OFF slot ${slotIndex}`);

    } catch (err) {
        console.error(`❌ triggerSlot(${slotIndex}) lỗi:`, err);
        throw err;
    }
}

module.exports = { triggerSlot };







// // ============================================================
// // ==================== MOCK PLC (giả lập) ====================
// // ============================================================
// // Dùng để test khi chưa có PLC thật
// // Khi có PLC thật: comment toàn bộ phần này, uncomment phần trên

// // Mapping slotIndex (1→9) sang địa chỉ PLC BOOL
// const TRIGGER_MAP = {
//     1: 'DB15,X0.0',
//     2: 'DB15,X0.1',
//     3: 'DB15,X0.2',
//     4: 'DB15,X0.3',
//     5: 'DB15,X0.4',
//     6: 'DB15,X0.5',
//     7: 'DB15,X0.6',
//     8: 'DB15,X0.7',
//     9: 'DB15,X1.0',
// };

// // Object giả lập trạng thái PLC (lưu giá trị hiện tại của từng bit)
// const fakePLC = {};

// // Delay helper
// function delay(ms) {
//     return new Promise((resolve) => setTimeout(resolve, ms));
// }

// // Mock writeBit — ghi giá trị vào fakePLC và log
// function writeBit(address, value) {
//     fakePLC[address] = value;
//     console.log(`[MOCK PLC] ${address} = ${value}`);
//     return Promise.resolve(true);
// }

// /**
//  * Gửi xung trigger giả lập đến 1 slot
//  * TRUE → delay 5000ms → FALSE
//  * @param {number} slotIndex - Số ngăn (1 → 9)
//  */
// async function triggerSlot(slotIndex) {
//     // Validate
//     if (!slotIndex || slotIndex < 1 || slotIndex > 9) {
//         console.error(`❌ [MOCK] slotIndex không hợp lệ: ${slotIndex}`);
//         return;
//     }

//     const address = TRIGGER_MAP[slotIndex];

//     try {
//         // Bước 1: Ghi TRUE
//         await writeBit(address, true);
//         console.log(`🔔 Trigger ON slot ${slotIndex}`);

//         // Bước 2: Delay 5000ms
//         await delay(5000);

//         // Bước 3: Ghi FALSE (reset)
//         await writeBit(address, false);
//         console.log(`🔕 Trigger OFF slot ${slotIndex}`);

//     } catch (err) {
//         console.error(`❌ [MOCK] triggerSlot(${slotIndex}) lỗi:`, err);
//         throw err;
//     }
// }

// /**
//  * Xem trạng thái hiện tại của fake PLC
//  * @returns {object} fakePLC state
//  */
// function getMockState() {
//     return { ...fakePLC };
// }

// module.exports = { triggerSlot, getMockState };
