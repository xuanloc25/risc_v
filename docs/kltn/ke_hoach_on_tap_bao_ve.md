# Kế hoạch kiểm tra hệ thống & ôn tập bảo vệ KLTN

> Lập ngày 11/06/2026. Bám theo rubric chấm điểm: **LO3 (2đ, 20%) · LO4 (4đ, 40%) · LO5 (3đ, 30%) · LO7 (1đ, 10%)**.
> Nguyên tắc phân bổ công sức: theo trọng số điểm — LO4 và LO5 chiếm 70% tổng điểm.

---

## HIỆN TRẠNG (snapshot 11/06/2026)

| Hạng mục | Tình trạng |
|---|---|
| Test tự động (16 script `test/*_verify.mjs`) | ✅ **16/16 PASS** (chạy lại 11/06) |
| Đối chiếu GNU binutils (Ch5) | ✅ 17.978 lệnh khớp / 0 mismatch / 61 ELF |
| Báo cáo (abstract + Ch1–Ch6) | ⚠️ Đã viết xong, còn **6 việc phải sửa** theo `review_checklist_result.md` |
| Slides bảo vệ chính | ❌ **Chưa có** (mới chỉ có `slides/bao_cao_CAN.pptx` báo cáo tiến độ CAN) |
| Kịch bản demo bảo vệ | ❌ Chưa soạn chính thức |
| Ôn tập Q&A | ❌ Chưa hệ thống hóa |

**Rủi ro lớn nhất xếp theo điểm:** (1) Slides chưa làm — mất trực tiếp 1/3 của LO5;
(2) Demo không có kịch bản — "kịch bản đánh giá, trình bày kết quả rõ ràng" là 1/3 của LO4;
(3) Báo cáo thiếu mục bắt buộc (phân công, phụ lục) — vừa trừ LO5 vừa trừ LO7.

---

## GIAI ĐOẠN 1 — Kiểm tra lại toàn hệ thống (phục vụ LO4: "hoàn thiện sản phẩm demo")

### 1.1. Test tự động (đã xanh — duy trì)
- [x] 16/16 script verify pass (11/06/2026)
- [ ] Chạy lại toàn bộ 16 script vào **ngày trước bảo vệ** (lệnh: `node test/<tên>.mjs`)
- [ ] Nếu máy có toolchain: chạy `verify_rv32imf_against_gnu.mjs` + `verify_riscv_tests_spike.mjs` lấy số liệu tươi; nếu không, dùng số liệu đã ghi trong Ch5 (ghi rõ ngày chạy)
- [ ] Ghi lại output các lần chạy (screenshot/log) làm bằng chứng đưa vào slides phần đánh giá

### 1.2. Smoke test giao diện web (thủ công, ~1 buổi)
Chạy qua HTTP server (không mở file trực tiếp — project dùng JS module):
- [ ] Soạn thảo + autocomplete hoạt động; assemble báo lỗi đúng dòng khi cố tình gõ sai
- [ ] Chạy từng bước / chạy liên tục / reset — thanh ghi, bộ nhớ, PC cập nhật đúng
- [ ] Lần lượt nạp **từng chương trình demo** trong `test/*.asm`: `led_demo`, `dma_demo`, `dma_led_demo`, `bus_demo`, `soc_full_demo`, `can_loopback`, `demo_uart`, `demo_uart_dma`, `demo_uart_input`, `uart_baud_test`, `mouse_demo`, `test_keyboard`, `test_cache`, `test_fpu`, `mmu_test`, `mmu_syscall_test` — mỗi cái chạy đến hết, quan sát đúng hành vi mô tả
- [ ] Panel log: filter theo nguồn (CPU/DMA/MMU/CAN/UART) hoạt động; log MMU hiển thị đúng src/FAULT như đã trim
- [ ] Khu vực SoC view: LED/VRAM, UART console, CAN mailbox hiển thị đúng
- [ ] Test trên **đúng máy sẽ mang đi bảo vệ** + thử độ phân giải máy chiếu (1024×768/1280×720) — giao diện không vỡ

### 1.3. Kịch bản demo bảo vệ (LO4 — "kịch bản đánh giá rõ ràng")
- [ ] Chọn **2–3 demo** phủ rộng nhất, gợi ý:
  1. `soc_full_demo.asm` — thấy toàn hệ: CPU → bus TileLink → ngoại vi (câu chuyện tổng thể)
  2. `demo_uart_dma.asm` — DMA + UART + backpressure (điểm kỹ thuật sâu nhất, có cải tiến burst/latency)
  3. `can_loopback.asm` hoặc `mmu_test.asm` — tùy hội đồng hỏi sâu hướng nào
- [ ] Viết kịch bản từng bước cho mỗi demo: mở file nào → bấm gì → chỉ vào đâu trên màn hình → nói câu gì (1 trang/demo)
- [ ] Bấm giờ: tổng demo ≤ 5 phút trong buổi bảo vệ
- [ ] **Phương án dự phòng:** quay video từng demo + chụp screenshot kết quả, để sẵn trong slides phụ lục (đề phòng máy/mạng trục trặc)

---

## GIAI ĐOẠN 2 — Hoàn thiện báo cáo (LO5: "báo cáo theo mẫu" + LO3: "tài liệu tham khảo đầy đủ" + LO7)

Sửa 6 việc trong `review_checklist_result.md` (mục "Top việc PHẢI sửa"), thứ tự ưu tiên:
- [ ] **(1) Mục "Phân công công việc" Lộc/Khang + Bảng 1.3** vào Ch1 — *việc này đồng thời là bằng chứng trực tiếp cho LO7 (lập kế hoạch, tổ chức, quản lý). Nên kèm bảng tiến độ theo tuần/giai đoạn.*
- [ ] **(2) Phụ lục A–E + Danh mục từ viết tắt** (Ch4 §4.1.3 đã trỏ "Phụ lục A" — đang treo)
- [ ] **(3) Thống nhất chỉ số IPS** giữa Ch3 §3.4.1 và Ch4 §4.8 (instructions/sec vs cycles/sec)
- [ ] **(4) Ch3: thêm câu dẫn cho Hình 3.1, 3.3–3.7** (tránh hình mồ côi)
- [ ] **(5) Bỏ tham chiếu "mục 7 trong phân tích phạm vi"** trong Ch2 (tài liệu nội bộ) → trỏ về §1.3.2/§6.2
- [ ] **(6) Đối chiếu Bảng 4.8 (DMA)** bit 2 vs bit 30 cùng nhãn "done" với `src/js/dma.js`
- [ ] Rà các lỗi mức Trung bình/Nhẹ còn lại trong checklist (viết tắt lần đầu, bảng không số, câu dài)
- [ ] Kiểm tra danh mục tài liệu tham khảo: đủ, đúng IEEE, đánh số tăng dần, mọi [n] trong thân bài đều có trong danh mục và ngược lại (LO3)
- [ ] Build lại `KLTN_SoC_Loc_Khang.docx` bằng `_build_body.py`, cập nhật TOC + xuất PDF qua Word COM; đọc soát bản PDF cuối **trên giấy hoặc màn hình khác** ít nhất 1 lượt
- [ ] **Nộp đúng hạn** — rubric ghi rõ: *KLTN gia hạn đạt 0 điểm LO7*

---

## GIAI ĐOẠN 3 — Slides + tập trình bày (LO5, 30% — đang là lỗ hổng lớn nhất)

### 3.1. Làm slides chính (theo mẫu của Khoa/UIT)
Khung gợi ý ~18–22 slide cho 15 phút, bám đúng 3 tiêu chí rubric:
- [ ] 1–2: Bìa (tên đề tài, 2 SV, GVHD) + Nội dung trình bày
- [ ] 3–5: **Bài toán & khảo sát** — vì sao cần SoC simulator chạy web; các công cụ hiện có (RARS, Ripes, QtRvSim...) và hạn chế; kế thừa gì/khác gì KLTN trước (Nguyễn Gia Bảo Ngọc 2025) → *chốt 1 slide "Tính mới & đóng góp"* (LO3)
- [ ] 6–7: Mục tiêu + phạm vi (nêu phạm vi trung thực: RV32IMF subset, TileLink A/D, CAN mức frame... — chủ động nêu trước, đừng để hội đồng "khui")
- [ ] 8–12: **Thiết kế** — kiến trúc tổng thể SoC (fig_3_2), CPU core, MMU, TileLink/bridge, DMA, ngoại vi (UART/CAN/LED/VRAM) — tận dụng SVG có sẵn trong `docs/kltn/figures/` (LO4-thiết kế)
- [ ] 13–14: Hiện thực — giao diện web, quy mô mã nguồn, điểm kỹ thuật nổi bật (burst DMA, backpressure UART, MMU log) (LO4-hiện thực)
- [ ] 15–17: **Kiểm chứng & đánh giá** — bảng 16/16 test pass; 17.978 lệnh khớp GNU binutils (0 mismatch, 61 ELF); đối chiếu Spike; demo plan (LO4-đánh giá)
- [ ] 18: Phân công công việc + tiến độ thực hiện (LO7 — hội đồng chấm được ngay trên slide)
- [ ] 19–20: Kết luận, hạn chế, hướng phát triển + slide cảm ơn
- [ ] Slide phụ lục dự phòng: chi tiết MMU, CAN register map, video demo — chỉ mở khi bị hỏi
- [ ] Quy tắc: ≤ 6 dòng chữ/slide, ưu tiên hình từ `figures/`, font ≥ 20pt, đánh số trang

### 3.2. Tập trình bày
- [ ] Phân vai Lộc/Khang: ai nói phần nào (thường mỗi người ~50%, người nào code phần nào nói phần đó)
- [ ] Tập nói **≥ 3 lần có bấm giờ**, lần cuối tập đủ bộ: slides + demo live + chuyển người
- [ ] Tập trước 1–2 bạn khác nghe và hỏi vặn (mô phỏng hội đồng)
- [ ] Chuẩn bị câu mở/kết thuộc lòng (2 chỗ dễ run nhất)

---

## GIAI ĐOẠN 4 — Ôn tập Q&A (bảo toàn điểm LO3 + LO4 khi bị hỏi)

### 4.1. Thuộc lòng "bất biến trung thực" (đỡ mọi câu hỏi phạm vi)
Trả lời theo công thức: *"Đề tài giới hạn ở X vì mục tiêu giáo dục/thời gian; thiết kế đã chừa chỗ mở rộng tại Y"*:
- RV32IMF **tập con**; chưa có CSR/privileged mode; `fence` mã hóa nhưng không thực thi
- FPU: chưa đủ FCSR/fflags/frm
- TileLink: chỉ kênh **A/D mức giao dịch** (UL+UH), không B/C/E, không TL-C coherence; bus một-giao-dịch, chưa phân xử đa master
- Chưa có IRQ — ngoại vi đọc thăm dò (polling)
- **AMOADD.W**: lệnh RV32A duy nhất, nằm ngoài tên đề tài, giữ nguyên theo thống nhất với GVHD — không nhận là "hỗ trợ RV32A"
- **CAN**: mức frame/message qua MMIO (ID 11-bit, DLC 0–8, loopback); không physical layer/bit stuffing/CRC/ACK/arbitration → lý thuyết giao thức dẫn ISO 11898-1, register map đối chiếu M_CAN manual
- **MMU**: tối giản theo yêu cầu GVHD — không TLB set/way

### 4.2. Câu hỏi dự kiến theo module (mỗi bạn tự viết câu trả lời 3–5 câu, rồi hỏi chéo nhau)
- [ ] **Assembler:** two-pass hoạt động thế nào? Xử lý forward label? Pseudo-instruction (`li`, `call`) mở rộng ra sao? Vì sao đối chiếu với GNU binutils là đáng tin?
- [ ] **CPU:** vòng fetch–decode–execute trong mô hình; state machine CPU–memory; xử lý lệnh F (rounding mode)?
- [ ] **MMU:** đường dịch VA→PA; identity fallback khi nào; page fault xử lý ra sao; vì sao không làm TLB set/way?
- [ ] **Cache:** set-associative, chính sách thay thế; đường cache bypass cho MMIO vì sao cần?
- [ ] **TileLink:** vì sao chọn TileLink mà không phải AXI/Wishbone? UL khác UH chỗ nào (burst)? Bridge UH→UL làm gì? Beat/burst phải power-of-2 vì sao?
- [ ] **DMA:** descriptor chain; FIFO đọc/ghi độc lập; latency mô phỏng; so sánh CPU copy vs DMA copy (fig_2_6)
- [ ] **UART:** baud/divisor; backpressure TX (vì sao mất 65 byte trước đây, sửa bằng `canAccept()` thế nào)
- [ ] **CAN:** mapping thanh ghi với M_CAN; vì sao loopback đủ cho mục tiêu giáo dục
- [ ] **Tổng thể:** vì sao chạy trên web/browser? Hiệu năng mô phỏng (chỉ số gì, đo thế nào)? Khác gì RARS/Ripes/simulator của KLTN trước?

### 4.3. Câu hỏi "vĩ mô" thường gặp của hội đồng
- [ ] "Đóng góp/tính mới của em là gì?" → trả lời 30 giây, có so sánh cụ thể với KLTN 2025 + công cụ hiện có
- [ ] "Ứng dụng thực tế?" → công cụ dạy/học Kiến trúc máy tính & Hệ điều hành, chạy ngay trên browser không cần cài đặt
- [ ] "Nếu có thêm 3 tháng em làm gì?" → lấy từ Ch6 hướng phát triển (IRQ, privileged mode, TL-C...)
- [ ] "Em kiểm chứng tính đúng đắn bằng gì?" → 3 lớp: unit test (16 script) / đối chiếu mã hóa GNU (17.978 lệnh, 0 mismatch) / đối chiếu thực thi Spike
- [ ] "Hai bạn phân công thế nào?" → khớp đúng Bảng 1.3 trong báo cáo (LO7)

---

## LỊCH GỢI Ý (tính ngược từ ngày bảo vệ = D)

| Mốc | Việc |
|---|---|
| **D−14 → D−10** | Giai đoạn 2: sửa 6 lỗi báo cáo, phụ lục, phân công; build docx/PDF; **nộp quyển đúng hạn** |
| **D−10 → D−7** | Giai đoạn 1: smoke test UI toàn bộ demo; chốt 2–3 demo; viết kịch bản demo; quay video dự phòng |
| **D−7 → D−4** | Giai đoạn 3.1: làm slides chính; gửi GVHD góp ý |
| **D−4 → D−2** | Giai đoạn 4: hai bạn hỏi chéo Q&A; sửa slides theo góp ý |
| **D−2 → D−1** | Giai đoạn 3.2: tổng duyệt ≥ 2 lần có bấm giờ + demo live; chạy lại 16 test; chép slides/video/source vào USB + cloud |
| **D** | Đến sớm, test máy chiếu, mở sẵn server demo + slides |

---

## ƯỚC LƯỢNG ĐIỂM THEO RUBRIC — TỰ CHẤM TRƯỚC

| LO | Trọng số | Hiện trạng | Việc quyết định điểm |
|---|---|---|---|
| LO3 | 2đ | Khảo sát/citation tốt (checklist: 0 lỗi nghiêm trọng) | Slide "tính mới" + trả lời Q&A so sánh thuyết phục |
| LO4 | 4đ | Hệ thống chạy, 16/16 test, số liệu kiểm chứng mạnh | Demo mượt + kịch bản đánh giá trình bày rõ trên slides |
| LO5 | 3đ | Báo cáo gần xong; **slides chưa có** | Làm slides theo mẫu + tập trình bày ≥ 3 lần |
| LO7 | 1đ | Chưa có bảng phân công trong Ch1 | Thêm Bảng 1.3 + slide phân công; **nộp đúng hạn** |
