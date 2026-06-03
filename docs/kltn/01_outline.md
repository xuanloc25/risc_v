# 01. Dàn ý chi tiết báo cáo KLTN

> **Đề tài:** Phát triển trình mô phỏng hệ thống trên chip dựa trên kiến trúc tập lệnh RISC-V RV32IMF và giao thức TileLink
> **English:** Developing a System-on-Chip Simulator Based on RISC-V RV32IMF Instruction Set Architecture and TileLink Protocol
> **SVTH:** Nguyễn Xuân Lộc (22520793), Dương Hiển Gia Khang (22520610)
> **GVHD:** ThS. Nguyễn Thành Nhân; KS. Trần Đại Dương
> **Khoa:** Kỹ thuật Máy tính – Trường ĐH Công nghệ Thông tin, ĐHQG-HCM

---

## 0. Hướng dẫn sử dụng dàn ý này

- Đây là **dàn ý**, không phải bản thảo. Mỗi mục chỉ ghi: (a) nội dung cần trình bày, (b) nguồn lấy thông tin, (c) hình/bảng nên có, (d) ước lượng số trang.
- Quy ước heading tối đa **4 cấp**: `Chương X` → `X.Y` → `X.Y.Z` → `X.Y.Z.W` (đúng mẫu Phụ lục 3 của Khoa).
- Quy ước đánh số hình/bảng theo chương: `Hình <chương>.<số>`, `Bảng <chương>.<số>` (đúng mẫu Phụ lục 3).
- Nguồn được viết tắt: `src/js/<file>` = mã nguồn; `test/<file>` = kiểm thử/demo; `[ref:...]` = tài liệu trong `docs/ref/`; `[analysis]` = `docs/kltn/00_project_analysis.md`.
- **Ký hiệu cảnh báo** ⚠️ = điểm cần SV xác nhận/bổ sung số liệu trước khi viết (lấy từ mục 7–8 của `00_project_analysis.md`). Không viết là "đã hoàn chỉnh" nếu chưa có bằng chứng.

### 0.1. Bảng phân bổ số trang (mục tiêu 80–110 trang nội dung chính, tổng ≤ 140)

| Phần | Ước lượng | Ghi chú |
|---|---|---|
| Trang bìa, nhận xét, lời cảm ơn, mục lục, danh mục hình/bảng/viết tắt | (không tính nội dung) | Theo mẫu Phụ lục 3 |
| Tóm tắt khóa luận | 1.5–2 | Tiếng Việt (+ abstract tiếng Anh tùy chọn) |
| Chương 1. Tổng quan đề tài | 11–13 | Khảo sát + so sánh khóa trước |
| Chương 2. Cơ sở lý thuyết | 23–26 | RISC-V, MMU, cache, TileLink, DMA, I/O |
| Chương 3. Phân tích và thiết kế hệ thống | 16–19 | Kiến trúc tổng quan, UI, luồng dữ liệu |
| Chương 4. Hiện thực hệ thống / thiết kế chi tiết | 29–33 | Phần trọng tâm kỹ thuật |
| Chương 5. Kiểm thử và đánh giá | 15–18 | Verification + so sánh |
| Chương 6. Kết luận và hướng phát triển | 4–6 | |
| **Cộng nội dung chính (Ch.1–6 + tóm tắt)** | **~95–110** | Đạt yêu cầu ≥ 80, ≤ 140 |
| Tài liệu tham khảo (IEEE) | 2–3 | |
| Phụ lục | 6–12 | Bảng lệnh, register map, mã demo, log |

> So sánh quy mô: KLTN khóa trước (Nguyễn Gia Bảo Ngọc, 2025) có ~91 trang nội dung chính (Chương 1 trang 2 → hết Chương 6 trang 92). Đề tài này có phạm vi rộng hơn (thêm RV32M, RV32F/FPU, nhiều ngoại vi, nhiều lớp kiểm thử) nên nhắm ~95–110 trang là hợp lý.

---

## PHẦN ĐẦU (front matter – theo mẫu Phụ lục 3)

Liệt kê để không thiếu khi đóng quyển (không tính vào 80 trang nội dung):

- Trang bìa chính + bìa phụ.
- Nhận xét của giảng viên hướng dẫn / hội đồng.
- Lời cảm ơn.
- Mục lục; Danh mục hình; Danh mục bảng; Danh mục từ viết tắt.
- **Nguồn:** mẫu `[ref:KTMT_KLTN_Phu luc 3_Mau bao cao]`, `[ref:KTMT_KLTN_Phu luc 2_Hinh thuc trinh bay]`; tham chiếu cách trình bày của `[ref:Thư viện số - Quản lý tài nguyên số]` (KLTN khóa trước).
- **Danh mục từ viết tắt** đề xuất: SoC, ISA, RISC, CISC, RV32I/M/F/A, FPU, ALU, MMU, TLB, VPN/PPN/PTE, MMIO, DMA, FIFO, LRU, TileLink (TL-UL/TL-UH/TL-C), UART, LED, IEEE 754, CDN, ES Module, CodeMirror, IPS (instructions/sec).

---

## TÓM TẮT KHÓA LUẬN — *~1.5–2 trang*

- **Nội dung:** Bối cảnh (nhu cầu công cụ mô phỏng SoC trực quan cho giảng dạy KTMT); vấn đề các công cụ hiện có; mục tiêu (mô phỏng SoC RISC-V RV32IMF + TileLink trên Web); phương pháp (mô phỏng mức hành vi theo chu kỳ, kiểm chứng bằng GNU/Spike/riscv-tests); kết quả chính (assembler + CPU + MMU/cache + TileLink-UH/UL + DMA + 4 ngoại vi + trực quan hóa); đóng góp.
- **Nguồn:** `[analysis]` mục 2, 6; `[ref:đề cương]` phần tổng quan & mục tiêu; `README.md`.
- **Hình/bảng:** không.
- **Ghi chú:** Nên có cả bản tiếng Anh (Abstract) nếu Khoa yêu cầu.

---

## CHƯƠNG 1. TỔNG QUAN ĐỀ TÀI — *~11–13 trang*

### 1.1. Lý do thực hiện đề tài — *~5–6 trang*

#### 1.1.1. Bối cảnh và động lực
- **Nội dung:** Vai trò của hệ thống trên chip (SoC) và RISC-V trong đào tạo KTMT; nhu cầu công cụ trực quan hóa hoạt động CPU–bus–bộ nhớ–ngoại vi; lý do chọn nền tảng Web (dễ tiếp cận, không cài đặt).
- **Nguồn:** `[ref:đề cương]` (tổng quan đề tài); `README.md` (mục tiêu học tập).
- **Hình/bảng:** *Hình 1.1* – minh họa ý niệm SoC tổng quát (có thể dùng lại `[ref:SoC.png]` ở mức ý niệm).
- **Trang:** ~1.5.

#### 1.1.2. Khảo sát các công cụ mô phỏng hiện có
- **Nội dung:** Phân tích ưu/nhược điểm từng công cụ tham chiếu:
  - MARS (MIPS, Java/JRE, chỉ mức ISA, thiếu Bus/DMA).
  - RISC-V Interpreter (Cornell, đơn giản, chỉ biên dịch + quan sát thanh ghi, không datapath/ngoại vi).
  - WebRISC-V (datapath đa chu kỳ nhưng chỉ nội bộ CPU, không SoC, không ngoại vi).
  - Ripes (trực quan datapath/pipeline tốt nhưng nặng vi kiến trúc CPU, hạn chế tùy biến Bus/DMA cho SoC).
  - Spike (reference chuẩn RISC-V International, chính xác cao nhưng CLI, thiếu trực quan).
  - **Đề tài khóa trước – Nguyễn Gia Bảo Ngọc (2025), "Phát triển trình mô phỏng SoC"**: cùng hướng SoC RISC-V, phạm vi RV32I + mở rộng atomic (Zaamo), MMU kiểu SATP, TileLink, DMA, ngoại vi LED.
- **Nguồn:** `[ref:đề cương]` mục "Tổng quan đề tài" và tài liệu tham khảo [1]–[5]; `[ref:Thư viện số - Quản lý tài nguyên số]` (mục lục + danh mục từ viết tắt KLTN khóa trước).
- **Hình/bảng:** **Bảng 1.1** – So sánh chức năng các công cụ liên quan (MARS / RISC-V Interpreter / WebRISC-V / Spike / **KLTN khóa trước** / Đề tài này) → đây là **bảng so sánh trọng tâm** (xem mẫu cột ở §Danh sách bảng, B1). ⚠️ Xác nhận lại chi tiết KLTN khóa trước bằng cách đọc toàn văn PDF (hiện chỉ trích được mục lục + danh mục viết tắt).
- **Trang:** ~3 (gồm bảng so sánh lớn).

#### 1.1.3. Khoảng trống và giải pháp đề xuất
- **Nội dung:** Tổng hợp khoảng trống (chưa có công cụ Web mô phỏng đầy đủ từ Core lên SoC, tích hợp assembler + FPU + DMA + nhiều ngoại vi + trực quan hóa + kiểm chứng chuẩn). Phát biểu giải pháp: trình mô phỏng SoC RV32IMF + TileLink chạy trên trình duyệt.
- **Nguồn:** `[ref:đề cương]` ("đề tài lựa chọn hướng…"), `[analysis]` mục 6 (những phần đã hiện thực).
- **Hình/bảng:** không.
- **Trang:** ~1.

### 1.2. Mục tiêu và phạm vi đề tài — *~3 trang*

#### 1.2.1. Mục tiêu
- **Nội dung:** Mục tiêu tổng quát (công cụ giáo dục mô phỏng hành vi SoC) và 4 mục tiêu kỹ thuật theo đề cương: (1) CPU RV32 RISC-V, (2) Bus đa master + quản lý quyền truy cập, (3) tối ưu luồng dữ liệu bằng DMA, (4) tích hợp assembler + ngoại vi tương tác thời gian thực.
- **Nguồn:** `[ref:đề cương]` mục "Mục tiêu của đề tài".
- **Hình/bảng:** không.
- **Trang:** ~1.5.

#### 1.2.2. Phạm vi và giới hạn
- **Nội dung:** Mô phỏng mức **hành vi/chức năng** (không mô phỏng timing vật lý/công suất); JavaScript đơn luồng trên trình duyệt nên không đạt tần số chip thật. ⚠️ Chốt phạm vi ISA: ghi rõ **"hỗ trợ tập con RV32IMF phục vụ mô phỏng"** thay vì "đầy đủ", và liệt kê phần chưa hỗ trợ: CSR/đặc quyền, FCSR/fflags/frm, thực thi FENCE, B/C/E channel TileLink, IRQ phần cứng. Ghi rõ AMOADD.W là mở rộng RV32A ngoài tên đề tài.
- **Nguồn:** `[ref:đề cương]` ("Giới hạn của đề tài"); `[analysis]` mục 4.1, 4.2, 7.
- **Hình/bảng:** **Bảng 1.2** – Phạm vi chức năng: Đã hỗ trợ / Hỗ trợ một phần / Ngoài phạm vi.
- **Trang:** ~1.5.

### 1.3. Đối tượng, phương pháp và cấu trúc báo cáo — *~3 trang*

#### 1.3.1. Đối tượng và phương pháp thực hiện
- **Nội dung:** Phương pháp nghiên cứu tài liệu (RV32IMF, SoC, MMU, TileLink TL-UL/TL-UH); phương pháp phát triển (mô phỏng SoC trên Web); phương pháp kiểm thử (đối chiếu Spike/Ripes + test suites, triển khai công khai).
- **Nguồn:** `[ref:đề cương]` mục "Phương pháp thực hiện".
- **Hình/bảng:** không.
- **Trang:** ~1.

#### 1.3.2. Đóng góp của khóa luận
- **Nội dung:** Nêu rõ điểm mới so với KLTN khóa trước và các công cụ khác: bổ sung **RV32M (nhân/chia số nguyên)** và **RV32F (số thực + 32 thanh ghi f0–f31)**; phân cấp cache L1I/L1D/L2 có thống kê; thêm ngoại vi UART (baud)/keyboard/mouse; trực quan hóa SoC động + MMU view + cache view + system log lọc theo module; quy trình kiểm chứng GNU + Spike + riscv-tests.
- **Nguồn:** `[analysis]` mục 4–6; đối chiếu `[ref:Thư viện số]` (mục lục khóa trước).
- **Hình/bảng:** không (đóng góp được định lượng trong Bảng 1.1).
- **Trang:** ~1.

#### 1.3.3. Phân công công việc
- **Nội dung:** Bảng phân công theo kế hoạch đề cương (Lộc: CPU, FPU, Assembler; Khang: Bus Interconnect, DMA, I/O+UI). ⚠️ Cần SV xác nhận phân công cuối cùng (git log chưa đủ căn cứ).
- **Nguồn:** `[ref:đề cương]` mục "Kế hoạch thực hiện"; ⚠️ `[analysis]` mục 8.9.
- **Hình/bảng:** **Bảng 1.3** – Phân công công việc & tiến độ.
- **Trang:** ~0.5.

#### 1.3.4. Cấu trúc báo cáo
- **Nội dung:** Tóm tắt nội dung 6 chương.
- **Nguồn:** dàn ý này.
- **Trang:** ~0.5.

---

## CHƯƠNG 2. CƠ SỞ LÝ THUYẾT — *~23–26 trang*

### 2.1. Hệ thống trên chip (SoC) — *~3 trang*
- **Nội dung:** Khái niệm SoC; các thành phần điển hình (CPU, bộ nhớ, bus/interconnect, DMA, ngoại vi); các mức mô hình hóa mô phỏng (functional/behavioral vs cycle-accurate vs RTL) và lý do chọn mức behavioral theo chu kỳ.
- **Nguồn:** `[ref:đề cương]`; `[ref:SoC.png]`; lý thuyết SoC tổng quát (cần citation sách/tài liệu).
- **Hình/bảng:** *Hình 2.1* – Sơ đồ khối SoC điển hình.
- **Trang:** ~3.

### 2.2. Kiến trúc tập lệnh RISC-V — *~8–9 trang*

#### 2.2.1. Tổng quan RISC-V và triết lý mô-đun hóa ISA
- **Nội dung:** RISC vs CISC; cấu trúc mô-đun của RISC-V (base + extensions); ý nghĩa "RV32IMF".
- **Nguồn:** RISC-V ISA spec (⚠️ cần bổ sung citation chính thức – `[analysis]` 7.8).
- **Hình/bảng:** **Bảng 2.1** – Các mở rộng RISC-V và phạm vi đề tài (I, M, F, (A)).
- **Trang:** ~1.5.

#### 2.2.2. Tập lệnh cơ sở RV32I
- **Nội dung:** 32 thanh ghi số nguyên x0–x31, PC; các nhóm lệnh: load/store, ALU reg-reg & reg-imm, branch, jump (JAL/JALR), LUI/AUIPC, ECALL/EBREAK; (FENCE – mô tả khái niệm, ghi chú chưa thực thi).
- **Nguồn:** `src/js/cpu.js` (decode/execute); `src/js/assembler.js` (opcode table); RISC-V ISA spec.
- **Hình/bảng:** **Bảng 2.2** – Danh sách nhóm lệnh RV32I (mnemonic, định dạng, ý nghĩa). *Hình 2.2* – Các định dạng lệnh R/I/S/B/U/J (bit field).
- **Trang:** ~3.

#### 2.2.3. Mở rộng RV32M (nhân/chia số nguyên)
- **Nội dung:** MUL, MULH, MULHSU, MULHU, DIV, DIVU, REM, REMU; xử lý chia 0 và tràn INT_MIN/-1.
- **Nguồn:** `src/js/cpu.js` (BigInt cho MULH*, Math.imul).
- **Hình/bảng:** gộp vào **Bảng 2.3** (danh sách nhóm lệnh M+F, xem Danh sách bảng).
- **Trang:** ~1.

#### 2.2.4. Mở rộng RV32F (số thực đơn) và chuẩn IEEE 754
- **Nội dung:** 32 thanh ghi f0–f31; nhóm lệnh F: nạp/lưu (FLW/FSW), số học (FADD/FSUB/FMUL/FDIV/FSQRT), FMA (FMADD/FMSUB/FNMSUB/FNMADD), min/max, dấu (FSGNJ*), so sánh (FEQ/FLT/FLE), phân loại (FCLASS), chuyển đổi (FCVT.*), di chuyển bit (FMV.X.W/FMV.W.X); chuẩn IEEE 754 single precision và các chế độ làm tròn. ⚠️ Ghi rõ giới hạn: chưa có fflags/frm/fcsr, chưa kiểm chứng bit-exact đầy đủ.
- **Nguồn:** `src/js/cpu.js`; IEEE 754 (⚠️ cần citation).
- **Hình/bảng:** **Bảng 2.3** – Danh sách nhóm lệnh RV32M & RV32F hỗ trợ.
- **Trang:** ~2.5.

#### 2.2.5. Thao tác nguyên tử trên bộ nhớ (RV32A – tùy chọn)
- **Nội dung:** Khái niệm AMO; lệnh AMOADD.W có trong hệ thống; mối liên hệ với TileLink ArithmeticData. ⚠️ Trình bày như "mở rộng ngoài tên đề tài RV32IMF".
- **Nguồn:** `src/js/cpu.js`, `src/js/tilelink.js`.
- **Hình/bảng:** không.
- **Trang:** ~0.5–1. *(Có thể lược bỏ nếu chốt không đưa RV32A vào báo cáo.)*

### 2.3. Quản lý bộ nhớ và đơn vị MMU — *~3 trang*
- **Nội dung:** Địa chỉ ảo/vật lý, phân trang (page/VPN/PPN/offset), bảng trang (PTE), TLB và nguyên lý cục bộ; quyền truy cập (R/W/X); khái niệm cacheable/non-cacheable.
- **Nguồn:** lý thuyết HĐH/kiến trúc máy tính; ánh xạ tới `src/js/mmu.js`; đối chiếu thuật ngữ với `[ref:Thư viện số]` (khóa trước dùng SATP/PTE).
- **Hình/bảng:** *Hình 2.3* – Cơ chế dịch địa chỉ VA→PA qua TLB và bảng trang.
- **Trang:** ~3.

### 2.4. Bộ nhớ đệm (Cache) — *~2.5 trang*
- **Nội dung:** Nguyên lý cache; tổ chức set-associative (set/way/block); hit/miss; chính sách ghi (write-through/write-back); thay thế LRU; phân cấp L1/L2; bỏ qua cache với vùng MMIO.
- **Nguồn:** lý thuyết kiến trúc máy tính; ánh xạ tới `src/js/SimpleCache.js`.
- **Hình/bảng:** *Hình 2.4* – Tổ chức cache set-associative (set/way/block, tag/index/offset).
- **Trang:** ~2.5.

### 2.5. Giao thức kết nối TileLink — *~4 trang*
- **Nội dung:** Vai trò interconnect trong SoC; ba cấp độ TileLink: **TL-UL (Uncached Lightweight)**, **TL-UH (Uncached Heavyweight)**, **TL-C (Cached)**; mô hình master/slave; các kênh A/B/C/D/E và ý nghĩa; opcode kênh A (Get, PutFullData, PutPartialData, ArithmeticData, LogicalData, Intent) và kênh D (AccessAck, AccessAckData, HintAck, Grant…); mask, burst. ⚠️ Nêu rõ hệ thống chỉ hiện thực kênh A/D (TL-UL/TL-UH), không có B/C/E.
- **Nguồn:** `[ref:tilelink_spec_1.8.1.pdf]`; ánh xạ tới `src/js/tilelink.js`.
- **Hình/bảng:** *Hình 2.5* – Mô hình kênh A/D giữa master–slave. **Bảng 2.4** – So sánh ba cấp độ TileLink (TL-UL/UH/C) và opcode cho phép. **Bảng 2.5** – Danh sách opcode kênh A & kênh D (tên, mã số, ý nghĩa).
- **Trang:** ~4.

### 2.6. Truy cập bộ nhớ trực tiếp (DMA) — *~1.5 trang*
- **Nội dung:** Nguyên lý DMA, vì sao giảm tải CPU; descriptor; các chế độ địa chỉ (cố định/tăng dần); mô hình hoàn tất (polling vs interrupt).
- **Nguồn:** lý thuyết; ánh xạ tới `src/js/dma.js`.
- **Hình/bảng:** *Hình 2.6* – So sánh luồng dữ liệu CPU-copy vs DMA-copy.
- **Trang:** ~1.5.

### 2.7. Thiết bị ngoại vi và I/O ánh xạ bộ nhớ (MMIO) — *~1.5 trang*
- **Nội dung:** Khái niệm MMIO; UART (TX/RX/baud); ma trận LED (VRAM); bàn phím/chuột; polling vs interrupt-driven I/O.
- **Nguồn:** lý thuyết; ánh xạ `src/js/uart.js`, `led_matrix.js`, `keyboard.js`, `mouse.js`.
- **Hình/bảng:** không (chi tiết để Chương 4).
- **Trang:** ~1.5.

### 2.8. Công nghệ nền tảng Web — *~1.5 trang*
- **Nội dung:** HTML/CSS/JavaScript ES Module; Canvas 2D (ma trận LED); thư viện CodeMirror cho editor; mô hình chạy đơn luồng + requestAnimationFrame.
- **Nguồn:** `src/index.html` (CDN CodeMirror), `src/js/javascript.js`.
- **Hình/bảng:** không.
- **Trang:** ~1.5.

---

## CHƯƠNG 3. PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG — *~16–19 trang*

### 3.1. Phân tích yêu cầu — *~2.5 trang*
- **Nội dung:** Yêu cầu chức năng (soạn thảo/biên dịch/nạp/chạy-bước, quan sát thanh ghi/bộ nhớ/cache/MMU/bus/ngoại vi/log); yêu cầu phi chức năng (chạy trình duyệt, không cài đặt, trực quan, hiệu năng đủ tương tác). Use case tổng quát của người học.
- **Nguồn:** `README.md`; `[ref:đề cương]`; `src/index.html` (các view).
- **Hình/bảng:** *Hình 3.1* – Sơ đồ use case tổng quát. **Bảng 3.1** – Danh sách yêu cầu chức năng.
- **Trang:** ~2.5.

### 3.2. Kiến trúc tổng quan hệ thống mô phỏng SoC — *~5 trang*

#### 3.2.1. Sơ đồ kiến trúc tổng quan
- **Nội dung:** Toàn cảnh: CPU → MMU → L1I/L1D → L2 → TileLink-UH → {Main Memory, DMA regs, Bridge} → TileLink-UL → {UART, LED, Keyboard, Mouse}; DMA là master trên cả UH/UL.
- **Nguồn:** `src/js/soc.js` (composition root); `src/js/soc_diagram.js`; `[ref:SoC.png]`; `[analysis]` mục 2.
- **Hình/bảng:** **Hình 3.2 – Kiến trúc tổng quan SoC Simulator** *(hình bắt buộc #1)*.
- **Trang:** ~2.

#### 3.2.2. Danh sách module và vai trò
- **Nội dung:** Liệt kê toàn bộ module phần mềm và vai trò mô phỏng phần cứng tương ứng.
- **Nguồn:** `[analysis]` mục 3.1 & 5 (bảng ánh xạ chức năng–file); danh sách `src/js/*.js`.
- **Hình/bảng:** **Bảng 3.2** – Danh sách module hệ thống (module, file nguồn, vai trò) *(bảng bắt buộc #2)*.
- **Trang:** ~1.5.

#### 3.2.3. Bản đồ địa chỉ bộ nhớ (memory map)
- **Nội dung:** Phân vùng địa chỉ: RAM, UART (0x10000000), LED (0xFF000000), Mouse (0xFF100000), DMA regs (0xFFED0000), Keyboard (0xFFFF0000); vùng cacheable vs non-cacheable; bus phụ trách (UH/UL).
- **Nguồn:** `src/js/soc.js`; `[analysis]` mục 4.4.
- **Hình/bảng:** **Bảng 3.3 – Bản đồ địa chỉ bộ nhớ (memory map)** *(bảng bắt buộc #4)* (base, kích thước, thiết bị, bus, cacheable).
- **Trang:** ~1.5.

### 3.3. Mô hình mô phỏng theo chu kỳ và trừu tượng kết nối — *~3.5 trang*

#### 3.3.1. Mô hình tick theo chu kỳ
- **Nội dung:** Một `tick()` = một chu kỳ; thứ tự tick các module (CPU→DMA→L1→L2→UH→UL→Memory→UART) để mỗi hop tốn đúng 1 chu kỳ; bộ đếm chu kỳ; reset.
- **Nguồn:** `src/js/soc.js` (vòng tick, cycleCount).
- **Hình/bảng:** *Hình 3.3* – Trình tự tick một chu kỳ qua các module.
- **Trang:** ~2.

#### 3.3.2. Trừu tượng cổng kết nối (Port/port_link)
- **Nội dung:** Lớp `Port` và các loại cổng (link/upper/lower/memory); `attachPort`; tách rời module khỏi đấu nối; cách CPU/MMU/cache/bus dùng request/response.
- **Nguồn:** `src/js/port_link.js`; cách dùng trong `src/js/soc.js`.
- **Hình/bảng:** *Hình 3.4* – Mô hình cổng kết nối giữa hai module.
- **Trang:** ~1.5.

### 3.4. Thiết kế giao diện web — *~3.5 trang*

#### 3.4.1. Bố cục và điều hướng
- **Nội dung:** Sidebar 7 view: Editor, SoC, MMU, Cache, Memory, I/O, Help; thanh công cụ Assemble/Reset/Run/Pause/Stop/Step + thanh tốc độ + chỉ số IPS.
- **Nguồn:** `src/index.html`; `src/style.css`; `src/js/javascript.js`.
- **Hình/bảng:** **Hình 3.5 – Giao diện web tổng quan** *(hình bắt buộc #7)*; `screenshot.png`.
- **Trang:** ~2.

#### 3.4.2. Các khung quan sát trạng thái
- **Nội dung:** Bảng thanh ghi số nguyên + số thực; Instruction Memory (disassembly + breakpoint) & Data Segment (hex/ASCII); view MMU/Cache/SoC/I-O/Log.
- **Nguồn:** `src/index.html`, `src/js/javascript.js`.
- **Hình/bảng:** *Hình 3.6* – Các khung quan sát (thanh ghi/bộ nhớ). **Bảng 3.4** – Danh sách 7 view và nội dung.
- **Trang:** ~1.5.

### 3.5. Luồng thực thi chương trình hợp ngữ — *~2.5 trang*
- **Nội dung:** Từ mã nguồn ASM → assemble (2 pass) → nạp mã máy vào bộ nhớ → vòng chạy/step → cập nhật UI; xử lý syscall và xuất I/O; điều kiện dừng.
- **Nguồn:** `src/js/javascript.js` (handleAssemble/runLoop/handleStep); `src/js/assembler.js`; `src/js/cpu.js`.
- **Hình/bảng:** **Hình 3.7 – Luồng thực thi chương trình assembly** *(hình bắt buộc #2)* (sơ đồ hoạt động end-to-end).
- **Trang:** ~2.5.

---

## CHƯƠNG 4. HIỆN THỰC HỆ THỐNG / THIẾT KẾ CHI TIẾT — *~29–33 trang*

> Chương trọng tâm. Mỗi module: mô tả thiết kế dữ liệu/giải thuật + sơ đồ + ánh xạ tới mã nguồn. Hạn chế dán code dài (đưa xuống Phụ lục).

### 4.1. Trình biên dịch hợp ngữ (Assembler) — *~5 trang*

#### 4.1.1. Kiến trúc hai lượt (two-pass)
- **Nội dung:** Pass 1 (tách dòng/nhãn, tính địa chỉ/kích thước, xử lý directive); Pass 2 (mã hóa lệnh & dữ liệu, ghi little-endian); địa chỉ nền `.text`=0x00400000, `.data`=0x10010000; xử lý lỗi theo dòng.
- **Nguồn:** `src/js/assembler.js` (`_pass1`, `_pass2`).
- **Hình/bảng:** *Hình 4.1* – Sơ đồ hoạt động assembler hai lượt.
- **Trang:** ~1.5.

#### 4.1.2. Directive và pseudo-instruction
- **Nội dung:** 14 directive (.text/.data/.section/.word/.half/.byte/.float/.single/.ascii/.asciiz/.string/.space/.align/.globl/.extern/.eqv/.org); 13 pseudo (nop, li, mv, j, jr, ret, call, bnez, beqz, la, fmv.s, fabs.s, fneg.s) và khai triển tương ứng.
- **Nguồn:** `src/js/assembler.js`.
- **Hình/bảng:** **Bảng 4.1** – Danh sách directive. **Bảng 4.2** – Pseudo-instruction và khai triển.
- **Trang:** ~2.

#### 4.1.3. Mã hóa lệnh và ánh xạ thanh ghi
- **Nội dung:** Bảng opcode theo định dạng R/I/S/B/U/J và biến thể FP (R-FP, R4-FP, R-FP-CVT…); mã hóa immediate, %hi/%lo; ánh xạ tên thanh ghi ABI số nguyên/số thực.
- **Nguồn:** `src/js/assembler.js` (`_encodeInstruction`).
- **Hình/bảng:** **Bảng 4.3** – Ánh xạ thanh ghi ABI (x0–x31, f0–f31). *(Bảng lệnh + encoding chi tiết đưa Phụ lục.)*
- **Trang:** ~1.

#### 4.1.4. Hỗ trợ soạn thảo (editor hints)
- **Nội dung:** Gợi ý hoàn thành lệnh/thanh ghi/directive/rounding-mode/fence-operand; tự phát hiện nhãn & .eqv; tô màu cú pháp RISC-V trên CodeMirror.
- **Nguồn:** `src/js/editor_hint.js`; `src/js/javascript.js` (định nghĩa mode CodeMirror).
- **Hình/bảng:** *Hình 4.2* – Minh họa gợi ý cú pháp trong editor.
- **Trang:** ~0.5.

### 4.2. Bộ xử lý CPU RV32IMF — *~6 trang*

#### 4.2.1. Tổ chức thanh ghi và trạng thái
- **Nội dung:** Int32Array(32) cho x0–x31, Float32Array(32) cho f0–f31, PC; bộ đếm lệnh, giới hạn maxSteps; trạng thái chờ fetch/response.
- **Nguồn:** `src/js/cpu.js`.
- **Hình/bảng:** **Hình 4.3 – Kiến trúc CPU/RV32IMF** *(hình bắt buộc #3)* (khối fetch–decode–execute, register file số nguyên/số thực, cổng tới MMU/bus).
- **Trang:** ~1.5.

#### 4.2.2. Chu trình fetch–decode–execute và truy cập bộ nhớ bất đồng bộ
- **Nội dung:** `tick()` tổ chức fetch→decode→execute; mô hình bất đồng bộ request/response qua TileLink (load/store phát yêu cầu rồi chờ, "replay" khi có response); PC không tăng tới khi hoàn tất.
- **Nguồn:** `src/js/cpu.js` (`decode`, `execute`, `tick`, `receiveResponse`).
- **Hình/bảng:** *Hình 4.4* – Máy trạng thái truy cập bộ nhớ của CPU (request → wait → response → replay).
- **Trang:** ~2.

#### 4.2.3. Thực thi các nhóm lệnh I/M/F
- **Nội dung:** Cách hiện thực ALU số nguyên, nhân/chia (BigInt cho phần cao), nhóm F (Float32Array + DataView + Math.*), FCLASS 10 lớp, FCVT theo rounding RNE/RTZ. ⚠️ Nêu giới hạn IEEE 754/fcsr.
- **Nguồn:** `src/js/cpu.js`.
- **Hình/bảng:** không (tham chiếu Bảng 2.2/2.3).
- **Trang:** ~1.5.

#### 4.2.4. Xử lý syscall và điều khiển MMU
- **Nội dung:** ECALL với a7 = mã syscall (1 print-int, 4 print-string, 64 write-fd, 93 exit, 0 halt) và 100/101/102 điều khiển MMU map/unmap/clear; tương tác với UART/console.
- **Nguồn:** `src/js/cpu.js` (`handleSyscall`); `src/js/javascript.js` (callback I/O).
- **Hình/bảng:** **Bảng 4.4** – Danh sách syscall hỗ trợ (mã, tham số, hành vi).
- **Trang:** ~1.

### 4.3. Hệ thống bộ nhớ — *~5 trang*

#### 4.3.1. Bộ nhớ chính (Main Memory)
- **Nội dung:** Lưu trữ thưa byte-addressed; mô hình latency (mặc định 20 chu kỳ trong SoC); đáp ứng theo beat 4 byte cho burst/refill; directRead/directWrite.
- **Nguồn:** `src/js/mem.js`; `src/js/soc.js` (mainMemoryLatency).
- **Hình/bảng:** không.
- **Trang:** ~1.

#### 4.3.2. Đơn vị quản lý bộ nhớ MMU/TLB
- **Nội dung:** Kích thước trang 4096B; bảng trang dạng Map; TLB set-associative (mặc định 8 entry, 4 way, 2 set, LRU); quyền R/W/X; predicate cacheable; identity-mapping fallback; thống kê & lịch sử dịch (32 mục).
- **Nguồn:** `src/js/mmu.js`.
- **Hình/bảng:** *Hình 4.5* – Cấu trúc MMU: bảng trang + TLB + đường dịch địa chỉ. **Bảng 4.5** – Cấu hình MMU (page size, TLB, quyền, thống kê).
- **Trang:** ~2.

#### 4.3.3. Phân cấp cache L1I/L1D/L2
- **Nội dung:** L1I/L1D (16 set × 4 way × 64B = 4KB, hit 1/miss 5); L2 (64 set × 4 way × 64B = 16KB, hit 2/miss 10); write-through, LRU, refill 16 beat × 4B; bypass MMIO; thống kê hit/miss.
- **Nguồn:** `src/js/SimpleCache.js`; `src/js/soc.js` (CacheConfigL1/L2).
- **Hình/bảng:** *Hình 4.6* – Phân cấp cache trong SoC. **Bảng 4.6** – Cấu hình L1I/L1D/L2 (set/way/block/latency/size).
- **Trang:** ~2.

### 4.4. Hệ thống bus TileLink — *~6 trang*

#### 4.4.1. Lõi TileLink: opcode, mask, snapshot kênh A/D
- **Nội dung:** Định nghĩa TL_A_Opcode/TL_D_Opcode và giá trị số; tham số atomic/logical; computeTileLinkMask; helper read/write/atomic; snapshot kênh A/D phục vụ trực quan.
- **Nguồn:** `src/js/tilelink.js`.
- **Hình/bảng:** *Hình 4.7* – Cấu trúc một giao dịch kênh A→D. (tham chiếu Bảng 2.5 opcode).
- **Trang:** ~1.5.

#### 4.4.2. Định tuyến master/slave và mô hình giao dịch
- **Nội dung:** Hàng đợi request/response, một giao dịch in-flight; registry master/slave; chọn slave theo địa chỉ (match); trả response về đúng master; helper directRead/Write/peek/poke. ⚠️ Mô tả "đa master" ở mức CPU+DMA cùng phát request; arbitration hiện là hàng đợi/in-flight đơn (nêu trung thực).
- **Nguồn:** `src/js/tilelink_base.js`; `[analysis]` 4.2 & 7.3.
- **Hình/bảng:** **Hình 4.8 – Cấu trúc Bus/TileLink** *(hình bắt buộc #4)* (master/slave, định tuyến theo địa chỉ, hàng đợi).
- **Trang:** ~2.

#### 4.4.3. Hai bus TileLink-UH và TileLink-UL
- **Nội dung:** UH cho phép đủ 6 opcode (gồm Arithmetic/Logical) cho RAM/DMA/bridge; UL cho phép Put/Get/Intent cho ngoại vi; ý nghĩa high-bandwidth vs low-bandwidth. ⚠️ Nêu rõ đây là mô hình transaction-level, không phải coherence đầy đủ.
- **Nguồn:** `src/js/tilelink_UH.js`, `src/js/tilelink_UL.js`.
- **Hình/bảng:** **Bảng 4.7** – Opcode cho phép trên UH vs UL.
- **Trang:** ~1.

#### 4.4.4. Cầu nối UH↔UL (bridge)
- **Nội dung:** Bridge nhận request từ bus này, thực hiện directRead/Write sang bus kia (kể cả atomic read-modify-write), sinh response phù hợp; vai trò nối bus hiệu năng cao với bus ngoại vi.
- **Nguồn:** `src/js/tilelink_bridge.js`.
- **Hình/bảng:** *Hình 4.9* – Luồng giao dịch qua bridge UH↔UL.
- **Trang:** ~1.5.

### 4.5. Bộ điều khiển DMA — *~4 trang*
- **Nội dung:** Cấu trúc DMADescriptor (sourceAddr, destAddr, configWord với numElements/bswap/srcMode/dstMode); thanh ghi CTRL (0xFFED0000) & DESC (0xFFED0004) cùng các bit enable/start/busy/done/error/fifo; FIFO descriptor sâu 8; các chế độ địa chỉ (cố định/tăng); byte-swap; mô hình truyền từng phần tử (read→latch→write); DMA là master trên UH (RAM) và UL (ngoại vi). ⚠️ Hoàn tất bằng polling, chưa có IRQ tới CPU.
- **Nguồn:** `src/js/dma.js`; `src/js/soc.js`; `[analysis]` 4.2 & 7.4.
- **Hình/bảng:** **Hình 4.10 – Quy trình DMA** *(hình bắt buộc #5)* (descriptor → FIFO → read source → write dest → done). **Bảng 4.8** – Bản đồ thanh ghi DMA (CTRL/DESC, bit field, ý nghĩa).
- **Trang:** ~4.

### 4.6. Hệ thống ngoại vi và MMIO — *~5 trang*

#### 4.6.1. Tổng quan kiến trúc ngoại vi
- **Nội dung:** Bốn ngoại vi gắn TileLink-UL; cơ chế endpoint MMIO; cách `javascript.js` nối sự kiện UI (bàn phím/chuột/console) vào ngoại vi.
- **Nguồn:** `src/js/soc.js`; `src/js/javascript.js`.
- **Hình/bảng:** **Hình 4.11 – Kiến trúc ngoại vi** *(hình bắt buộc #6)* (UL → UART/LED/Keyboard/Mouse + đường sự kiện từ UI). **Bảng 4.9 – Danh sách ngoại vi hỗ trợ** *(bảng bắt buộc #5)* (tên, base, kích thước, mô tả).
- **Trang:** ~1.5.

#### 4.6.2. UART
- **Nội dung:** Thanh ghi TX/RX/STATUS/CTRL/BAUD (base 0x10000000, range 0x14); cờ TX-ready/RX-valid; bit cho phép ngắt (chỉ ở mức cờ); mô hình baud/divisor. ⚠️ Số liệu clock/baud cụ thể cần đối chiếu lại trong `uart.js`.
- **Nguồn:** `src/js/uart.js`; demo `test/uart_test.asm`, `test/uart_baud_test.asm`, `test/uart_divisor_examples.asm`.
- **Hình/bảng:** **Bảng 4.10** – Bản đồ thanh ghi UART.
- **Trang:** ~1.5.

#### 4.6.3. Ma trận LED
- **Nội dung:** 32×32, VRAM Uint32Array (4096B, base 0xFF000000), định dạng 0x00RRGGBB; ánh xạ offset→pixel→tọa độ; vẽ Canvas (glow), cập nhật từng pixel.
- **Nguồn:** `src/js/led_matrix.js`; demo `test/led_demo.asm`, `test/dma_led_demo.asm`.
- **Hình/bảng:** *Hình 4.12* – Ánh xạ bộ nhớ VRAM → điểm ảnh LED.
- **Trang:** ~1.

#### 4.6.4. Bàn phím và chuột
- **Nội dung:** Keyboard (base 0xFFFF0000, CTRL/DATA, buffer FIFO, đọc DATA lấy ký tự, theo quy ước RARS); Mouse (base 0xFF100000, X/Y/BTN/STATUS/CTRL, sự kiện từ pointer trên canvas LED).
- **Nguồn:** `src/js/keyboard.js`, `src/js/mouse.js`; demo `test/test_keyboard.asm`, `test/mouse_demo.asm`.
- **Hình/bảng:** **Bảng 4.11** – Bản đồ thanh ghi Keyboard & Mouse.
- **Trang:** ~1.

> ⚠️ **CAN:** Đề cương có nêu CAN như mục tiêu ngoại vi, nhưng **không có module/source CAN** trong mã. Không viết là đã hiện thực. Nếu cần, chỉ nhắc trong "hướng phát triển" (Chương 6).

### 4.7. Trực quan hóa và gỡ lỗi — *~3 trang*

#### 4.7.1. Sơ đồ SoC động
- **Nội dung:** Node/edge của sơ đồ; render SVG (viewBox, định tuyến orthogonal); hiệu ứng pulse khi có giao dịch (đọc/ghi), tooltip trạng thái (PC, hit-rate…).
- **Nguồn:** `src/js/soc_diagram.js`; `src/js/javascript.js` (renderSocView).
- **Hình/bảng:** *Hình 4.13* – View sơ đồ SoC với highlight giao dịch.
- **Trang:** ~1.5.

#### 4.7.2. Nhật ký hệ thống (system log) và các view trạng thái
- **Nội dung:** Phân loại log theo 9 nhóm (cpu/mmu/cache/tilelink/dma/memory/io/system/other), bắt console, lọc theo module/level/search, phân trang hiệu năng; view MMU (bảng trang/TLB/history) và Cache (L1I/L1D/L2).
- **Nguồn:** `src/js/system_log_bootstrap.js`; `src/js/javascript.js` (renderMMUView/renderCacheView, log filters); `src/index.html`.
- **Hình/bảng:** *Hình 4.14* – Terminal log có bộ lọc theo module. **Bảng 4.12** – Các nhóm log và tiêu chí phân loại.
- **Trang:** ~1.5.

### 4.8. Vòng điều khiển thực thi trên UI — *~1.5 trang*
- **Nội dung:** handleAssemble/handleRun/Pause/Stop/Step/Reset; runLoop theo requestAnimationFrame, số chu kỳ/khung theo thanh tốc độ; breakpoint; đo IPS; cập nhật UI có tô sáng thay đổi.
- **Nguồn:** `src/js/javascript.js`.
- **Hình/bảng:** *Hình 4.15* – Sơ đồ vòng lặp chạy mô phỏng trên trình duyệt.
- **Trang:** ~1.5.

---

## CHƯƠNG 5. KIỂM THỬ VÀ ĐÁNH GIÁ — *~15–18 trang*

### 5.1. Phương pháp và môi trường kiểm thử — *~2.5 trang*
- **Nội dung:** Chiến lược nhiều lớp: (1) unit test cục bộ bằng Node.js; (2) đối chiếu encoding với GNU binutils; (3) đối chiếu thực thi với Spike trên riscv-tests; (4) kiểm thử tích hợp bằng chương trình demo; môi trường (Node.js, GNU RISC-V toolchain, Spike, riscv-tests, ISA RV32IMF_zicclsm).
- **Nguồn:** `test/README_rv32imf_verification.md`; `verification_plan.docx`; `README.md`.
- **Hình/bảng:** **Hình 5.1 – Quy trình kiểm thử** *(hình bắt buộc #8)* (4 lớp test → tiêu chí pass).
- **Trang:** ~2.5.

### 5.2. Kiểm thử đơn vị các module — *~3 trang*
- **Nội dung:** Mô tả & kết quả các script: assembler_verify, asm_programs_verify, mmu_basic_verify, tilelink_verify, dma_verify, syscall_output_verify, mmu_syscall_verify, log_filter_verify; nội dung kiểm tra và trạng thái pass.
- **Nguồn:** `test/*_verify.mjs`; `[analysis]` mục 4.6 (các script đã chạy pass).
- **Hình/bảng:** **Bảng 5.1 – Danh sách test case** *(bảng bắt buộc #6)* (tên script, mục tiêu, đầu vào, kỳ vọng, kết quả).
- **Trang:** ~3.

### 5.3. Đối chiếu encoding với GNU binutils — *~2 trang*
- **Nội dung:** Quy trình disassemble ELF riscv-tests (rv32ui/um/uf) → assemble lại bằng assembler dự án → so khớp word 32-bit; phân loại checked/skipped (CSR/privileged là skipped). ⚠️ Cần log chính thức: số instruction checked/skipped, có/không mismatch.
- **Nguồn:** `test/verify_rv32imf_against_gnu.mjs`; `test/README_rv32imf_verification.md`.
- **Hình/bảng:** **Bảng 5.2** – Kết quả đối chiếu encoding theo nhóm (rv32ui/um/uf): #checked, #skipped, #mismatch.
- **Trang:** ~2.

### 5.4. Đối chiếu thực thi với Spike trên riscv-tests — *~2 trang*
- **Nội dung:** Chạy ELF rv32ui-p-*/um/uf trên Spike (RV32IMF_zicclsm), xác nhận pass theo cơ chế riscv-tests; lý do bật zicclsm (ma_data). ⚠️ Cần log chính thức + phiên bản toolchain/Spike + commit riscv-tests.
- **Nguồn:** `test/verify_riscv_tests_spike.mjs`; `test/README_rv32imf_verification.md`.
- **Hình/bảng:** **Bảng 5.3 – Kết quả đối chiếu với simulator tham chiếu (Spike)** *(bảng bắt buộc #7)* (nhóm test, #chạy, #pass, #fail).
- **Trang:** ~2.

### 5.5. Kiểm thử tích hợp qua chương trình demo — *~3.5 trang*
- **Nội dung:** Chạy các demo end-to-end và mô tả kết quả quan sát: bus_demo, demo_uart, dma_demo, dma_led_demo, led_demo, mmu_syscall_test, mouse_demo, test_cache, test_fpu, test_keyboard, soc_full_demo. Mỗi demo: mục tiêu, ngoại vi/khối liên quan, kết quả mong đợi + ảnh chụp.
- **Nguồn:** `test/*.asm`; `test/run_demo.mjs`, `test/mmu_demo.mjs`; `screenshot.png`.
- **Hình/bảng:** *Hình 5.2–5.5* – Ảnh chụp kết quả demo tiêu biểu (UART console, LED matrix, DMA→LED, FPU). **Bảng 5.4** – Danh sách demo và kết quả. ⚠️ Cần SV chọn demo chính + cung cấp ảnh/video.
- **Trang:** ~3.5.

### 5.6. Đánh giá hiệu năng — *~2 trang*
- **Nội dung:** Số liệu từ thống kê có sẵn trong simulator: tỉ lệ hit/miss cache (L1/L2), số chu kỳ, IPS; so sánh CPU-copy vs DMA-copy; ảnh hưởng latency bus/bộ nhớ. ⚠️ Hiện chưa có bộ benchmark riêng — cần quyết định bổ sung số liệu định lượng (đo trước/sau cache, DMA).
- **Nguồn:** thống kê trong `src/js/SimpleCache.js`, `mmu.js`, `soc.js`; ⚠️ `[analysis]` 4.6 & 7.6.
- **Hình/bảng:** **Bảng 5.5** – Số liệu hiệu năng (hit-rate, cycles, IPS, DMA vs CPU). *Hình 5.6* – Biểu đồ so sánh CPU-copy vs DMA-copy (nếu có số liệu).
- **Trang:** ~2.

### 5.7. So sánh với công cụ tham chiếu và đề tài khóa trước — *~1.5 trang*
- **Nội dung:** Thảo luận bảng so sánh tổng hợp (đặt Bảng 1.1 ở Chương 1, nhắc lại/diễn giải ở đây): điểm vượt trội so với MARS/Interpreter/WebRISC-V/Spike và mở rộng so với KLTN khóa trước (RV32M, RV32F/FPU, ngoại vi keyboard/mouse, trực quan hóa, kiểm chứng).
- **Nguồn:** `[ref:đề cương]` [1]–[5]; `[ref:Thư viện số]`; `[analysis]`.
- **Hình/bảng:** tham chiếu **Bảng 1.1**.
- **Trang:** ~1.5.

### 5.8. Thảo luận hạn chế phát hiện qua kiểm thử — *~1 trang*
- **Nội dung:** Tổng hợp giới hạn: subset RV32IMF (CSR/FCSR/FENCE), TileLink A/D-only, arbitration đơn, chưa IRQ, hiệu năng đơn luồng. ⚠️ Trình bày trung thực theo `[analysis]` mục 7.
- **Nguồn:** `[analysis]` mục 7.
- **Hình/bảng:** không.
- **Trang:** ~1.

---

## CHƯƠNG 6. KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN — *~4–6 trang*

### 6.1. Kết luận — *~2 trang*
- **Nội dung:** Tóm tắt kết quả đạt được theo 4 mục tiêu kỹ thuật; khẳng định đã xây dựng được trình mô phỏng SoC RISC-V RV32IMF + TileLink chạy Web với assembler, CPU, MMU/cache, bus UH/UL, DMA, 4 ngoại vi, trực quan hóa và kiểm chứng.
- **Nguồn:** Chương 4–5; `[ref:đề cương]` (mục tiêu).
- **Trang:** ~2.

### 6.2. Hạn chế — *~1 trang*
- **Nội dung:** Liệt kê hạn chế còn lại (subset ISA, mức transaction TileLink, chưa IRQ/interrupt controller, chưa benchmark định lượng đầy đủ, hiệu năng đơn luồng).
- **Nguồn:** `[analysis]` mục 7.
- **Trang:** ~1.

### 6.3. Hướng phát triển — *~1.5 trang*
- **Nội dung:** Bổ sung CSR/privileged, FCSR/làm tròn động, thực thi FENCE; mở rộng TileLink B/C/E + coherence; arbitration đa master thực sự; interrupt controller + IRQ (UART/DMA/keyboard); thêm ngoại vi (CAN…); benchmark định lượng; bài lab giảng dạy.
- **Nguồn:** `[analysis]` mục 7–8; `[ref:đề cương]` (CAN).
- **Trang:** ~1.5.

---

## TÀI LIỆU THAM KHẢO (chuẩn IEEE) — *~2–3 trang*

Danh sách dự kiến (đánh số IEEE `[n]`):
- [1] MARS – Missouri State (URL trong đề cương).
- [2] RISC-V Interpreter – Cornell (URL).
- [3] WebRISC-V (URL).
- [4] M. B. Petersen, *Ripes* (GitHub).
- [5] *riscv-isa-sim (Spike)* – RISC-V Software (GitHub).
- [6] *The RISC-V Instruction Set Manual, Volume I: Unprivileged ISA* (⚠️ cần bổ sung – chưa có trong `docs/ref`).
- [7] SiFive/RISC-V, *TileLink Specification 1.8.1* → `[ref:tilelink_spec_1.8.1.pdf]`.
- [8] *IEEE 754 Standard for Floating-Point Arithmetic* (⚠️ cần bổ sung citation).
- [9] N. G. B. Ngọc, *Phát triển trình mô phỏng SoC*, KLTN, ĐH CNTT – ĐHQG-HCM, 2025 → `[ref:Thư viện số - Quản lý tài nguyên số]`.
- [10] *riscv-tests* (GitHub) – bộ test rv32ui/um/uf.
- (Bổ sung) GNU binutils / riscv-gnu-toolchain; CodeMirror; tài liệu RARS (quy ước keyboard MMIO).

**Nguồn:** `[ref:đề cương]` (đã có [1]–[5] kèm URL); `test/README_rv32imf_verification.md` (Spike/binutils/riscv-tests).
**Ghi chú:** ⚠️ `[analysis]` 7.8 – cần bổ sung citation chính thức cho RISC-V ISA spec và IEEE 754.

---

## PHỤ LỤC — *~6–12 trang*

- **Phụ lục A – Bảng lệnh RV32IMF chi tiết + encoding:** đầy đủ opcode/funct3/funct7/định dạng cho từng lệnh. Nguồn: `src/js/assembler.js`, `src/js/cpu.js`. (~3 trang)
- **Phụ lục B – Bản đồ thanh ghi ngoại vi đầy đủ:** UART/LED/Keyboard/Mouse/DMA (offset + bit field). Nguồn: `src/js/uart.js`, `led_matrix.js`, `keyboard.js`, `mouse.js`, `dma.js`. (~2 trang)
- **Phụ lục C – Mã nguồn chương trình demo tiêu biểu:** ví dụ `soc_full_demo.asm`, `dma_led_demo.asm`, `test_fpu.asm`. Nguồn: `test/*.asm`. (~2–3 trang)
- **Phụ lục D – Hướng dẫn cài đặt & chạy:** chạy web cục bộ (http.server), build riscv-tests, chạy script verification. Nguồn: `README.md`, `test/README_rv32imf_verification.md`. (~1–2 trang)
- **Phụ lục E – Log kết quả verification (đầy đủ):** output chi tiết GNU/Spike. ⚠️ Cần SV cung cấp log chạy chính thức. (~1–2 trang)

---

## DANH SÁCH HÌNH (đề xuất)

> Tô đậm = hình **bắt buộc** theo yêu cầu đề bài. Đánh số theo chương; có thể tách/gộp khi viết.

| Mã | Tên hình | Chương | Nguồn |
|---|---|---|---|
| Hình 1.1 | Minh họa ý niệm SoC tổng quát | 1 | `[ref:SoC.png]` |
| Hình 2.1 | Sơ đồ khối SoC điển hình | 2 | lý thuyết SoC |
| Hình 2.2 | Các định dạng lệnh RISC-V (R/I/S/B/U/J) | 2 | `assembler.js`, ISA spec |
| Hình 2.3 | Cơ chế dịch địa chỉ VA→PA (TLB + bảng trang) | 2 | `mmu.js`, lý thuyết |
| Hình 2.4 | Tổ chức cache set-associative | 2 | `SimpleCache.js`, lý thuyết |
| Hình 2.5 | Mô hình kênh A/D giữa master–slave TileLink | 2 | `[ref:tilelink_spec]` |
| Hình 2.6 | Luồng dữ liệu CPU-copy vs DMA-copy | 2 | lý thuyết DMA |
| **Hình 3.2** | **Kiến trúc tổng quan SoC Simulator** ⭐ | 3 | `soc.js`, `soc_diagram.js`, `[ref:SoC.png]` |
| Hình 3.1 | Sơ đồ use case tổng quát | 3 | `README.md`, `index.html` |
| Hình 3.3 | Trình tự tick một chu kỳ qua các module | 3 | `soc.js` |
| Hình 3.4 | Mô hình cổng kết nối (Port) giữa hai module | 3 | `port_link.js` |
| **Hình 3.5** | **Giao diện web tổng quan** ⭐ | 3 | `index.html`, `screenshot.png` |
| Hình 3.6 | Các khung quan sát thanh ghi/bộ nhớ | 3 | `index.html` |
| **Hình 3.7** | **Luồng thực thi chương trình assembly** ⭐ | 3 | `javascript.js`, `assembler.js`, `cpu.js` |
| Hình 4.1 | Sơ đồ assembler hai lượt | 4 | `assembler.js` |
| Hình 4.2 | Gợi ý cú pháp trong editor | 4 | `editor_hint.js` |
| **Hình 4.3** | **Kiến trúc CPU/RV32IMF** ⭐ | 4 | `cpu.js` |
| Hình 4.4 | Máy trạng thái truy cập bộ nhớ của CPU | 4 | `cpu.js` |
| Hình 4.5 | Cấu trúc MMU: bảng trang + TLB | 4 | `mmu.js` |
| Hình 4.6 | Phân cấp cache L1I/L1D/L2 | 4 | `SimpleCache.js`, `soc.js` |
| Hình 4.7 | Cấu trúc một giao dịch kênh A→D | 4 | `tilelink.js` |
| **Hình 4.8** | **Cấu trúc Bus/TileLink** ⭐ | 4 | `tilelink_base.js` |
| Hình 4.9 | Luồng giao dịch qua bridge UH↔UL | 4 | `tilelink_bridge.js` |
| **Hình 4.10** | **Quy trình DMA** ⭐ | 4 | `dma.js`, `soc.js` |
| **Hình 4.11** | **Kiến trúc ngoại vi** ⭐ | 4 | `soc.js`, `javascript.js` |
| Hình 4.12 | Ánh xạ VRAM → điểm ảnh LED | 4 | `led_matrix.js` |
| Hình 4.13 | View sơ đồ SoC với highlight giao dịch | 4 | `soc_diagram.js` |
| Hình 4.14 | Terminal log có bộ lọc theo module | 4 | `system_log_bootstrap.js` |
| Hình 4.15 | Vòng lặp chạy mô phỏng trên trình duyệt | 4 | `javascript.js` |
| **Hình 5.1** | **Quy trình kiểm thử** ⭐ | 5 | `test/README_rv32imf_verification.md` |
| Hình 5.2–5.5 | Ảnh kết quả demo (UART/LED/DMA-LED/FPU) | 5 | `test/*.asm`, `screenshot.png` |
| Hình 5.6 | Biểu đồ CPU-copy vs DMA-copy (nếu có số liệu) | 5 | thống kê simulator |

➡️ Tổng ~32 hình (8 hình bắt buộc ⭐ đã bao phủ đủ yêu cầu).

---

## DANH SÁCH BẢNG (đề xuất)

> Tô đậm = bảng **bắt buộc** theo yêu cầu đề bài.

| Mã | Tên bảng | Chương | Nguồn |
|---|---|---|---|
| **Bảng 1.1** | **So sánh chức năng: MARS / RISC-V Interpreter / WebRISC-V / Spike / KLTN khóa trước (Bảo Ngọc) / Đề tài này** ⭐ | 1 | `[ref:đề cương]`, `[ref:Thư viện số]`, `[analysis]` |
| Bảng 1.2 | Phạm vi chức năng: đã hỗ trợ / một phần / ngoài phạm vi | 1 | `[analysis]` 4,7 |
| Bảng 1.3 | Phân công công việc & tiến độ | 1 | `[ref:đề cương]` ⚠️ |
| Bảng 2.1 | Các mở rộng RISC-V và phạm vi đề tài | 2 | ISA spec |
| Bảng 2.2 | Danh sách nhóm lệnh RV32I | 2 | `cpu.js`, `assembler.js` |
| **Bảng 2.3** | **Danh sách nhóm lệnh RV32M & RV32F hỗ trợ** ⭐ | 2 | `cpu.js`, `assembler.js` |
| Bảng 2.4 | So sánh ba cấp độ TileLink (UL/UH/C) | 2 | `[ref:tilelink_spec]` |
| Bảng 2.5 | Opcode kênh A & kênh D (tên, mã, ý nghĩa) | 2 | `tilelink.js`, `[ref:tilelink_spec]` |
| **Bảng 3.2** | **Danh sách module hệ thống** ⭐ | 3 | `[analysis]` 3.1,5 |
| Bảng 3.1 | Danh sách yêu cầu chức năng | 3 | `README.md` |
| **Bảng 3.3** | **Bản đồ địa chỉ bộ nhớ (memory map)** ⭐ | 3 | `soc.js` |
| Bảng 3.4 | Danh sách 7 view giao diện | 3 | `index.html` |
| Bảng 4.1 | Danh sách directive assembler | 4 | `assembler.js` |
| Bảng 4.2 | Pseudo-instruction và khai triển | 4 | `assembler.js` |
| Bảng 4.3 | Ánh xạ thanh ghi ABI (x0–x31, f0–f31) | 4 | `assembler.js`, `editor_hint.js` |
| Bảng 4.4 | Danh sách syscall hỗ trợ | 4 | `cpu.js` |
| Bảng 4.5 | Cấu hình MMU (page size, TLB, quyền) | 4 | `mmu.js` |
| Bảng 4.6 | Cấu hình L1I/L1D/L2 | 4 | `SimpleCache.js`, `soc.js` |
| Bảng 4.7 | Opcode cho phép trên UH vs UL | 4 | `tilelink_UH.js`, `tilelink_UL.js` |
| Bảng 4.8 | Bản đồ thanh ghi DMA (CTRL/DESC) | 4 | `dma.js` |
| **Bảng 4.9** | **Danh sách ngoại vi hỗ trợ** ⭐ | 4 | `soc.js`, các file ngoại vi |
| Bảng 4.10 | Bản đồ thanh ghi UART | 4 | `uart.js` |
| Bảng 4.11 | Bản đồ thanh ghi Keyboard & Mouse | 4 | `keyboard.js`, `mouse.js` |
| Bảng 4.12 | Các nhóm log và tiêu chí phân loại | 4 | `system_log_bootstrap.js` |
| **Bảng 5.1** | **Danh sách test case** ⭐ | 5 | `test/*_verify.mjs` |
| Bảng 5.2 | Kết quả đối chiếu encoding (rv32ui/um/uf) | 5 | `verify_rv32imf_against_gnu.mjs` ⚠️ |
| **Bảng 5.3** | **Kết quả đối chiếu với Spike** ⭐ | 5 | `verify_riscv_tests_spike.mjs` ⚠️ |
| Bảng 5.4 | Danh sách demo và kết quả | 5 | `test/*.asm` ⚠️ |
| Bảng 5.5 | Số liệu hiệu năng (hit-rate, cycles, IPS, DMA) | 5 | thống kê simulator ⚠️ |

➡️ Tổng ~28 bảng (7 nhóm bảng bắt buộc ⭐ đã bao phủ đủ yêu cầu).

---

## GHI CHÚ TỔNG HỢP TRƯỚC KHI VIẾT (checklist xác nhận với SV/GVHD)

Tổng hợp từ `00_project_analysis.md` mục 7–8 — cần chốt trước khi viết để báo cáo trung thực:

1. **Phạm vi ISA:** ghi "tập con RV32IMF phục vụ mô phỏng" + liệt kê chưa hỗ trợ (CSR/đặc quyền, FCSR/fflags/frm, thực thi FENCE). RV32A (AMOADD.W) trình bày như mở rộng.
2. **TileLink:** mô tả ở mức transaction A/D (TL-UL/TL-UH), không tuyên bố coherence/conformance đầy đủ (không B/C/E).
3. **Đa master & arbitration:** mô tả trung thực (CPU+DMA cùng phát request; hàng đợi/in-flight đơn).
4. **Interrupt:** chưa có IRQ tới CPU — chỉ polling (UART/DMA/keyboard ở mức cờ).
5. **CAN:** không có trong source — chỉ để ở "hướng phát triển".
6. **Số liệu verification chính thức:** cần log của `verify_rv32imf_against_gnu.mjs`, `verify_riscv_tests_spike.mjs` (số checked/skipped/pass/fail; phiên bản toolchain/Spike; commit riscv-tests).
7. **Hiệu năng:** quyết định có bổ sung benchmark định lượng (cache trước/sau, DMA vs CPU) hay chỉ dùng thống kê sẵn có.
8. **Citation:** bổ sung RISC-V ISA spec và IEEE 754 vào tài liệu tham khảo.
9. **Phân công:** chốt phần việc của Lộc/Khang cho Bảng 1.3.
10. **KLTN khóa trước:** đọc toàn văn `[ref:Thư viện số - Quản lý tài nguyên số]` để hoàn thiện Bảng 1.1 (hiện chỉ trích được mục lục + danh mục viết tắt: RV32I + Zaamo/atomic, MMU kiểu SATP/PTE, TileLink TL-UL/UH/C, DMA, LED — chưa thấy RV32M/RV32F).
11. **Triển khai web:** xác minh URL `https://risc-v.vercel.app` còn hoạt động nếu đưa vào báo cáo.
