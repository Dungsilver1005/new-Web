# 🔬 Phân Tích Runtime SAU KHI FIX — Hệ Thống Export → Change Stream → PLC

---

## SCENARIO

```
Request: POST /api/export-receipts
tools = [toolA(slot 1), toolB(slot 1), toolC(slot 2)]

toolA: _id="aaa", slotIndex=1, productCode="DAO-001", isInUse=false
toolB: _id="bbb", slotIndex=1, productCode="DAO-002", isInUse=false
toolC: _id="ccc", slotIndex=2, productCode="DAO-003", isInUse=false
```

---

## 1. TIMELINE THỰC TẾ TỪNG BƯỚC

```
═══════════════════════════════════════════════════════════════════
  PHASE 1: API HANDLER — exportReceipts.js
═══════════════════════════════════════════════════════════════════

T+0ms     │ 🚨 POST /api/export-receipts → Request received
          │ express-validator check → OK
          │
          │ ─── Vòng validate tools (line 101-123) ───
          │
T+5ms     │ Tool.findById("aaa") → toolA found, isInUse=false → ✅ pass
T+10ms    │ Tool.findById("bbb") → toolB found, isInUse=false → ✅ pass
T+15ms    │ Tool.findById("ccc") → toolC found, isInUse=false → ✅ pass
          │
          │ ─── Tạo phiếu (line 126-134) ───
          │
T+20ms    │ ExportReceipt.create() → Phiếu XK-20260508-1234 được tạo
          │
          │ ─── Atomic update tools (line 136-187) ───
          │
T+25ms    │ findOneAndUpdate({_id:"aaa", isInUse:false}, {$set:{isInUse:true, location:"in_use",...}})
          │   → MongoDB: atomic update thành công
          │   → result = updated toolA document ✅
          │   → updatedToolIds = ["aaa"]
          │   → MongoDB emit Change Stream Event #1 📡
          │
T+30ms    │ findOneAndUpdate({_id:"bbb", isInUse:false}, {$set:{isInUse:true, location:"in_use",...}})
          │   → MongoDB: atomic update thành công
          │   → result = updated toolB document ✅
          │   → updatedToolIds = ["aaa", "bbb"]
          │   → MongoDB emit Change Stream Event #2 📡
          │
T+35ms    │ findOneAndUpdate({_id:"ccc", isInUse:false}, {$set:{isInUse:true, location:"in_use",...}})
          │   → MongoDB: atomic update thành công
          │   → result = updated toolC document ✅
          │   → updatedToolIds = ["aaa", "bbb", "ccc"]
          │   → MongoDB emit Change Stream Event #3 📡
          │
T+40ms    │ console.log("📤 Đã cập nhật DB, PLC sẽ được trigger qua Change Stream...")
T+45ms    │ populate receipt → res.status(201) → Response trả về client ✅
          │
          │ 🏁 API handler kết thúc — client nhận response


═══════════════════════════════════════════════════════════════════
  PHASE 2: CHANGE STREAM HANDLER — server.js (async, event loop)
═══════════════════════════════════════════════════════════════════

T+26ms*   │ 🔥 Event #1 nhận: change.fullDocument = toolA
          │   operationType === "update" → ✅
          │   fullDocument exists → ✅
          │   toolId = "aaa", productCode = "DAO-001", slotIndex = 1
          │   isInUse === true → ✅
          │   slotIndex != null → ✅
          │   slotKey = "slot_1"
          │   recentlyTriggered.has("slot_1") → ❌ (chưa có)
          │   → recentlyTriggered.add("slot_1")
          │   → 🚀 triggerSlot(1)
          │       → connectTrigger() (lazy connect PLC)
          │       → writeBit("SL1_TRIGGER", true)  → PLC: DB15,X0.0 = TRUE 🔔
          │       → delay(10000ms)...
          │   → setTimeout(() => recentlyTriggered.delete("slot_1"), 12000)
          │
T+31ms*   │ 🔥 Event #2 nhận: change.fullDocument = toolB
          │   operationType === "update" → ✅
          │   fullDocument exists → ✅
          │   toolId = "bbb", productCode = "DAO-002", slotIndex = 1
          │   isInUse === true → ✅
          │   slotIndex != null → ✅
          │   slotKey = "slot_1"
          │   recentlyTriggered.has("slot_1") → ✅ ĐÃ CÓ!
          │   → ⏩ "Bỏ qua slot 1 — tool DAO-002 (đã trigger gần đây)"
          │   → return — KHÔNG trigger PLC ✅✅✅
          │
T+36ms*   │ 🔥 Event #3 nhận: change.fullDocument = toolC
          │   operationType === "update" → ✅
          │   fullDocument exists → ✅
          │   toolId = "ccc", productCode = "DAO-003", slotIndex = 2
          │   isInUse === true → ✅
          │   slotIndex != null → ✅
          │   slotKey = "slot_2"
          │   recentlyTriggered.has("slot_2") → ❌ (chưa có)
          │   → recentlyTriggered.add("slot_2")
          │   → 🚀 triggerSlot(2)
          │       → writeBit("SL2_TRIGGER", true)  → PLC: DB15,X0.1 = TRUE 🔔
          │       → delay(10000ms)...
          │   → setTimeout(() => recentlyTriggered.delete("slot_2"), 12000)


═══════════════════════════════════════════════════════════════════
  PHASE 3: PLC HARDWARE TIMELINE
═══════════════════════════════════════════════════════════════════

T+26ms    │ Slot 1: DB15,X0.0 = TRUE  🟢 (bắt đầu xuất dao)
T+36ms    │ Slot 2: DB15,X0.1 = TRUE  🟢 (bắt đầu xuất dao)
          │ ... PLC xử lý cơ khí ...
T+10026ms │ Slot 1: DB15,X0.0 = FALSE 🔴 (reset)
T+10036ms │ Slot 2: DB15,X0.1 = FALSE 🔴 (reset)
T+12026ms │ recentlyTriggered.delete("slot_1") → slot 1 sẵn sàng lại
T+12036ms │ recentlyTriggered.delete("slot_2") → slot 2 sẵn sàng lại
```

> (*) Thời gian Change Stream event phụ thuộc MongoDB replica set latency (~1-50ms sau write)

---

## 2. CHANGE STREAM EMIT BAO NHIÊU EVENT?

| Bước | Operation | Event emit? |
|------|-----------|:-----------:|
| `findOneAndUpdate(toolA)` | 1 atomic update | ✅ Event #1 |
| `findOneAndUpdate(toolB)` | 1 atomic update | ✅ Event #2 |
| `findOneAndUpdate(toolC)` | 1 atomic update | ✅ Event #3 |

### → **3 events** — mỗi `findOneAndUpdate` = 1 write operation = 1 Change Stream event

> [!NOTE]
> `findOneAndUpdate` là 1 atomic operation trong MongoDB. Không có trường hợp 1 call emit nhiều event. Con số 3 event là chính xác và có thể dự đoán được.

---

## 3. PLC BỊ TRIGGER BAO NHIÊU LẦN?

```
Event #1 (toolA, slot 1): recentlyTriggered chưa có "slot_1" → triggerSlot(1) ✅
Event #2 (toolB, slot 1): recentlyTriggered ĐÃ CÓ "slot_1"  → ⏩ BỎ QUA
Event #3 (toolC, slot 2): recentlyTriggered chưa có "slot_2" → triggerSlot(2) ✅
```

### → **PLC trigger đúng 2 lần: slot 1 × 1, slot 2 × 1** ✅

---

## 4. CÓ BỊ TRIGGER TRÙNG SLOT KHÔNG?

### → **KHÔNG** ✅

| Câu hỏi | Trả lời |
|----------|---------|
| Slot 1 có bị gọi 2 lần không? | ❌ Không — dedup cache theo `slot_1` chặn event thứ 2 |
| Slot 2 có bị gọi 2 lần không? | ❌ Không — chỉ có 1 tool ở slot 2 |
| Tín hiệu PLC có bị xung đột TRUE/FALSE? | ❌ Không — mỗi slot chỉ 1 triggerSlot() chạy |

**Cơ chế bảo vệ hoạt động đúng:**
- `recentlyTriggered` cache key = `"slot_1"` (không phải `toolId`)
- toolA trigger slot 1 → thêm `"slot_1"` vào Set
- toolB cũng slot 1 → check `has("slot_1")` → **true** → bỏ qua
- Cache giữ 12 giây > 10 giây cycle PLC → không có khe hở

---

## 5. CÓ RACE CONDITION KHÔNG NẾU NHIỀU REQUEST CÙNG LÚC?

### Scenario: 2 admin cùng xuất toolA đồng thời

```
Request 1                              Request 2
─────────                              ─────────
T+0  validate: findById(toolA)
       → isInUse=false ✅               T+1  validate: findById(toolA)
                                              → isInUse=false ✅ (stale read)

T+5  findOneAndUpdate(                  
       {_id:"aaa", isInUse:false},      
       {$set:{isInUse:true}}            
     )                                  
     → MongoDB atomic: matched 1       
     → result = toolA ✅               T+6  findOneAndUpdate(
                                              {_id:"aaa", isInUse:false},
                                              {$set:{isInUse:true}}
                                            )
                                            → MongoDB atomic: matched 0
                                            → result = null ❌
                                            → Rollback + 409 "Đã được xuất bởi người khác"
```

### → **KHÔNG CÓ race condition** ✅

| Tình huống | Kết quả |
|------------|---------|
| 2 request cùng xuất 1 tool | Chỉ 1 thắng, 1 nhận 409 Conflict |
| Double-click từ frontend | Request thứ 2 fail gracefully |
| Validate pass nhưng tool đã bị xuất | `findOneAndUpdate` filter `{isInUse:false}` chặn |

> [!IMPORTANT]
> Vòng validate `findById` ở line 100-123 **vẫn là stale read** — nhưng nó chỉ đóng vai trò "early exit" để trả lỗi đẹp. Bảo vệ thực sự nằm ở `findOneAndUpdate` atomic — đây là lớp **cuối cùng và đáng tin cậy**.

**Lưu ý nhỏ:** Nếu Request 2 fail ở tool thứ 2 trong danh sách, rollback logic sẽ:
1. Trả lại các tool đã update trước đó (`findByIdAndUpdate` set `isInUse=false`)
2. Xóa phiếu vừa tạo (`ExportReceipt.findByIdAndDelete`)
3. Trả response 409

→ Rollback hoạt động đúng, tuy là "best-effort" (không phải DB transaction), nhưng đủ cho use case này.

---

## 6. CÓ KHẢ NĂNG MISS EVENT HOẶC TRIGGER SAI KHÔNG?

### 6a. Miss event?

| Scenario | Miss? | Giải thích |
|----------|:-----:|-----------|
| Change Stream disconnect tạm thời | ❌ | `resumeToken` + auto-reconnect trong `watchTools()` |
| MongoDB replica failover | ⚠️ Rất hiếm | Nếu failover đúng lúc event transit, `resumeToken` cũ có thể invalid. Nhưng code sẽ reconnect và tiếp tục từ event mới |
| Node.js restart/crash | ⚠️ | `resumeToken` lưu RAM, mất khi restart → có thể miss event xảy ra khi server down. **Chấp nhận được** cho hệ thống IoT factory |
| Event đến nhưng processChange throw | ❌ | try-catch bọc ngoài, stream không bị crash |

### 6b. Trigger sai?

| Scenario | Sai? | Giải thích |
|----------|:----:|-----------|
| DELETE receipt → tool.save() | ❌ | `isInUse` set `false` → `processChange` check `isInUse === true` → skip |
| Tool update không liên quan (tên, category...) | ❌ | Không thay đổi `isInUse` → nếu `isInUse` vẫn `false` → skip |
| Tool đã `isInUse=true` bị update field khác | ⚠️ Có thể | Nếu admin edit 1 tool đang `isInUse=true` (ví dụ sửa tên), Change Stream emit update, `fullDocument.isInUse === true` → **trigger lại PLC!** |

> [!WARNING]
> **Edge case phát hiện:** Nếu admin sửa thông tin 1 tool đang được sử dụng (ví dụ đổi tên, category, v.v.), Change Stream sẽ emit event update, và `processChange` sẽ thấy `isInUse=true` → **trigger PLC lần nữa** dù tool đã được xuất trước đó.
>
> **Mức độ:** Thấp — ít khi admin edit tool đang sử dụng. Nhưng nếu muốn fix, chỉ cần check thêm `updateDescription.updatedFields` có chứa `isInUse` hoặc `location` không.

---

## 7. ĐÁNH GIÁ TỔNG THỂ

### Hệ thống đã đúng chưa?

| Tiêu chí | Trước fix | Sau fix |
|-----------|:---------:|:-------:|
| Dedup trigger trùng slot | ❌ Cache theo toolId | ✅ Cache theo slotIndex |
| Race condition khi concurrent request | ❌ findById + save() | ✅ findOneAndUpdate atomic |
| PLC trigger chính xác | ❌ Slot 1 gọi 2 lần | ✅ Slot 1 gọi đúng 1 lần |
| Dead code check | ⚠️ status==="in_use" vô nghĩa | ✅ Đã xóa |
| Dedup timeout đủ dài | ❌ 2s < 10s PLC cycle | ✅ 12s > 10s PLC cycle |
| Reconnect Change Stream | ✅ | ✅ |
| Error handling | ✅ | ✅ |
| Rollback khi fail | ❌ Không có | ✅ Có rollback + 409 |

### Production-ready?

```
┌──────────────────────────────────────────────────────────────┐
│                    ĐÁNH GIÁ SAU FIX                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ✅ Luồng API → DB → Change Stream → PLC:     ĐÚNG          │
│  ✅ Dedup trigger trùng slot:                  ĐÚNG          │
│  ✅ Race condition protection:                 ĐÚNG          │
│  ✅ PLC signal integrity:                      ĐÚNG          │
│  ✅ Reconnect & resilience:                    ĐÚNG          │
│  ✅ Rollback on failure:                       ĐÚNG          │
│                                                              │
│  ⚠️ Edge case nhỏ:                                          │
│     Edit tool đang isInUse=true → có thể re-trigger PLC     │
│     (xác suất thấp, fix tùy chọn)                           │
│                                                              │
│  📊 VERDICT: PRODUCTION-READY ✅                             │
│     (với lưu ý edge case ở trên)                             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 8. FIX TÙY CHỌN CHO EDGE CASE (nếu muốn hoàn thiện 100%)

Chỉ trigger khi `isInUse` hoặc `location` **vừa mới thay đổi** trong update:

```javascript
// Trong processChange(), thêm check updatedFields:
const updatedFields = change.updateDescription?.updatedFields || {};
const isRelevantUpdate = 'isInUse' in updatedFields || 'location' in updatedFields;

if (!isRelevantUpdate) return; // ← bỏ qua nếu chỉ edit tên, category, v.v.
```

→ Đảm bảo PLC chỉ trigger khi **trạng thái sử dụng** thực sự thay đổi, không phải khi admin edit metadata.
