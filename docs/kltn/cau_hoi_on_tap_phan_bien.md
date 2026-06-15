# Bộ câu hỏi ôn tập phản biện KLTN — kèm gợi ý trả lời

> Soạn ngày 14/06/2026 cho 2 thành viên (Lộc & Khang). Mục đích: **học ý chính để trả lời tự nhiên**, không phải học thuộc lòng.
> Bổ trợ cho [ghi_chu_slide_phan_bien.md](ghi_chu_slide_phan_bien.md) (đã có 12 câu kỹ thuật) và [ke_hoach_on_tap_bao_ve.md](ke_hoach_on_tap_bao_ve.md).

---

## Thầy Trần Đại Dương dặn gì? (đọc trước khi ôn)

Thầy nhắn 2 ý quan trọng:

1. **Hội đồng sẽ hỏi những câu rất bình thường:** *"Em làm đề tài này đạt được những gì? Em gặp khó khăn gì? Em làm như thế nào? Khó khăn lớn nhất là gì, em vượt qua ra sao?"* → Đây là phần **A** bên dưới, **quan trọng nhất, học kỹ nhất.**
2. **Đừng quá căng thẳng. Phản biện chỉ để thầy cô kiểm tra bọn em có thực sự làm hay không.** Không cần nhớ hết mọi thứ — **cái gì không nhớ thì cứ mở báo cáo ra coi rồi trả lời, chuyện bình thường, không ai nhớ hết cả.**

→ Hệ quả khi ôn: **đừng cố thuộc lòng số liệu/chi tiết.** Hãy nhớ *câu chuyện tổng thể* và *biết tìm ở đâu trong báo cáo*. Khi bí, dùng các câu an toàn ở **Phần E**.

---

# PHẦN A — Câu hỏi "bình thường" của hội đồng (HỌC KỸ NHẤT)

> Đây là nhóm câu thầy nói chắc chắn bị hỏi. Mỗi người tự đọc và **tự kể lại bằng lời của mình** (đừng đọc thuộc), vì đây là câu chứng minh "có thực sự làm hay không".

### A1. "Em làm đề tài này, em đã đạt được những gì?"

**Khung trả lời (~45 giây):**
- "Nhóm em xây dựng được **một trình mô phỏng SoC RISC-V chạy hoàn toàn trên trình duyệt web**, gom đủ một chuỗi hệ thống trong cùng một công cụ: trình biên dịch hợp ngữ → lõi CPU RV32IMF → MMU/TLB → cache L1I/L1D/L2 → bus TileLink UH/UL có cầu nối → DMA → 5 ngoại vi (UART, CAN, LED, bàn phím, chuột) — và **trực quan hóa** từng thành phần."
- "So với 5 mục tiêu kỹ thuật đặt ra ở đầu báo cáo, nhóm em **hoàn thành cả 5/5** trong phạm vi đã xác định."
- "Phần em tâm đắc nhất là **kiểm chứng tính đúng đắn bằng 3 lớp**: kiểm thử đơn vị, đối chiếu *mã hóa lệnh* với GNU binutils, và đối chiếu *thực thi* với Spike — đều là công cụ chuẩn của cộng đồng RISC-V, nên kết quả khách quan."
- "Về điểm mới so với khóa luận trước (Nguyễn Gia Bảo Ngọc 2025): nhóm em **bổ sung nhóm lệnh M (nhân/chia) và F (dấu phẩy động)** cùng tệp thanh ghi FP, **thêm nhiều ngoại vi**, và **quy trình kiểm chứng định lượng rõ ràng hơn**."

**Số liệu để chốt mạnh (nếu nhớ — không nhớ thì mở báo cáo Ch5):** 14/14 script kiểm thử đơn vị đạt; **17.978 lệnh khớp GNU binutils, 0 sai**; **61/61 file riscv-tests chạy đúng trên Spike**.

### A2. "Em làm như thế nào?" (quy trình / phương pháp)

**Khung trả lời (~40 giây):**
1. **Nghiên cứu tài liệu:** đặc tả RISC-V ISA (RV32IMF), đặc tả TileLink (UL/UH), cơ chế MMU/TLB/cache, và khảo sát các công cụ có sẵn (MARS, Ripes, WebRISC-V, Spike, KLTN 2025) để tìm khoảng trống.
2. **Thiết kế mô-đun:** mỗi khối phần cứng = **một mô-đun phần mềm (ES module)** riêng, lắp ghép tại một thành phần khởi tạo trung tâm. Mô phỏng ở **mức hành vi theo chu kỳ** (behavioral/functional), không mô phỏng định thời vật lý.
3. **Hiện thực dần từng khối**, dùng HTML/CSS/JavaScript, CodeMirror cho vùng soạn thảo, canvas cho LED.
4. **Một quyết định thiết kế quan trọng:** bảng mã lệnh nằm **chung trong `isa.js`**, dùng đồng thời cho assembler, CPU và tô màu cú pháp → ba nơi luôn nhất quán 100%.
5. **Kiểm chứng song song khi phát triển:** unit test Node.js + đối chiếu GNU/Spike (script tự bắc cầu sang môi trường WSL để chạy).
6. **Làm nhóm 2 người:** chia mô-đun, đồng bộ code qua Git.

### A3. "Em gặp khó khăn gì?"

> Chọn 2–3 khó khăn để kể, đừng liệt kê hết. Mỗi khó khăn kể kèm **cách giải quyết** (hội đồng thích nghe "gặp → xử lý thế nào").

Danh sách khó khăn **thật** của đề tài (chọn cái mình trực tiếp làm):

| Khó khăn | Cách nhóm xử lý |
|---|---|
| **Làm sao biết CPU/assembler chạy ĐÚNG?** Tự viết test rồi tự đúng thì không khách quan. | Dựng **kiểm chứng 3 lớp đối chiếu công cụ chuẩn** (GNU binutils + Spike) trên bộ riscv-tests của cộng đồng. |
| **Đồng bộ assembler ↔ CPU ↔ tô màu:** sửa một lệnh phải sửa 3 chỗ, dễ lệch. | Gom bảng opcode về **một nguồn duy nhất `isa.js`**. |
| **DMA gửi UART bị MẤT byte:** gửi 65 byte chỉ ra ~16. | Thêm cơ chế **backpressure** — UART báo "đầy" qua `canAccept()`, DMA giữ giao dịch lại thay vì làm tràn → đủ 65/65, 0 mất. |
| **Tab SoC chạy chậm/giật** khi animation. | Tìm ra thủ phạm là **`console.log` mỗi chu kỳ** (không phải SVG); thêm gom log + chỉ vẽ khi tab đang hiển thị → nhanh hơn nhiều lần. |
| **Cân đối phạm vi:** ISA rất rộng, không thể làm hết trong thời gian KLTN. | Chốt **phạm vi trung thực** với thầy hướng dẫn (RV32IMF *tập con*, MMU tối giản, CAN mức frame) và nêu thẳng trong báo cáo. |
| **Làm nhóm 2 người:** tránh đụng code, giữ nhánh đồng bộ. | Quy ước nhánh + commit/push qua Git, chia mô-đun rõ ràng. |

### A4. "Khó khăn lớn nhất của em là gì, em vượt qua như thế nào?" ⭐

> Đây là câu "đinh". Chọn **MỘT** câu chuyện rõ ràng, kể có mở–thân–kết. Hai gợi ý mạnh (chọn cái mình làm):

**Phương án 1 — Đảm bảo tính đúng đắn (mạnh nhất về mặt học thuật):**
> "Khó khăn lớn nhất là **làm sao chứng minh mô phỏng của nhóm em đúng**, chứ không phải tự viết test rồi tự bảo là đúng. Lúc đầu nhóm em chỉ có vài test tự viết, không đủ tin cậy. Nhóm em quyết định **đối chiếu với công cụ chuẩn của cộng đồng**: dùng GNU binutils để so *mã hóa lệnh* và Spike để so *hành vi thực thi*, trên bộ test chính thức riscv-tests. Vướng mắc là các công cụ này chạy trên Linux, còn nhóm em phát triển trên Windows — nên nhóm em viết script **tự bắc cầu sang môi trường WSL** để chạy tự động. Kết quả: **17.978 lệnh khớp, không sai lệnh nào; 61/61 chương trình chạy đúng trên Spike.** Nhờ vậy nhóm em tự tin khẳng định tính đúng đắn một cách khách quan."

**Phương án 2 — Lỗi mất dữ liệu DMA→UART (mạnh về kỹ thuật, dễ kể sinh động):**
> "Khó khăn em nhớ nhất là khi cho DMA đẩy dữ liệu ra UART, **bị mất byte** — gửi 65 byte mà chỉ ra được khoảng 16. Em mất thời gian lần ra nguyên nhân: DMA chạy nhanh hơn tốc độ phát của UART, khi FIFO phát đầy thì byte mới bị ghi đè. Em xử lý bằng cơ chế **backpressure**: cho UART báo lại 'tôi đang đầy' qua hàm `canAccept()` trên kênh A của bus, và DMA sẽ **giữ giao dịch lại** chờ thay vì làm tràn. Sau khi sửa, gửi đủ 65/65 byte, không mất byte nào. Bài học là trong hệ thống thật, *điều khiển luồng (flow control)* giữa các khối tốc độ khác nhau là bắt buộc."

**Cấu trúc kể chuyện (áp dụng cho cả 2):** Bối cảnh → Vướng ở đâu → Đã thử/suy nghĩ gì → Giải pháp → Kết quả đo được → Bài học.

### A5. "Hai em phân công thế nào? Em làm phần nào?" (LO7 — chắc chắn hỏi vì đề tài 2 người)

**Khung trả lời:**
- Trả lời **đúng theo Bảng phân công (Bảng 1.3) trong báo cáo Ch1.**
- Mỗi người **nói rõ phần mình code** (ví dụ: ai phụ trách assembler/CPU; ai phụ trách MMU/cache/bus/DMA/ngoại vi/giao diện), và **cả hai cùng làm kiểm chứng**.
- ⚠️ **Lưu ý quan trọng:** câu này cũng để kiểm tra "có thực sự làm không" → nói được phần mình làm thì **phải giải thích được phần đó ở Phần B**. Đừng nhận phần mình không nắm.

> *(Điền cụ thể tên ai làm gì vào đây trước khi ôn — phải khớp Bảng 1.3.)*
> - Lộc: ______________________________
> - Khang: ____________________________

### A6. "Em học được gì / tâm đắc điều gì nhất khi làm đề tài này?"

**Gợi ý (chọn 1–2):**
- Hiểu sâu **luồng dữ liệu xuyên suốt một SoC**: từ lệnh hợp ngữ → CPU → MMU dịch địa chỉ → cache → bus → ngoại vi.
- Học được **giá trị của kiểm chứng đối chiếu** (differential testing) với công cụ chuẩn, thay vì tự đánh giá.
- Học được cách **giữ một nguồn dữ liệu duy nhất** (`isa.js`) để tránh sai lệch giữa các thành phần.
- Kỹ năng **làm việc nhóm + quản lý mã nguồn bằng Git**.

### A7. "Nếu được làm lại / có thêm 3 tháng, em làm gì khác?"

**Gợi ý (lấy từ Ch6 — Hướng phát triển):**
- Bổ sung **cơ chế ngắt (IRQ)** để ngoại vi không phải đọc thăm dò (polling).
- Bổ sung **CSR + chế độ đặc quyền**, hoàn thiện **FPU (FCSR/fflags/frm)** và thực thi `fence`.
- Mở rộng **TileLink kênh B/C/E + coherence**, phân xử **đa master** thật.
- Mở rộng **CAN** nhiều nút, và xây **benchmark hiệu năng** định lượng.

---

# PHẦN B — Câu hỏi kỹ thuật theo từng mô-đun (kèm gợi ý trả lời)

> Câu này để kiểm tra "có hiểu cái mình làm không". Trả lời **ngắn, đúng phạm vi**. Phần nào không phải mình làm → nói "phần đó bạn em phụ trách, em xin tóm tắt ý chính / nhờ bạn em bổ sung".

## B1. Tổng quan & kiến trúc

**Q: Hãy mô tả một truy cập bộ nhớ đi qua hệ thống của em.**
> CPU phát địa chỉ ảo → **MMU** dịch sang địa chỉ vật lý (qua TLB; nếu chưa có ánh xạ thì rơi về **identity**, VA = PA, để chương trình bare-metal vẫn chạy) → xuống **cache L1 → L2** → ra **bus TileLink-UH** tới bộ nhớ chính. Nếu truy cập **ngoại vi (MMIO)**, giao dịch rẽ qua **cầu nối UH→UL** tới thiết bị, và **bypass cache** (vùng MMIO non-cacheable).

**Q: Mô hình mô phỏng của em là gì — chu kỳ hay sự kiện?**
> **Theo chu kỳ, mức hành vi/chức năng** (behavioral/functional). Tái hiện đúng *logic* từng thành phần, **không** mô phỏng định thời vật lý hay năng lượng. Vì viết bằng JS đơn luồng trên browser nên tốc độ phụ thuộc máy người dùng.

**Q: Bản đồ bộ nhớ (memory map) bố trí thế nào?**
> Các ngoại vi ánh xạ bộ nhớ ở các vùng riêng — ví dụ LED ở `0xFF000000`, UART ở `0x10000000`, cùng các vùng cho chuột/bàn phím/thanh ghi DMA. *(Mở Ch3 — bảng memory map nếu cần số chính xác.)*

## B2. Assembler (trình biên dịch hợp ngữ)

**Q: Assembler hai lượt (two-pass) hoạt động ra sao? Vì sao cần 2 lượt?**
> **Lượt 1** quét toàn bộ mã, thu thập **bảng nhãn (label → địa chỉ)**. **Lượt 2** sinh mã máy, lúc này đã biết địa chỉ mọi nhãn nên xử lý được **nhãn tham chiếu tới phía trước (forward reference)** — ví dụ nhảy tới nhãn nằm bên dưới.

**Q: Pseudo-instruction xử lý thế nào?**
> Lệnh giả như `li`, `la`, `call`, `ret`, `mv`… được **mở rộng** thành một hoặc nhiều lệnh thật khi dịch (ví dụ `li` lớn → `lui` + `addi`).

**Q: Làm sao chắc assembler mã hóa đúng?**
> **Đối chiếu với GNU binutils** trên 61 ELF của riscv-tests: 17.978 lệnh khớp, 0 sai. Đây là công cụ chuẩn, không phải nhóm tự đánh giá.

**Q: `isa.js` là gì, vì sao quan trọng?**
> Là **bảng opcode dùng chung** cho assembler, CPU (giải mã/thực thi) và tô màu cú pháp. Một nguồn duy nhất → ba nơi luôn nhất quán, sửa một lệnh không bị lệch giữa các thành phần.

## B3. CPU RV32IMF

**Q: Chu trình thực thi một lệnh?**
> **Nạp (fetch) → giải mã (decode) → thực thi (execute) → truy cập bộ nhớ → ghi ngược thanh ghi.** Hỗ trợ nhóm I (số nguyên cơ sở), M (nhân/chia), F (dấu phẩy động đơn) với 2 tệp thanh ghi (số nguyên + FP).

**Q: RV32IMF của em có đầy đủ không?**
> Là **tập con** phục vụ chương trình chế độ người dùng. **Chưa** có CSR, chế độ đặc quyền, **chưa** có ngắt; `fence` mã hóa đúng nhưng **chưa thực thi**; FPU **chưa** đủ FCSR/fflags/frm. *(Chủ động nêu — xem Phần D.)*

**Q: Vì sao dùng polling mà không có ngắt?**
> Vì phạm vi đề tài chưa hiện thực IRQ/CSR. Mọi ngoại vi & DMA đồng bộ bằng **đọc thăm dò thanh ghi trạng thái**. Đây là lựa chọn thiết kế có chủ đích, đã nêu rõ; ngắt nằm trong hướng phát triển.

## B4. MMU & TLB

**Q: Đường dịch địa chỉ ảo → vật lý?**
> CPU đưa VA → tra **TLB**; trúng thì lấy PA ngay; trượt thì tra bảng trang. **Chưa có ánh xạ → rơi về identity (VA = PA)** để bare-metal chạy được. TLB kiểm tra quyền **R/W/X** và tính **cacheable**.

**Q: Tạo/xóa ánh xạ bằng gì?**
> Qua **syscall** (map/unmap), quan sát được trên bảng TLB của giao diện.

**Q: Vì sao MMU tối giản, không làm TLB set/way?**
> Theo **yêu cầu của thầy hướng dẫn**: MMU làm đơn giản nhất phục vụ giáo dục. Cấu hình SoC thật **hardcode 4KB, fully-associative**, giao diện chỉ còn 1 bảng TLB. *(Lưu ý bẫy tlbWays=2 — xem D6.)*

## B5. Cache

**Q: Tổ chức cache thế nào?**
> **L1I và L1D: 16 set × 4 way; L2: 64 set × 4 way; block 64 byte; ghi xuyên (write-through).** Thay thế theo **LRU**.

**Q: Vì sao MMIO phải bypass cache?**
> Vì ghi vào thanh ghi thiết bị phải **có hiệu lực ngay** (đèn sáng, UART phát…). Nếu cache giữ lại thì thiết bị không thấy → vùng MMIO đánh dấu **non-cacheable, bypass cache**.

**Q: Cache có chứng minh coherence không?**
> **Không.** Bus một-giao-dịch, chỉ kênh A/D, không có TileLink-C coherence, một master CPU. Cache chỉ minh họa **phân cấp L1/L2, LRU, write-through**.

## B6. TileLink & cầu nối (bridge)

**Q: Vì sao chọn TileLink mà không phải AXI4 / Wishbone / cái khác?** ⭐ (hội đồng đã hỏi)
> Bốn lý do chính:
> 1. **Native với hệ sinh thái RISC-V:** TileLink là interconnect "ruột" của RocketChip, BOOM, các lõi SiFive — chính là các thiết kế RISC-V mở. Đề tài mô phỏng SoC RISC-V nên dùng TileLink là **đúng "chất" hệ sinh thái**, sinh viên thấy được bus mà thế giới RISC-V thực sự dùng.
> 2. **Phân tầng đúng nhu cầu giáo dục:** ba mức TL-UL → TL-UH → TL-C ánh xạ thẳng vào lộ trình dạy học — UL cho ngoại vi đơn giản, UH thêm burst cho bộ nhớ, và **để ngỏ TL-C cho coherence** (hướng phát triển). AXI chia rải rác qua AXI4-Lite/AXI4/ACE/CHI, phân mảnh hơn.
> 3. **Đơn giản để hiện thực + trực quan hóa:** tập con uncached chỉ cần **2 kênh A/D**, dễ vẽ một giao dịch "sáng" trên sơ đồ SoC và dễ hiện thực đúng bằng JS; AXI4 có **5 kênh** (AW/W/B/AR/R) — phức tạp hơn nhiều mà không thêm giá trị dạy học.
> 4. **Sẵn sàng cho coherence:** TileLink sinh ra để mang coherence (TL-C qua kênh B/C/E); chọn nó giúp mở rộng sau này không phải đổi giao thức.
>
> **Vì sao không chọn cái khác:**
> - **AXI4 (ARM AMBA):** rất mạnh, phổ biến công nghiệp, nhưng **5 kênh độc lập** → phức tạp hơn để hiện thực/trực quan; coherence nằm ở **giao thức riêng** (ACE/CHI); hệ sinh thái thiên ARM, không native RISC-V.
> - **Wishbone (OpenCores):** mở và rất đơn giản, nhưng thiếu mô hình **burst/pipeline** tương đương TL-UH và **không có lộ trình coherence** → quá tối giản để minh họa một fabric phân tầng bộ nhớ + ngoại vi.
> - **CHI (ARM):** quá phức tạp (coherence đầy đủ cho server nhiều nhân) — thừa cho mục tiêu đề tài.
> *(Lưu ý: đề tài hiện chỉ làm UL/UH + bridge, kênh A/D — xem D5.)*

**Q: TileLink có phải là AXI4, hay là bản rút gọn của AXI4 không?** ⭐ (hội đồng đã hỏi)
> **Không phải cả hai.** TileLink là **giao thức độc lập**, thiết kế riêng (gốc Berkeley RocketChip, SiFive/Chips Alliance phát triển), **không dẫn xuất từ AXI/AMBA**. Nói "TileLink là AXI4 rút gọn" là **sai về bản chất** — dễ bị bắt lỗi.
> - **Khác về tổ chức kênh:** AXI4 tách hẳn đọc/ghi thành 5 kênh (AW, W, B, AR, R); TileLink **gộp mọi request vào 1 kênh A**, phản hồi qua **kênh D**, phân biệt thao tác bằng **opcode** (Get, PutFullData, PutPartialData…). Đây là khác biệt kiến trúc, **không phải "bỏ bớt kênh"**.
> - **Quan hệ đúng (so theo mức năng lực):** TL-UL ≈ **AXI4-Lite**; TL-UH ≈ **AXI4** (có burst, nhưng *không* coherence); TL-C **vượt** AXI4 vì thêm cache coherence — phần coherence của ARM nằm ở **giao thức riêng ACE/CHI**, không phải AXI4.
> - **Triết lý:** TileLink ưu tiên *forward-progress / deadlock-freedom by design* và sinh ra để gắn coherence trong hệ RISC-V; AXI4 là chuẩn thương mại ARM, mạnh về out-of-order theo ID.
>
> | | AXI4 | TileLink |
> |---|---|---|
> | Số kênh | 5: AW, W, B, AR, R | tối đa 5: A, B, C, D, E |
> | Tách read/write | có (AR/R vs AW/W/B) | **không** — chung kênh A, phân biệt bằng opcode |
> | Phản hồi | B (write), R (read) | chung **kênh D** |
> | Coherence | không (ở ACE/CHI riêng) | có ở **TL-C** (kênh B/C/E) |
> | Nguồn gốc | ARM AMBA | Berkeley / SiFive (RISC-V) |
>
> **Chốt an toàn:** "TileLink là giao thức interconnect độc lập, không phải biến thể AXI4. Về năng lực thì TL-UL ~ AXI4-Lite, TL-UH ~ AXI4 (không coherence); nó gộp read/write vào một kênh A và được thiết kế để hỗ trợ coherence (TL-C) — điều AXI4 không có. Đồ án em hiện thực mức TL-UL/TL-UH."

**Q: UL khác UH chỗ nào? Bridge làm gì?**
> **UH** là đường bộ nhớ hiệu năng cao, hỗ trợ **burst nhiều beat**; **UL** đơn giản cho ngoại vi. **Bridge** nối hai miền **hai chiều** (chuyển giao dịch UH↔UL).

**Q: Burst là thật hay chỉ vòng lặp ghi?**
> **Burst thật ở mức mô hình:** một giao dịch mang **nhiều beat**, số beat là **lũy thừa của 2**, thấy rõ trong log "beats=4 (multi-beat)". Test xác nhận 4 burst × 4 beat cho 16 word; bus có độ trễ ~2 chu kỳ/giao dịch.

**Q: Vì sao beat phải là lũy thừa 2?**
> Đúng theo ràng buộc của đặc tả TileLink về kích thước burst (size là lũy thừa 2), giúp căn chỉnh địa chỉ/độ dài đơn giản.

## B7. DMA

**Q: Lập trình DMA thế nào?**
> Bằng một **descriptor 3 từ**: **nguồn, đích, cấu hình** (độ dài/chế độ). DMA tự copy **RAM→RAM** hoặc **RAM→ngoại vi**, hoàn tất báo bằng **polling** (đọc bit done).

**Q: DMA của em có gì đặc biệt?**
> **Hai FIFO đọc và ghi độc lập** (đọc và ghi chạy song song), **multi-beat burst**, và **backpressure** với ngoại vi chậm (UART) để không mất dữ liệu.

**Q: DMA giúp gì so với CPU tự copy?**
> **Giảm tải CPU**: DMA vận chuyển khối dữ liệu **độc lập** với luồng thực thi lệnh, CPU rảnh để tính việc khác — minh họa rõ trong demo "DMA tô LED trong khi CPU vẫn tính toán".

## B8. UART

**Q: Cấu hình tốc độ (baud) bằng gì?**
> Qua **thanh ghi divisor** (bộ chia) — baud = clock / divisor.

**Q: Backpressure giải quyết vấn đề gì?**
> Khi DMA đẩy nhanh hơn UART phát, FIFO phát đầy → trước đây **mất byte** (65 gửi chỉ ra ~16). Thêm `canAccept()` trên kênh A để DMA **giữ giao dịch** khi FIFO đầy → **đủ 65/65, 0 mất**. *(Lưu ý: đường CPU ghi trực tiếp không bị chặn cổng này.)*

## B9. CAN

**Q: CAN của em làm tới đâu?**
> **Mức frame/message qua MMIO**: standard ID 11-bit, DLC 0–8, payload 8 byte, mailbox TX/RX, **loopback**. **Không** có physical layer, bit-stuffing, CRC, ACK, arbitration bit-level.

**Q: Vì sao chỉ mức đó là đủ?**
> Đủ cho **mục tiêu giáo dục & demo SoC** (thấy được khung CAN truyền/nhận qua MMIO). Register map đối chiếu **M_CAN manual**; lý thuyết giao thức dẫn chuẩn **ISO 11898-1**. Đây là ngoại vi tối thiểu, đã nêu rõ trong báo cáo.

## B10. Ngoại vi khác & Giao diện web

**Q: Có những ngoại vi nào, đọc bằng gì?**
> **UART, CAN, ma trận LED 32×32 (VRAM), bàn phím, chuột** — tất cả **ánh xạ bộ nhớ**, đọc bằng **polling**.

**Q: Giao diện trực quan hóa gồm gì?**
> Trình soạn thảo có **gợi ý lệnh** (CodeMirror), bảng **thanh ghi + bộ nhớ**, **sơ đồ SoC động** (giao dịch sáng trên bus), **bảng cache + TLB** cập nhật theo thời gian thực, và **bảng log lọc theo từng mô-đun** (CPU/MMU/cache/bus/DMA/I/O).

## B11. Kiểm chứng (rất hay bị hỏi sâu)

**Q: Em kiểm chứng tính đúng đắn bằng gì?**
> **3 lớp:** (1) **unit test** Node.js từng mô-đun (14/14 đạt); (2) đối chiếu **mã hóa lệnh** với **GNU binutils** (17.978 lệnh, 0 sai); (3) đối chiếu **thực thi** với **Spike** (61/61 ELF). Hai lớp ngoài dùng **công cụ + dữ liệu chuẩn của cộng đồng** → khách quan.

**Q: Có chạy lại được tại chỗ không?**
> **Có.** Script `verify_*` tự gọi sang **WSL** (đã cài GNU toolchain + Spike) chạy trên 61 ELF. "Em có thể chạy lại ngay tại đây nếu thầy/cô muốn." *(Đảm bảo đã chạy thử trước khi vào phòng.)*

**Q: 1.456 lệnh bị "skip" là sao?**
> Là các lệnh **CSR và đặc quyền** nằm **ngoài phạm vi** đề tài → được bỏ qua **có thống kê**, không phải lỗi.

---

# PHẦN C — Câu hỏi vĩ mô (đóng góp, so sánh, ứng dụng)

**Q: Đóng góp / tính mới của đề tài là gì?** (chốt 30 giây)
> (1) Một trình mô phỏng **SoC RISC-V đầy đủ chuỗi, chạy 100% trên web**, gom assembler + CPU + cache/MMU + bus + DMA + ngoại vi + trực quan hóa trong một công cụ; (2) **mở rộng RV32M + RV32F** so với KLTN 2025; (3) **thêm nhiều ngoại vi + khung trực quan hóa** (sơ đồ SoC động, log lọc theo mô-đun, bảng TLB/cache); (4) **quy trình kiểm chứng 3 lớp** đối chiếu GNU/Spike.

**Q: So với KLTN 2025 (Bảo Ngọc) khác gì? (đừng nói quá)**
> KLTN 2025 đã có RV32I + atomic, MMU, TileLink, DMA, LED. Nhóm em **kế thừa hướng đó** và **bổ sung**: RV32M/RV32F + tệp thanh ghi FP, nhiều ngoại vi hơn (UART có baud, CAN mức frame, bàn phím, chuột), bus TileLink **UL/UH + bridge**, DMA **descriptor + backpressure**, MMU + syscall, và **kiểm chứng định lượng GNU/Spike**. → Chỉ nêu phần thật sự nhóm làm.

**Q: So với RARS/Ripes/Spike thì sao?**
> RARS/Ripes/WebRISC-V mạnh ở **CPU/pipeline** nhưng yếu/không có **bus + DMA + nhiều ngoại vi** ở mức SoC; Spike chính xác nhưng **CLI, không trực quan**. Đề tài lấp khoảng trống: **mô phỏng cả SoC + trực quan hóa + chạy ngay trên web không cần cài.**

**Q: Ứng dụng thực tế?**
> **Công cụ dạy/học Kiến trúc máy tính & Hệ điều hành** ở mức hệ thống: sinh viên *thấy* được dữ liệu chạy qua MMU, cache, bus, DMA, ngoại vi — chạy ngay trên trình duyệt, không cài đặt.

**Q: Tại sao chọn nền web/browser?**
> **Dễ tiếp cận** (không cài đặt, chạy mọi máy có browser), phù hợp dạy học; đánh đổi là **tốc độ phụ thuộc máy** (JS đơn luồng) — đã nêu là giới hạn.

**Q: Hiệu năng mô phỏng đo bằng gì?**
> Hiện ở mức **quan sát trong mô phỏng** (chỉ số instructions/sec hiển thị). Nhóm em **chưa có benchmark định lượng lặp lại** — đã ghi rõ là hạn chế và hướng phát triển.

---

# PHẦN D — Câu hỏi "bẫy" / khó & cách gỡ (NÊN CHỦ ĐỘNG NÊU TRƯỚC)

> Nguyên tắc vàng: **chủ động nêu giới hạn trước khi bị khui.** Hội đồng đánh giá cao sự trung thực hơn là cố che. Công thức trả lời: *"Đúng là X nằm ngoài phạm vi vì [mục tiêu giáo dục / thời gian]; thiết kế đã chừa chỗ mở rộng ở Y."*

**D1. `fence` — có thực thi không?**
> Được **mã hóa đúng** nhưng CPU **chưa thực thi** (coi như nop). Vì chưa có mô hình reorder/coherence để `fence` có ý nghĩa. Đã nêu rõ trong phạm vi.

**D2. FPU: `fcvt.w.s(6.5)` ra 7 — sai à?**
> Không sai về giá trị, là **giới hạn đã biết**: chưa hiện thực FCSR/frm nên rounding-mode "dyn" rơi về mặc định làm tròn → 6.5 thành 7. Có frm đầy đủ (chế độ truncate) thì ra 6. Đã nêu thẳng là hạn chế.

**D3. `AMOADD.W` — vậy có hỗ trợ RV32A không?**
> **Không nhận là "hỗ trợ RV32A".** `AMOADD.W` là **lệnh atomic duy nhất**, chỉ là **mở rộng minh họa, nằm ngoài tên đề tài**, giữ nguyên theo **thống nhất với thầy hướng dẫn**. Không tự nhận quá.

**D4. Vì sao không có ngắt (IRQ)?**
> Ngoài phạm vi đợt này; mọi đồng bộ bằng **polling**. Là lựa chọn thiết kế có chủ đích, ngắt nằm trong hướng phát triển. *(Đừng nói "quên làm".)*

**D5. TileLink chỉ A/D — thiếu B/C/E?**
> Đúng, **chủ ý** ở **mức giao dịch A/D (UL+UH)** cho mục tiêu giáo dục; **chưa** có B/C/E và coherence của TileLink-C, **chưa** phân xử đa master (hàng đợi một giao dịch). Đã ghi rõ ở phạm vi và hướng phát triển.

**D6. Test MMU có `tlbWays:2` nhưng báo cáo nói fully-associative — mâu thuẫn?**
> **Không mâu thuẫn.** Class MMU viết **tổng quát** (hỗ trợ set/way) để **kiểm chứng được cơ chế LRU**. Còn **cấu hình SoC thật + giao diện hardcode 4KB fully-associative** theo yêu cầu GVHD. Hai mức khác nhau; cấu hình production là fully-associative.

**D7. Vài demo kết thúc `a0 ≠ 0` — fail à?**
> Không. Một số demo (`dma_demo`, `dma_led_demo`, `bus_demo`, `mmu_syscall_test`, `test_cache`) cố ý dùng `a0` làm **dữ liệu** (tổng/giá trị đọc về), không phải mã lỗi. Tiêu chí đúng là **nội dung bộ nhớ/thanh ghi khớp kỳ vọng**. Demo dùng quy ước `a0=0=PASS` là `soc_full_demo`, `demo_uart_dma`, `led_demo`. *(Syscall exit dùng `a7=93`.)*

**D8. Sao tin số 17.978 / 61/61?**
> Vì dùng **công cụ + dữ liệu chuẩn cộng đồng** (GNU binutils, Spike, riscv-tests), không phải nhóm tự chế. **Chạy lại được tại chỗ**, log lưu ở `test-artifacts/`.

**D9. CAN sao sơ sài vậy?**
> Là **ngoại vi giáo dục tối thiểu** (mức frame/message qua MMIO, loopback) — đủ để demo khung CAN trong SoC. Mở rộng physical layer/CRC/arbitration là hướng phát triển, chỉ làm khi có mục tiêu + bộ kiểm chứng phù hợp.

**D10. Mô phỏng có chính xác định thời/chu kỳ thật không?**
> **Không.** Là mô phỏng **hành vi/chức năng**, không mô hình định thời vật lý hay năng lượng. Mục tiêu là **đúng logic + trực quan để dạy học**, không phải cycle-accurate như gem5.

**D11. Sơ đồ SoC có dây nối UL ↔ DMA — đường đó hoạt động thế nào?** ⭐ (GVHD đã hỏi & yêu cầu đúng luồng)
> Thiết kế đã làm **đúng yêu cầu GVHD** (hiện thực/cập nhật **15/06/2026**): **thanh ghi điều khiển DMA nằm trên bus ngoại vi UL**, và **DMA giao tiếp I/O đi qua bus UH rồi xuống UL qua cầu nối** — không đi tắt. (Trước 15/06 code đặt thanh ghi DMA trên UH và cho DMA làm master trực tiếp trên UL — **đã sửa lại cho khớp spec thầy.**)
>
> **Hai luồng (đúng spec thầy):**
> - **Cấu hình DMA:** CPU → **bypass cache** (thanh ghi non-cacheable) → **UH** → **cầu UH→UL** → **UL** → thanh ghi DMA (CTRL `0xFFED0000`, DESC `0xFFED0004`). Dây `ulToDma` (UL→DMA) **sáng** ở bước này.
> - **DMA ↔ I/O:** DMA là master trên **UH**; mọi giao dịch dữ liệu phát ra trên UH, nếu đích là ngoại vi UL (UART/LED/CAN/bàn phím/chuột) thì UH **tự route qua cầu UH→UL** xuống thiết bị rồi phản hồi **ngược lại** ("DMA → UH → UL → ngược lại").
>
> **Cấu hình code (soc.js):** thanh ghi DMA là slave trên UL (cổng `ulToDmaRegs`); cầu UH→UL nhận thêm dải `dmaRegRange` để route cấu hình DMA sang UL; DMA `selectLinkForAddress` luôn trả UH (chỉ master trên UH); cầu UL→UH loại `dmaRegRange` để tránh vòng lặp route.
>
> **Bằng chứng (chạy tại chỗ, tất cả PASS):**
> - `node test/dma_verify.mjs` — log in rõ: `TileLink-UH → uh-to-ul-bridge` → `BRIDGE_DIRECT_WRITE TileLink-UH→TileLink-UL addr=0xffed0000` → ghi thanh ghi DMA. Đúng **CPU → UH → UL → DMA**.
> - `node test/uart_dma_flow_verify.mjs` — DMA phát `ISSUE_WRITE via=TileLink-UH` → `TileLink-UH → uh-to-ul-bridge REQUEST from=dma` → UL → UART; **65/65 byte, 0 byte mất, backpressure giữ nguyên** (cầu nối chuyển tiếp `canAccept()` của UART). Đúng **DMA → UH → UL → ngược lại**.
> - **17/17 unit test pass.** Sơ đồ động: dây `ulToDma` + `uhToUlBridge` **sáng đúng** khi cấu hình DMA (kiểm chứng qua `simulator.trace.activeLinks`).
>
> **Câu trả lời an toàn (đọc thành lời):**
> > "Dạ đúng theo yêu cầu của thầy: thanh ghi điều khiển DMA nằm trên bus UL, nên CPU cấu hình DMA phải đi từ UH qua cầu nối xuống UL rồi mới ghi vào DMA — dây UL↔DMA sáng ở bước này. Còn khi DMA trao đổi dữ liệu với ngoại vi, nó phát giao dịch trên UH và được cầu UH→UL chuyển xuống thiết bị rồi phản hồi ngược lại. Em có test chạy tại chỗ in ra đúng luồng UH→UL này, và 65 byte ra UART không mất byte nào ạ."

---

# PHẦN E — Mẹo trả lời & câu "cứu nguy" khi bí

> Thầy đã dặn: **không cần nhớ hết, cứ mở báo cáo ra coi.** Hãy tận dụng đúng tinh thần đó.

**Quy tắc trả lời:**
1. **Bình tĩnh, trả lời ngắn — đúng phạm vi.** Không vòng vo, không "nổ".
2. **Không biết / không chắc → nói thật + tra báo cáo.** Đây là điều thầy cho phép.
3. **Phần không phải mình làm → chuyển cho bạn cùng nhóm** hoặc tóm tắt ý chính.
4. **Bị hỏi giới hạn → thừa nhận thẳng + nói đã có trong hướng phát triển.** Trung thực ghi điểm.
5. **Có cơ hội thì mời chạy lại demo/test tại chỗ** — bằng chứng mạnh nhất "có thực sự làm".

**Câu cứu nguy (học thuộc vài câu):**
- *"Dạ chi tiết con số đó em xin phép mở lại báo cáo (Chương ___) để trả lời chính xác cho thầy/cô ạ."*
- *"Phần này bạn ___ trong nhóm em phụ trách chính, em xin tóm tắt ý chính, và nhờ bạn bổ sung chi tiết ạ."*
- *"Dạ đúng là phần này nằm ngoài phạm vi đề tài, nhóm em có nêu rõ ở mục giới hạn và đưa vào hướng phát triển ạ."*
- *"Em chưa chắc điểm này, em xin phép ghi nhận và kiểm tra lại ạ."* (tốt hơn là trả lời sai/đoán bừa)
- *"Nếu thầy/cô muốn, em có thể chạy lại demo / test ngay tại chỗ để minh họa ạ."*

**Trước khi vào phòng — mở sẵn để tra nhanh:**
- Báo cáo `KLTN_SoC_Loc_Khang` (PDF) — biết mục nào ở chương nào: phạm vi/giới hạn (Ch1 §1.3.2), kiến trúc (Ch3), hiện thực (Ch4), kiểm chứng (Ch5), hạn chế/hướng phát triển (Ch6).
- Server demo (`tools/dev_server.py` no-cache) + slides + video dự phòng.
- Đã chạy thử `node test/verify_riscv_tests_spike.mjs` để sẵn sàng chạy lại.

---

## Phân vai ôn tập (gợi ý)
- **Mỗi người** đọc kỹ **Phần A** (tự kể bằng lời mình) + **Phần B các mô-đun mình code**.
- **Hỏi chéo nhau** ≥ 2 lượt: một người đóng vai hội đồng hỏi vặn, người kia trả lời không nhìn giấy.
- Câu nào trả lời lắp bắp → ghi lại, ôn thêm hoặc chuẩn bị "câu cứu nguy".

> ⚠️ **Nhắc số liệu:** kế hoạch ghi 16/16 script (11/06), lần chạy 14/06 ghi 14/14 — **chạy lại trước ngày phản biện và lấy con số mới nhất**, đừng đọc số cũ.
