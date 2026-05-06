const nodes7 = require('nodes7');
const conn = new nodes7();

const plcConfig = {
    host: '192.168.0.1',
    port: 102,
    rack: 0,
    slot: 1
};

// mapping giống file đọc
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

let isConnected = false;

// kết nối 1 lần duy nhất
function connectPLC() {
    return new Promise((resolve, reject) => {

        if (isConnected) return resolve();

        conn.initiateConnection(plcConfig, (err) => {

            if (err) {
                console.error("❌ Lỗi kết nối PLC:", err);
                return reject(err);
            }

            console.log("✅ PLC Writer đã kết nối");
            isConnected = true;

            // mapping tên biến
            conn.setTranslationCB((name) => variables[name]);

            resolve();
        });
    });
}

// Ghi 1 slot

async function writeSlot(slotName, value) {

    try {

        await connectPLC();

        return new Promise((resolve, reject) => {

            conn.writeItems(slotName, value, (err) => {

                if (err) {
                    console.error(`❌ Ghi ${slotName} lỗi:`, err);
                    return reject(err);
                }

                console.log(`✅ Ghi ${slotName} = ${value}`);
                resolve(true);
            });
        });

    } catch (err) {
        throw err;
    }
}


// Ghi nhiều slot(quan trọng)

async function writeMultipleSlots(data) {
    /**
     * data dạng:
     * {
     *   SL1: 5,
     *   SL2: 3
     * }
     */

    try {

        await connectPLC();

        return new Promise((resolve, reject) => {

            const keys = Object.keys(data);
            const values = Object.values(data);

            conn.writeItems(keys, values, (err) => {

                if (err) {
                    console.error("❌ Ghi nhiều slot lỗi:", err);
                    return reject(err);
                }

                console.log("✅ Ghi nhiều slot thành công:", data);
                resolve(true);
            });

        });

    } catch (err) {
        throw err;
    }
}

module.exports = {
    writeSlot,
    writeMultipleSlots
};