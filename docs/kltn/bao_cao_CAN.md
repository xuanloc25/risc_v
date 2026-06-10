# Báo cáo chuyên đề: Ngoại vi CAN trong trình mô phỏng SoC RISC-V

> Tài liệu báo cáo với giảng viên hướng dẫn. Nguồn code: `src/js/can.js`, `src/js/soc.js`; kiểm thử: `test/can_verify.mjs`, `test/can_mmio_verify.mjs`, `test/can_loopback.asm`; báo cáo chính: mục 4.6.3, 5.2, 6.2.

---

## 1. Giới thiệu về giao thức CAN

### 1.1. Bối cảnh ra đời

CAN (Controller Area Network) là giao thức truyền thông nối tiếp do Robert Bosch GmbH phát triển giữa thập niên 1980 cho ngành ô tô, công bố đặc tả CAN Specification 2.0 năm 1991 và sau đó được chuẩn hóa thành ISO 11898. Bài toán CAN giải quyết: trong một chiếc xe có hàng chục bộ điều khiển điện tử (ECU) cần trao đổi dữ liệu; nếu nối từng cặp point-to-point thì số dây tăng bùng nổ. CAN cho phép tất cả các nút dùng chung **một đôi dây xoắn**, giảm khối lượng dây dẫn và tăng độ tin cậy. Ngày nay CAN được dùng rộng rãi trong ô tô, tự động hóa công nghiệp, y tế và hàng không.

### 1.2. Các đặc điểm chính

- **Multi-master, broadcast:** không có nút chủ cố định; mọi nút đều có thể phát khi bus rảnh, và mọi frame được phát quảng bá — các nút tự lọc frame theo identifier để quyết định có nhận hay không.
- **Định danh theo thông điệp, không theo địa chỉ nút:** mỗi frame mang một **identifier** (11 bit ở định dạng chuẩn — CAN 2.0A, 29 bit ở định dạng mở rộng — CAN 2.0B). Identifier vừa cho biết ý nghĩa dữ liệu, vừa quyết định độ ưu tiên.
- **Phân xử không phá hủy (arbitration):** khi nhiều nút phát cùng lúc, từng bit của identifier được "so" trên bus: bit **dominant (0)** thắng bit **recessive (1)**. Nút phát bit recessive nhưng đọc lại thấy dominant sẽ tự rút lui và phát lại sau — frame có **ID nhỏ hơn thắng**, không mất dữ liệu, không cần phát lại từ đầu như Ethernet cổ điển.
- **Payload nhỏ, tốc độ vừa phải:** mỗi data frame mang 0–8 byte dữ liệu (trường DLC cho biết số byte), tốc độ tối đa 1 Mbit/s với CAN cổ điển.
- **Độ tin cậy cao:** CRC 15 bit, khe ACK (nút nhận xác nhận ngay trong frame), bit stuffing (chèn bit đảo sau 5 bit cùng mức để giữ đồng bộ), và cơ chế **error confinement** với bộ đếm lỗi TEC/REC đưa nút lỗi qua các trạng thái error-active → error-passive → bus-off để nút hỏng không phá bus.

### 1.3. Cấu trúc Data Frame (định dạng chuẩn)

| Trường | Kích thước | Vai trò |
|---|---|---|
| SOF (Start of Frame) | 1 bit | Bit dominant đánh dấu bắt đầu frame |
| Arbitration field | 11 bit ID + 1 bit RTR | Identifier (đồng thời là độ ưu tiên); RTR phân biệt data/remote frame |
| Control field | 6 bit (IDE, r0, DLC) | DLC — Data Length Code, số byte dữ liệu 0–8 |
| Data field | 0–8 byte | Dữ liệu |
| CRC field | 15 bit + 1 bit delimiter | Mã kiểm lỗi |
| ACK field | 2 bit | Nút nhận đúng kéo bit ACK xuống dominant |
| EOF (End of Frame) | 7 bit | Kết thúc frame |

### 1.4. Controller và transceiver

Một nút CAN gồm ba tầng: **vi điều khiển** (phần mềm ứng dụng) ↔ **CAN controller** (tầng data link: đóng/mở frame, arbitration, CRC, ACK, quản lý lỗi) ↔ **CAN transceiver** (tầng vật lý: chuyển bit thành mức điện áp vi sai CAN_H/CAN_L). Phần mềm không thao tác bit trên dây — nó chỉ **đọc/ghi thanh ghi của controller** ở mức frame: nạp ID + DLC + data rồi ra lệnh gửi, hoặc đọc frame đã nhận từ buffer. **Đây chính là ranh giới mà đề tài mô phỏng:** giao diện thanh ghi giữa CPU và controller.

---

## 2. CAN trong đề tài: mục tiêu và phạm vi

### 2.1. Mục tiêu

Mô phỏng một CAN controller **giáo dục, tối giản, ở mức frame/message**, nhằm minh họa: (1) cách CPU giao tiếp với một ngoại vi CAN qua MMIO; (2) đường đi đầy đủ của một truy cập ngoại vi trong SoC — qua MMU, bỏ qua cache, qua hai tầng bus TileLink. Trọng tâm của đề tài là **kiến trúc SoC và luồng dữ liệu trên bus**, không phải mô phỏng giao thức CAN ở mức bit.

### 2.2. Phạm vi mô hình

| Có mô phỏng | Không mô phỏng (chủ đích) |
|---|---|
| Standard identifier 11 bit (0x000–0x7FF) | Extended ID 29 bit, CAN FD |
| DLC 0–8, payload tối đa 8 byte | Physical layer, mức điện áp |
| 1 TX mailbox, 1 RX mailbox | Bit stuffing, CRC, ACK slot |
| Chế độ loopback (tự nhận frame mình phát) | Arbitration bit-level (chỉ có 1 nút) |
| Cờ lỗi đơn giản (ERROR) + lệnh xóa lỗi | Bộ đếm lỗi TEC/REC, error confinement |
| Bơm frame từ giao diện (mô phỏng frame từ bus ngoài) | Ngắt (hệ thống dùng polling thống nhất) |

Việc đơn giản hóa là **có chủ đích**: mô hình chỉ giữ đúng phần mà phần mềm nhúng thực sự nhìn thấy (giao diện thanh ghi), lược bỏ phần thuộc về phần cứng tầng dưới; mọi giới hạn đều được ghi rõ trong báo cáo (mục 1.3.2, 4.6.3, 5.5, 6.2).

### 2.3. Tài liệu tham khảo thiết kế

Thiết kế tham khảo **Bosch M_CAN User's Manual v3.3.1** [19] về cấu trúc controller và cách tổ chức thanh ghi, sau đó chọn tập con tối thiểu (đề tài không tái hiện M_CAN). Đối chiếu khái niệm:

| Khái niệm trong mô hình | Tương ứng trong M_CAN manual |
|---|---|
| TX mailbox (TX_ID, TX_DLC, TX_DATA0/1) | Tx Buffer Element — mục 2.4.3 (ID + DLC + data bytes) |
| RX mailbox (RX_ID, RX_DLC, RX_DATA0/1) | Rx Buffer / FIFO Element — mục 2.4.2 |
| Bit LOOPBACK | Test Modes, TEST.LBCK — mục 3.1.9: "treats its own transmitted messages as received messages" |
| RX_POP | Rx FIFO Acknowledge (RXF0A) — mục 2.3.29 |
| Bit EN | Software Initialization, CCCR.INIT — mục 3.1.1 |
| Cờ ERROR | Đơn giản hóa từ ECR/PSR — mục 2.3.13–2.3.14 |

Lý thuyết giao thức (frame format, arbitration, bit stuffing, CRC) thuộc **Bosch CAN Specification 2.0 (1991)** / ISO 11898-1 — M_CAN manual ủy thác toàn bộ phần này cho chuẩn ISO.

---

## 3. Tích hợp vào SoC

| Thuộc tính | Giá trị |
|---|---|
| Địa chỉ nền | `0xFF200000` |
| Kích thước vùng | 256 byte (`0xFF200000`–`0xFF2000FF`) |
| Bus | TileLink-UL (bus ngoại vi) |
| Cacheable | Không (non-cacheable, MMU phân loại) |
| Cơ chế giao tiếp | MMIO, polling |

Đường đi của một lệnh `sw`/`lw` tới CAN:

```
CPU (lw/sw 0xFF200000+offset)
 → MMU: dịch địa chỉ, phân loại vùng MMIO non-cacheable
 → bỏ qua cache (cache bypass, không đưa thanh ghi thiết bị vào cache)
 → TileLink-UH (bus tốc độ cao)
 → cầu nối UH→UL (bridge)
 → TileLink-UL (bus ngoại vi)
 → MMIO endpoint "CAN Controller" (createMMIOEndpoint trong soc.js)
 → can.js: readRegister(addr) / writeRegister(addr, value)
 → endpoint trả AccessAckData / AccessAck về CPU
```

Endpoint MMIO tách logic thiết bị (trong `can.js`) khỏi việc đấu nối bus (trong `soc.js`) — cùng khuôn mẫu với UART, LED, bàn phím, chuột.

---

## 4. Bản đồ thanh ghi

Tất cả thanh ghi là từ 32 bit, truy cập bằng `lw`/`sw` tại `0xFF200000 + offset`.

| Thanh ghi | Offset | Quyền | Ý nghĩa |
|---|---|---|---|
| CTRL | `0x00` | Đọc/Ghi | Bit 0 **EN** (bật controller); bit 1 **SOFT_RESET** (ghi 1 để reset toàn bộ); bit 2 **LOOPBACK** |
| STATUS | `0x04` | Đọc | Bit 0 **TX_READY**; bit 1 **RX_AVAILABLE**; bit 2 **ERROR** |
| TX_ID | `0x20` | Đọc/Ghi | Identifier 11 bit của frame sắp phát (hợp lệ `0x000`–`0x7FF`) |
| TX_DLC | `0x24` | Đọc/Ghi | Số byte dữ liệu của frame sắp phát (hợp lệ 0–8) |
| TX_DATA0 | `0x28` | Đọc/Ghi | Byte 0–3 của payload (little-endian) |
| TX_DATA1 | `0x2C` | Đọc/Ghi | Byte 4–7 của payload (little-endian) |
| CMD | `0x30` | Ghi | Bit 0 **SEND** (phát frame); bit 1 **CLEAR_ERROR** (xóa cờ lỗi) |
| RX_ID | `0x40` | Đọc | Identifier của frame trong RX mailbox (0 nếu rỗng) |
| RX_DLC | `0x44` | Đọc | DLC của frame trong RX mailbox |
| RX_DATA0 | `0x48` | Đọc | Byte 0–3 payload của frame nhận |
| RX_DATA1 | `0x4C` | Đọc | Byte 4–7 payload của frame nhận |
| RX_POP | `0x50` | Ghi | Ghi 1 vào bit 0 để xóa frame khỏi RX mailbox (giải phóng mailbox) |

**Bố cục dữ liệu little-endian:** payload `[0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88]` tương ứng `TX_DATA0 = 0x44332211`, `TX_DATA1 = 0x88776655` — byte 0 nằm ở 8 bit thấp của TX_DATA0, nhất quán với quy ước little-endian của RISC-V.

---

## 5. Cơ chế hoạt động chi tiết

### 5.1. Luồng truyền (TX)

1. Phần mềm bật controller: ghi `CTRL.EN = 1` (kèm `LOOPBACK = 1` nếu muốn tự nhận).
2. Nạp frame vào TX mailbox: ghi `TX_ID`, `TX_DLC`, `TX_DATA0`, `TX_DATA1`.
3. Ra lệnh phát: ghi `CMD.SEND = 1`.
4. Controller kiểm tra ba điều kiện: **EN đã bật**, **ID ≤ 0x7FF**, **DLC ≤ 8**.
   - Hợp lệ → đóng frame `{id, dlc, data[dlc]}` (cắt payload đúng DLC byte), phát qua callback `onTransmit` — giao diện hiển thị frame TX gần nhất; nếu LOOPBACK bật, frame được đưa vào RX mailbox.
   - Vi phạm bất kỳ điều kiện nào → đặt cờ **ERROR**, **không phát frame** (frame sai bị chặn ngay tại controller).
5. `STATUS.TX_READY` phản ánh trạng thái sẵn sàng phát. Vì mô hình truyền **tức thời ở mức message** (không mô phỏng thời gian truyền từng bit), TX_READY luôn bằng 1 khi EN bật — khác với UART của đề tài vốn có mô hình thời gian theo baud rate; đây là lựa chọn nhất quán với mức trừu tượng frame/message.

### 5.2. Chế độ loopback

Khi `CTRL.LOOPBACK = 1`, frame vừa phát được nối vòng nội bộ về phía nhận: controller "coi frame mình phát như frame nhận được" và đặt vào RX mailbox. Ý nghĩa: cho phép **tự kiểm tra toàn bộ đường TX → RX chỉ với một nút**, không cần nút CAN thứ hai — đúng vai trò của chế độ Loop Back Mode (TEST.LBCK) trong M_CAN, vốn được Bosch thiết kế cho hardware self-test.

### 5.3. Luồng nhận (RX)

Frame đến từ hai nguồn: **loopback** (mục 5.2) hoặc **inject từ giao diện web** (mô phỏng một frame từ bus bên ngoài đi vào nút).

- RX mailbox chứa **đúng một frame**. Nếu mailbox trống → frame được lưu, `STATUS.RX_AVAILABLE = 1`.
- Nếu mailbox **đang có frame** → frame mới bị **từ chối**, cờ ERROR được đặt, **frame cũ giữ nguyên** (dữ liệu chưa đọc không bị ghi đè) — minh họa tình huống tràn buffer và yêu cầu phần mềm phải đọc kịp.

Trình tự phần mềm đọc frame:

1. Poll `STATUS` đến khi bit RX_AVAILABLE = 1.
2. Đọc `RX_ID`, `RX_DLC`, `RX_DATA0`, `RX_DATA1`.
3. Ghi `RX_POP = 1` để giải phóng mailbox (tương tự cơ chế FIFO acknowledge của M_CAN) — RX_AVAILABLE trở về 0, mailbox sẵn sàng nhận frame kế tiếp.

### 5.4. Xử lý lỗi

| Tình huống | Hành vi |
|---|---|
| Ghi SEND khi EN = 0 | ERROR = 1, không phát |
| TX_ID > 0x7FF (vượt 11 bit) | ERROR = 1, không phát |
| TX_DLC > 8 | ERROR = 1, không phát |
| Frame đến khi RX mailbox đầy | ERROR = 1, từ chối frame mới, giữ frame cũ |
| Inject frame không hợp lệ (ID/DLC sai) | ERROR = 1, không nhận |

Cờ ERROR là **một bit trạng thái dính (sticky)**: nó giữ nguyên cho tới khi phần mềm ghi `CMD.CLEAR_ERROR = 1`, hoặc reset controller bằng `CTRL.SOFT_RESET`. Đây là phiên bản tối giản của bộ thanh ghi lỗi ECR/PSR trong M_CAN.

### 5.5. Reset

Ghi `CTRL.SOFT_RESET = 1` đưa toàn bộ controller về trạng thái mặc định: CTRL = 0 (tắt EN, tắt LOOPBACK), TX mailbox xóa về 0, RX mailbox rỗng, cờ ERROR xóa.

---

## 6. Cách sử dụng

### 6.1. Từ chương trình hợp ngữ

Chương trình demo loopback đầy đủ (rút từ `test/can_loopback.asm`):

```asm
_start:
    li t0, 0xFF200000       # địa chỉ nền CAN

    li t1, 5                # CTRL: EN (bit 0) | LOOPBACK (bit 2)
    sw t1, 0x00(t0)

    li t1, 0x123            # TX_ID = 0x123 (11 bit hợp lệ)
    sw t1, 0x20(t0)
    li t1, 8                # TX_DLC = 8 byte
    sw t1, 0x24(t0)
    li t1, 0x44332211       # payload byte 0-3
    sw t1, 0x28(t0)
    li t1, 0x88776655       # payload byte 4-7
    sw t1, 0x2C(t0)

    li t1, 1                # CMD: SEND
    sw t1, 0x30(t0)

wait_rx:                    # poll chờ frame loopback về
    lw t2, 0x04(t0)         # đọc STATUS
    andi t2, t2, 2          # tách bit RX_AVAILABLE
    beq t2, x0, wait_rx

    lw t2, 0x40(t0)         # đọc RX_ID  → kỳ vọng 0x123
    lw t2, 0x44(t0)         # đọc RX_DLC → kỳ vọng 8
    lw t2, 0x48(t0)         # đọc RX_DATA0 → kỳ vọng 0x44332211
    lw t2, 0x4C(t0)         # đọc RX_DATA1 → kỳ vọng 0x88776655

    li t1, 1
    sw t1, 0x50(t0)         # RX_POP: giải phóng mailbox

    li a0, 0                # exit code 0 = thành công
    li a7, 93
    ecall
```

(Bản đầy đủ trong `test/can_loopback.asm` còn so sánh từng giá trị đọc về và thoát với mã lỗi 1–5 tương ứng nếu sai — dùng làm test tự chấm.)

### 6.2. Từ giao diện web

Khung **CAN** trong tab I/O của trình mô phỏng cung cấp:

- **Latest TX frame:** hiển thị frame vừa phát (ID, DLC, payload hex) — cập nhật qua callback `onTransmit`.
- **RX mailbox:** hiển thị frame đang chờ phần mềm đọc (hoặc "RX mailbox is empty").
- **Inject frame:** form nhập ID + DLC + payload (hex) để bơm một frame "từ bus bên ngoài" vào RX mailbox — mô phỏng việc một nút khác gửi dữ liệu tới; nếu mailbox đang đầy, giao diện báo frame bị từ chối.
- **Clear:** xóa hiển thị TX và cờ lỗi.

Ngoài ra **sơ đồ SoC động** làm nổi bật cạnh `ul-to-can` mỗi khi có giao dịch đọc/ghi tới CAN, và **nhật ký hệ thống** ghi các dòng log gắn nhãn theo từng tầng (MMU, TileLink-UH, bridge, TileLink-UL, CAN) — dùng được làm bằng chứng trực quan khi demo.

### 6.3. Kịch bản demo gợi ý (≈2 phút)

1. Nạp và chạy `can_loopback.asm` → chương trình thoát mã 0; chỉ vào sơ đồ SoC thấy đường CPU → bus → CAN sáng lên.
2. Mở khung CAN: thấy frame TX 0x123/DLC 8 và RX mailbox đã được pop.
3. Inject một frame từ giao diện (ví dụ ID 0x321, DLC 3, payload `01 02 03`) → RX_AVAILABLE dựng; chạy đoạn chương trình đọc frame → đọc đúng dữ liệu.
4. Inject tiếp một frame khi mailbox còn đầy → giao diện báo từ chối, cờ ERROR dựng → minh họa hành vi tràn buffer.

---

## 7. Kiểm thử và bằng chứng đúng đắn

### 7.1. Kiểm thử đơn vị — `test/can_verify.mjs`

Khởi tạo trực tiếp `CANController` và assert: trạng thái mặc định sau khởi tạo/reset; EN ↔ TX_READY; phát frame ID 0x123/DLC 8 đúng payload qua `onTransmit`; loopback đưa frame vào RX mailbox đúng từng thanh ghi; RX_POP xóa RX_AVAILABLE; lỗi khi ID = 0x800 (vượt 11 bit); lỗi khi DLC = 9; CLEAR_ERROR; inject frame hợp lệ/không hợp lệ; từ chối frame khi mailbox đầy và giữ nguyên frame cũ. **Kết quả: pass toàn bộ.**

### 7.2. Kiểm thử tích hợp — `test/can_mmio_verify.mjs`

Biên dịch `can_loopback.asm` bằng assembler của đề tài, chạy trên CPU mô phỏng cho tới khi dừng, rồi assert:

- Chương trình thoát với **mã 0** (mọi giá trị loopback đọc về đều đúng), sau **354 chu kỳ**.
- MMU phân loại vùng CAN là **non-cacheable** (kiểm tra trong translation history và log `[MMU] REQUEST … pa=0xff200000 … cacheable=false`).
- Truy cập đi đúng đường: log `[TileLink-UH] … DIRECT_WRITE` → `[uh-to-ul-bridge] BRIDGE_DIRECT_WRITE` → `[TileLink-UL] TileLink → CAN Controller DIRECT_WRITE/DIRECT_READ`.
- Sau RX_POP, RX_AVAILABLE = 0.

**Kết quả: pass.** Ý nghĩa: hai mức test bổ trợ nhau — unit test chứng minh **logic controller đúng**, integration test chứng minh **tích hợp bus hoàn chỉnh** (CPU thật sự nói chuyện được với CAN qua MMU + cache bypass + hai tầng TileLink). Đây đúng là claim của đề tài: tích hợp ngoại vi vào SoC, không phải tương thích giao thức CAN.

---

## 8. Hạn chế và hướng phát triển

- Mô hình dừng ở mức frame/message: không physical layer, bit stuffing, CRC, ACK, arbitration bit-level — đã ghi rõ ở các mục 1.3.2, 4.6.3, 5.5 và 6.2 của báo cáo.
- Chỉ có một nút CAN; chưa có khái niệm bus nhiều nút nên arbitration không phát sinh.
- Giao tiếp bằng polling, nhất quán với việc toàn hệ thống chưa có đường ngắt tới CPU.
- Hướng phát triển (mục 6.3 của báo cáo): mô hình nhiều nút trên một bus ảo, mô hình lỗi chi tiết hơn (bộ đếm lỗi, error frame); chỉ xuống mức bit-level khi có mục tiêu và bộ kiểm chứng phù hợp.

---

## 9. Tài liệu tham khảo

1. Robert Bosch GmbH, *M_CAN Controller Area Network User's Manual*, Revision 3.3.1, 11/03/2023 — tham khảo cấu trúc controller (Tx/Rx Buffer Element mục 2.4.2–2.4.3, Test Modes/loopback mục 3.1.9, CCCR mục 3.1.1). File: `docs/ref/mcan_users_manual_v331.pdf`.
2. Robert Bosch GmbH, *CAN Specification Version 2.0*, 1991 — lý thuyết giao thức: data frame và arbitration (tr. 11–17), coding/bit stuffing (tr. 23), error handling (tr. 24). File: `docs/ref/bosch_can_specification_2.0_1991.pdf`.
3. ISO 11898-1:2015, *Road vehicles — Controller area network — Part 1: Data link layer and physical signalling* — chuẩn mà M_CAN manual tham chiếu cho toàn bộ chức năng giao thức.

---

## 10. Phụ lục: câu hỏi dự kiến và trả lời

**Q1. Em làm gì trong phần CAN?**
Em thiết kế và hiện thực một CAN controller tối giản ở mức frame/message (12 thanh ghi MMIO, TX/RX mailbox, loopback), tích hợp vào SoC qua TileLink-UL tại `0xFF200000`, làm giao diện demo, và kiểm chứng bằng unit test cộng một chương trình hợp ngữ chạy hết đường bus từ CPU xuống thiết bị.

**Q2. Thiết kế tham khảo ở đâu?**
Bosch M_CAN User's Manual v3.3.1: khái niệm Tx/Rx Buffer Element gồm ID + DLC + data (mục 2.4.2–2.4.3) và chế độ loopback test TEST.LBCK (mục 3.1.9). Em không tái hiện M_CAN mà chọn tập con tối thiểu — báo cáo ghi rõ điều này ở mục 4.6.3.

**Q3. Sao register map khác hoàn toàn M_CAN?**
Vì em chỉ mượn kiến trúc khái niệm rồi tự thiết kế register map tối thiểu cho mục đích giáo dục — M_CAN cần message RAM ngoài, filter, FIFO… vượt xa nhu cầu minh họa MMIO của đề tài.

**Q4. Lý thuyết CAN nằm đâu trong tài liệu của em?**
Lý thuyết giao thức thuộc Bosch CAN Specification 2.0 / ISO 11898-1 (chính M_CAN manual cũng ủy thác phần giao thức cho ISO 11898-1, ghi ngay trang 1). Mô hình của em ở mức frame/message nên chỉ dùng các khái niệm identifier 11 bit, DLC và payload từ chuẩn.

**Q5. Sao không mô phỏng arbitration — đó chẳng phải phần hay nhất của CAN?**
Arbitration chỉ phát sinh khi có nhiều nút phát đồng thời trên một bus; mô hình hiện có một nút nên không có tình huống tranh chấp. Mở rộng nhiều nút là hướng phát triển đã nêu, và chỉ làm khi có bộ kiểm chứng phù hợp.

**Q6. Tại sao nhận frame (inject) không cần bật EN?**
Inject là hook demo của giao diện, mô phỏng frame đến từ bus bên ngoài; mô hình chỉ ràng buộc EN cho chiều phát. Đây là đơn giản hóa có chủ đích ở mức mô hình giáo dục.

**Q7. TX_READY lúc nào cũng bằng 1 khi EN bật — có vô nghĩa không?**
Không — vì mô hình truyền tức thời ở mức message nên controller không bao giờ "bận". Đề tài minh họa khía cạnh thời gian truyền ở UART (mô hình baud rate); CAN tập trung minh họa khía cạnh mailbox và luồng frame.

**Q8. Làm sao chứng minh nó chạy đúng?**
Hai mức: `can_verify.mjs` (unit, toàn bộ thanh ghi và các trường hợp lỗi) và `can_mmio_verify.mjs` (chạy `can_loopback.asm` trên CPU thật, thoát mã 0 sau 354 chu kỳ, assert log từng tầng MMU → UH → bridge → UL → CAN). Cả hai đều pass và demo trực tiếp được.
