# Nội dung 6 slide — Thiết kế · Hiện thực · Kết quả (phần gộp)

> Soạn 15/06/2026. Mỗi slide gồm: **Hình** (chèn vào) · **Nội dung trên slide** (gõ ngắn, ≤6 dòng) · **Ghi chú thuyết trình** (dán vào ô Notes của Canva/PowerPoint).
> Quy tắc: ≤6 dòng chữ/slide, font ≥20pt, ưu tiên hình. Lời dẫn dài để ở Notes, đừng đưa hết lên slide.
> Hình SVG (fig_3_2, 4_1, 4_3, 4_5, 4_6, 4_7, 4_10) cần **xuất PNG** trước khi chèn; fig_4_13 & fig_4_14 cần **chụp từ app**; fig_5_1 đã có PNG. Bổ trợ cho [ghi_chu_slide_phan_bien.md](ghi_chu_slide_phan_bien.md).

---

## Slide 1 — Thiết kế: Kiến trúc tổng thể SoC
**Hình:** `figures/fig_3_2_soc_simulator_architecture.svg`

**Nội dung trên slide:**
> **Kiến trúc tổng thể hệ thống SoC**
> - 1 truy cập bộ nhớ: CPU → MMU → L1I/L1D → L2 → TileLink-UH → RAM
> - Truy cập ngoại vi: rẽ qua **cầu nối UH→UL** (UART, LED, bàn phím, chuột)
> - **DMA là master** trên cả hai bus — giảm tải CPU
> - Mô phỏng theo chu kỳ; đồng bộ ngoại vi bằng **polling**

**Ghi chú thuyết trình (~45s):**
"Đây là kiến trúc tổng thể, bố cục bốn lớp từ trên xuống: lớp tính toán (CPU và DMA), lớp bộ nhớ–dịch địa chỉ (MMU, cache), lớp bus, và lớp bộ nhớ–ngoại vi. Một truy cập của CPU đi qua MMU để dịch địa chỉ, xuống cache L1 rồi L2, ra bus TileLink-UH tới bộ nhớ chính. Khi truy cập thiết bị ngoại vi, giao dịch rẽ qua cầu nối sang bus TileLink-UL. Điểm đáng chú ý: bộ điều khiển DMA cũng là một master phát yêu cầu trên bus, nên nó vận chuyển dữ liệu song song mà không chiếm CPU. Vì phạm vi đề tài chưa có ngắt nên CPU đồng bộ với thiết bị bằng cách đọc thăm dò trạng thái."
*Nếu bị hỏi "vì sao tách UL và UH?":* UH cho đường bộ nhớ hiệu năng cao (hỗ trợ burst), UL đơn giản cho ngoại vi; cầu nối nối hai miền. *Lưu ý:* bus chỉ ở mức giao dịch kênh A/D — không nói "coherent".

---

## Slide 2 — Hiện thực 1 (lõi): Assembler hai lượt & CPU RV32IMF
**Hình:** `figures/fig_4_1_two_pass_assembler.svg` (trái) + `figures/fig_4_3_rv32imf_cpu_core.svg` (phải)

**Nội dung trên slide:**
> **Trình biên dịch & Lõi xử lý RV32IMF**
> - Assembler **2 lượt**: lượt 1 thu thập nhãn → lượt 2 mã hóa (xử lý nhãn tham chiếu trước)
> - Mở rộng lệnh giả: `li`, `la`, `call`, `ret`…
> - CPU: chu trình **Fetch–Decode–Execute**, 2 tệp thanh ghi (số nguyên + dấu phẩy động)
> - Bảng opcode **dùng chung (`isa.js`)** cho assembler + CPU + tô màu → nhất quán 100%

**Ghi chú thuyết trình (~50s):**
"Bên trái là trình biên dịch hợp ngữ hoạt động hai lượt: lượt một quét mã, dựng bảng nhãn và tính địa chỉ; lượt hai sinh mã máy — nhờ tách hai lượt nên xử lý được cả nhãn tham chiếu tới phía trước. Nó cũng khai triển các lệnh giả như `li`, `la`, `call`. Bên phải là lõi CPU, chạy chu trình nạp – giải mã – thực thi, với hai tệp thanh ghi: số nguyên và dấu phẩy động. Một điểm thiết kế nhóm em tâm đắc là bảng mã lệnh được dùng chung trong một file `isa.js` cho cả assembler, CPU và phần tô màu cú pháp, nên ba nơi luôn nhất quán, sửa một lệnh không bị lệch."
*Phạm vi trung thực:* RV32IMF là **tập con** — chưa có CSR, chế độ đặc quyền, ngắt; `fence` mã hóa nhưng chưa thực thi. *Nếu hỏi "làm sao chắc đúng?":* đối chiếu GNU binutils — trình bày ở slide Kết quả.

---

## Slide 3 — Hiện thực 2 (bộ nhớ): MMU/TLB & Phân cấp cache
**Hình:** `figures/fig_4_5_mmu_translation_path.svg` (trái) + `figures/fig_4_6_cache_hierarchy.svg` (phải)

**Nội dung trên slide:**
> **Quản lý bộ nhớ: MMU/TLB & Cache L1/L2**
> - MMU: VA → PA qua **TLB**; chưa ánh xạ → **identity (VA=PA)**; kiểm tra quyền **R/W/X**
> - Cache: L1I/L1D (16 set×4) + L2 (64 set×4), block 64B, **write-through**, **LRU**
> - Vùng MMIO **non-cacheable → bypass** (ghi thiết bị có hiệu lực ngay)
> - Tạo/xóa ánh xạ qua **syscall**; bảng TLB/Cache cập nhật thời gian thực

**Ghi chú thuyết trình (~50s):**
"Về quản lý bộ nhớ: MMU dịch địa chỉ ảo sang vật lý qua bảng dịch TLB; khi chưa có ánh xạ thì rơi về chế độ identity — địa chỉ ảo bằng vật lý — để chương trình bare-metal vẫn chạy. Mỗi lần dịch còn kiểm tra quyền đọc/ghi/thực thi. Bên phải là phân cấp cache: L1 lệnh và L1 dữ liệu, rồi L2 dùng chung, khối 64 byte, chính sách ghi xuyên và thay thế LRU. Riêng vùng ánh xạ thiết bị (MMIO) được đánh dấu không lưu đệm và bỏ qua cache, để lệnh ghi ra thiết bị có hiệu lực ngay lập tức."
*Phạm vi trung thực:* MMU tối giản theo yêu cầu GVHD — cấu hình SoC hardcode 4KB, fully-associative. *Bẫy cần biết:* test có `tlbWays:2` để kiểm LRU, nhưng cấu hình SoC thật là fully-associative — giải thích đây là hai mức, không mâu thuẫn.

---

## Slide 4 — Hiện thực 3 (bus/DMA): TileLink A/D & Bộ điều khiển DMA
**Hình:** `figures/fig_4_7_tilelink_a_d_frame.svg` (trái) + `figures/fig_4_10_dma_transfer_flow.svg` (phải)

**Nội dung trên slide:**
> **Bus TileLink & Bộ điều khiển DMA**
> - TileLink: kênh **A (yêu cầu)** + **D (phản hồi)**, mức giao dịch; UH có **burst**, UL cho ngoại vi
> - DMA: **descriptor 3 từ** (nguồn/đích/cấu hình), **2 FIFO đọc–ghi độc lập**
> - Copy RAM↔RAM hoặc RAM→ngoại vi, **độc lập với CPU**
> - **Backpressure**: UART đầy → DMA giữ giao dịch → **0 byte mất**

**Ghi chú thuyết trình (~55s):**
"Bus TileLink dùng hai kênh: kênh A mang yêu cầu, kênh D mang phản hồi — đúng mức giao dịch. Hình bên trái là cấu trúc một giao dịch A→D với các trường opcode, địa chỉ, mặt nạ byte, dữ liệu. Bên phải là quy trình của DMA: chương trình ghi một descriptor ba từ — nguồn, đích, cấu hình — DMA đẩy vào FIFO rồi tự thực hiện theo từng phần tử qua hai pha đọc và ghi. Một điểm nhóm em xử lý kỹ là backpressure: khi FIFO phát của UART đầy, DMA giữ giao dịch lại thay vì làm tràn — nhờ vậy không mất byte nào, kể cả khi DMA nhanh hơn tốc độ phát của UART."
*Số liệu mạnh:* trước khi có backpressure, gửi 65 byte chỉ ra ~16; sau khi sửa: đủ **65/65, 0 mất**. *Phạm vi trung thực:* chỉ kênh A/D, chưa có B/C/E, chưa coherence; bus xử lý một giao dịch tại một thời điểm; burst có số beat là lũy thừa 2.

---

## Slide 5 — Hiện thực 4 (trực quan): Sơ đồ SoC động & Nhật ký hệ thống
**Hình:** ảnh chụp `fig_4_13` (sơ đồ SoC khi đang chạy) + (tùy chọn) `fig_4_14` (terminal log có bộ lọc) — **cần chụp từ app**

**Nội dung trên slide:**
> **Trực quan hóa: Sơ đồ SoC "sống" & Nhật ký lọc theo mô-đun**
> - Sơ đồ SoC động: đường bus **sáng + chấm pulse** khi có giao dịch
> - Mỗi khối hiện trạng thái (PC, hit rate…); bộ đếm giao dịch tăng liên tục
> - Nhật ký lọc theo **9 nhóm** mô-đun (CPU/MMU/cache/bus/DMA/I/O…)
> - Bảng thanh ghi/bộ nhớ/TLB/cache **tô sáng ô vừa thay đổi**
> - Chạy **100% trên trình duyệt**, không cài đặt

**Ghi chú thuyết trình (~50s):**
"Đây là phần trực quan hóa — điểm khác biệt chính của công cụ. Trên sơ đồ SoC, mỗi khi có giao dịch trên bus thì đường nối tương ứng sáng lên và có một chấm chạy dọc theo đường, kèm bộ đếm giao dịch — người học thấy được dữ liệu thực sự di chuyển trong hệ thống. Bên cạnh đó là nhật ký hệ thống lọc được theo từng mô-đun: chỉ xem log của CPU, hoặc MMU, hoặc DMA… Các bảng thanh ghi, bộ nhớ, TLB và cache đều cập nhật theo thời gian thực và tô sáng ô vừa đổi giá trị sau mỗi bước. Toàn bộ chạy trực tiếp trên trình duyệt."
*Lưu ý chụp ảnh:* chụp khi đang Run để bắt được hiệu ứng đường bus sáng; nếu sơ đồ gắn nhãn UH là "coherent bus" thì che/sửa hoặc giải thích đây chỉ là **bus hiệu năng cao** (hệ thống không làm coherence).

---

## Slide 6 — Kết quả: Kiểm chứng 3 lớp đối chiếu công cụ chuẩn
**Hình:** `figures/fig_5_1_verification_dashboard.png` (đã có PNG sẵn)

**Nội dung trên slide:**
> **Kết quả kiểm chứng — 3 lớp đối chiếu công cụ chuẩn**
> - **Lớp 1:** 14/14 kiểm thử đơn vị (Node.js) · 21/21 chương trình assemble
> - **Lớp 2:** **17.978 lệnh khớp GNU binutils, 0 sai** (61 ELF)
> - **Lớp 3:** **61/61** chương trình đúng trên Spike
> - Dùng **công cụ + dữ liệu chuẩn của cộng đồng** → khách quan, **chạy lại được tại chỗ**

**Ghi chú thuyết trình (~50s):**
"Nhóm em kiểm chứng theo ba lớp bổ trợ nhau. Lớp một là kiểm thử đơn vị từng mô-đun bằng Node.js, hiện đạt 14 trên 14. Lớp hai là đối chiếu mã hóa lệnh với GNU binutils — công cụ chuẩn — trên bộ test ISA chính thức riscv-tests: 17.978 lệnh trùng khớp, không có lệnh nào sai. Lớp ba là đối chiếu hành vi thực thi với Spike, trình mô phỏng tham chiếu của RISC-V: 61 trên 61 chương trình đạt. Điểm quan trọng là hai lớp ngoài dùng công cụ và dữ liệu của cộng đồng quốc tế, nên kết quả khách quan, không phải nhóm tự viết test rồi tự đúng. Cả ba lớp đều chạy lại được ngay trên máy demo."
*Câu chốt mạnh:* "Em có thể chạy lại tại chỗ nếu thầy/cô muốn." *Nếu hỏi "1.456 lệnh bỏ qua là gì?":* là lệnh CSR và đặc quyền nằm ngoài phạm vi — bỏ qua có thống kê, không phải lỗi.

---

## Ghi chú chung khi làm slide
- **Hai hình/slide** (slide 2,3,4): đặt cạnh nhau, mỗi hình một nửa, có nhãn nhỏ "(a) … / (b) …".
- Cắt bớt bullet nếu quá 6 dòng — ưu tiên giữ hình to, chữ ít.
- Mỗi slide chỉ chốt **1 thông điệp**: S1 tổng thể · S2 lõi · S3 bộ nhớ · S4 bus/DMA · S5 trực quan · S6 kiểm chứng.
- Số liệu trên slide 6 lấy đúng theo ảnh `fig_5_1` (mốc 14/06/2026) — **chạy lại trước hôm bảo vệ** để cập nhật nếu khác.
