import api from "./api";

export const plcService = {

    async getPlcData() {
        try {
            const response = await api.get("/plc-data");
            return response.data;
        } catch (error) {
            console.error("Error fetching PLC data:", error);
            return { success: false };
        }
    }

};