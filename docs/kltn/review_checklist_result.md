# Kết quả rà soát KLTN (vai trò hội đồng phản biện)

> **Tài liệu được rà:** `docs/kltn/` — `abstract.md`, `chapter_01.md`, `chapter_02.md`,
> `chapter_03.md`, `chapter_04.md`, `chapter_06.md`, `01_outline.md`, `00_project_analysis.md`,
> `figures/chapter_03_figures.md`.
> **Chuẩn đối chiếu:** `00_project_analysis.md` §6 (đã hiện thực) / §7 (còn thiếu) là nguồn sự thật về source;
> `01_outline.md` cho cấu trúc, danh sách hình/bảng ⭐, quy ước đánh số và ngân sách trang §0.1.
> **Nguyên tắc:** chỉ ĐỌC và BÁO CÁO, không chỉnh sửa file nội dung.

---

## (1) TÓM TẮT ĐIỀU HÀNH

> **Ghi chú cập nhật 10/06/2026:** Các nhận định cũ trong checklist cho rằng CAN chỉ nằm ở hướng phát triển
> đã được thay thế bởi implementation `src/js/can.js` và bộ test CAN. Phạm vi hiện tại là frame/message qua
> MMIO, không phải mô phỏng bit-level/physical-layer đầy đủ.
>
> ⚠️ **PHẠM VI ĐỢT NÀY: KHÔNG GỒM CHƯƠNG 5.** Chương 5 (`chapter_05.md`) đang làm lại phần kiểm
> chứng nên không được đọc/không bị báo lỗi. Mọi vấn đề chỉ phát sinh do phụ thuộc nội dung Chương 5
> được đưa vào mục (4), KHÔNG tính là lỗi.

**Đánh giá tổng quan:** Bản thảo có chất lượng học thuật tốt và **đặc biệt kỷ luật về tính trung thực** —
đây là điểm mạnh nổi bật. Cả bộ "bất biến trung thực" (tập con RV32IMF; chưa có CSR/đặc quyền; chưa đủ
FCSR/fflags/frm; `fence` mã hóa nhưng chưa thực thi; TileLink chỉ A/D mức giao dịch, không B/C/E/TL-C;
điều phối bus một-giao-dịch chứ chưa phải phân xử đa master; chưa có IRQ — chỉ đọc thăm dò; AMOADD.W là
RV32A ngoài tên đề tài; CAN chỉ ở mức frame/message qua MMIO; chưa có benchmark định lượng) được giữ **nhất quán
xuyên suốt** abstract → Ch1 → Ch2 → Ch3 → Ch4 → Ch6. **Không phát hiện overclaim hay mâu thuẫn với
source.** Các số liệu kỹ thuật (cache L1/L2, MMU/TLB, memory map, latency) **trùng khớp** giữa các chương
và với analysis.

**Tổng số vấn đề (không tính Chương 5):**

| Mức độ | Số lượng | Ghi chú |
|---|---|---|
| Nghiêm trọng | 0 | Không có lỗi sai sự thật/overclaim/mâu thuẫn source. (Xem lưu ý ở "Top việc phải sửa" về 2 hạng mục cấu trúc có thể nâng mức tùy yêu cầu Khoa.) |
| Trung bình | 8 | Thiếu mục cấu trúc; hình mồ côi (Ch3); thuật ngữ/chỉ số không nhất quán (IPS); tham chiếu tài liệu nội bộ; citation công cụ. |
| Nhẹ | 9 | Viết tắt chưa giải nghĩa lần đầu; bảng không số; câu dài; mật độ chú thích source; việc đóng quyển. |

**Top việc PHẢI sửa trước khi nộp (ưu tiên giảm dần):**

1. **Bổ sung mục "Phân công công việc" (Lộc/Khang) + Bảng 1.3** — KLTN hai sinh viên, outline §1.3.3 đã
   dự kiến nhưng Ch1 hiện **không có**. *Nếu mẫu/Khoa bắt buộc mục phân công cho KLTN nhóm thì đây là
   thiếu phần bắt buộc (nâng lên Nghiêm trọng).* Nội dung phân công xem mục (3).
2. **Bổ sung Phụ lục A–E** (Ch4 §4.1.3 đã dẫn "Phụ lục A" cho bảng mã hóa đầy đủ) và **Danh mục từ viết
   tắt** (outline §0 yêu cầu). Hiện chưa có file nào trong phạm vi rà.
3. **Thống nhất chỉ số IPS** giữa Ch3 §3.4.1 ("số lệnh/chu kỳ trên giây") và Ch4 §4.8 ("số chu kỳ…/giây,
   Hz") — tên viết tắt IPS (instructions/sec) chưa khớp với đại lượng thực đo (cycles/sec).
4. **Ch3: thêm câu dẫn hình trong văn bản** cho Hình 3.1, 3.3, 3.4, 3.5, 3.6, 3.7 (hiện chỉ Hình 3.2 được
   dẫn) — tránh "hình mồ côi"; đồng bộ với cách làm ở Ch2/Ch4.
5. **Thay tham chiếu "mục 7 trong phân tích phạm vi"** (Ch2 ×2) — đây là tài liệu nội bộ
   `00_project_analysis.md`, không thuộc báo cáo; nên trỏ về §1.3.2/§6.2.
6. **Đối chiếu Bảng 4.8 (DMA)** — bit 2 và bit 30 cùng nhãn "hoàn tất (done)"; kiểm tra với `src/js/dma.js`.

---

## (2) BẢNG CHÍNH

> "Mức độ": **Nghiêm trọng** = sai sự thật/mâu thuẫn source/overclaim/thiếu phần bắt buộc ·
> **Trung bình** = thiếu citation, hình–bảng mồ côi, không nhất quán số liệu/thuật ngữ ·
> **Nhẹ** = chính tả, văn phong, câu dài, lạm dụng heading cấp 4, việc đóng quyển.
> "Nhóm" theo 8 nhóm kiểm tra của đề bài.

### Mức Trung bình

| # | Vấn đề | Vị trí | Nhóm | Mức độ | Cách sửa đề xuất |
|---|---|---|---|---|---|
| 1 | **Thiếu mục "Phân công công việc" + Bảng 1.3.** KLTN hai sinh viên (Lộc, Khang); outline §1.3.3 dự kiến mục này và Bảng 1.3, nhưng Ch1 không có (cấu trúc dừng ở Bảng 1.2). | `chapter_01.md` (mục 1.x) | 1 | Trung bình *(có thể là Nghiêm trọng nếu Khoa bắt buộc)* | Bổ sung mục phân công + Bảng 1.3 sau khi chốt phần việc của từng SV (xem mục (3)). |
| 2 | **Phụ lục A–E chưa có file**, trong khi Ch4 §4.1.3 dẫn "đặt ở Phụ lục A" (bảng mã hóa opcode/funct đầy đủ). | `chapter_04.md:103`; thiếu file phụ lục | 1 | Trung bình | Viết Phụ lục A–E theo outline §Phụ lục; trước khi có, không để tham chiếu "Phụ lục A" treo. |
| 3 | **Chưa có "Danh mục từ viết tắt".** Outline §0 yêu cầu; nhiều viết tắt rải rác trong các chương (xem Nhóm 7). | Toàn bộ (front matter) | 1, 7 | Trung bình | Lập danh mục viết tắt theo outline §0; đồng bộ với lần giải nghĩa đầu tiên. |
| 4 | **Chỉ số IPS không nhất quán.** Ch3 §3.4.1 giải nghĩa "(IPS — số lệnh/chu kỳ trên giây)"; Ch4 §4.8 nói chỉ số này "phản ánh số chu kỳ mô phỏng…trên mỗi giây" (đơn vị Hz). Tên IPS (instructions/sec — outline §0) chưa khớp đại lượng thực đo (cycles/sec). | `chapter_03.md:194` ↔ `chapter_04.md:497` | 3, 7 | Trung bình | Chọn một định nghĩa nhất quán (đại lượng + đơn vị) cho IPS, dùng lại ở cả hai chương và danh mục viết tắt. |
| 5 | **Hình "mồ côi" ở Ch3.** Chỉ Hình 3.2 được dẫn trong câu văn ("Hình 3.2 minh họa…", dòng 60); Hình 3.1, 3.3, 3.4, 3.5, 3.6, 3.7 chỉ xuất hiện dạng placeholder `[Hình 3.x: …]`, không có câu dẫn. Khác với Ch2/Ch4 (mọi hình đều có câu "Hình x.y minh họa…"). | `chapter_03.md` (§3.1.3, 3.3.1, 3.3.2, 3.4.1, 3.4.2, 3.5) | 4 | Trung bình | Thêm câu dẫn + một câu phân tích cho từng hình, đồng bộ phong cách Ch2/Ch4. |
| 6 | **Bảng 4.8 (DMA) trùng nhãn.** Bit 2 và bit 30 của CTRL(đọc) cùng ghi "hoàn tất (done)". | `chapter_04.md:355` (Bảng 4.8, dòng bit 2 và 30) | 3, 4 | Trung bình | Đối chiếu `src/js/dma.js`; sửa nhãn bit đúng (một trong hai có thể là cờ khác). |
| 7 | **Tham chiếu tài liệu nội bộ trong báo cáo.** Hai chỗ ghi "(xem mục 7 trong phân tích phạm vi)" trỏ tới `00_project_analysis.md` §7 — không phải phần của báo cáo. | `chapter_02.md:140`, `chapter_02.md:243` | 6 | Trung bình | Thay bằng tham chiếu nội bộ báo cáo: §1.3.2 (phạm vi/giới hạn) hoặc §6.2 (hạn chế). |
| 8 | **Công cụ chưa được cấp số trích dẫn.** "GNU RISC-V binutils" và "riscv-tests" được nhắc bằng tên trong abstract/Ch1/Ch6 nhưng chưa có `[n]` trong các chương phạm vi (Spike đã là [5]). | `abstract.md:9`, `chapter_01.md:122`, `chapter_06.md:21` | 6 | Trung bình *(một phần phụ thuộc Ch5 — xem (4))* | Cấp số IEEE cho GNU binutils và riscv-tests (hoặc xác nhận đã cấp ở Ch5) và dùng lại nhất quán. |

### Mức Nhẹ

| # | Vấn đề | Vị trí | Nhóm | Mức độ | Cách sửa đề xuất |
|---|---|---|---|---|---|
| 9 | **Viết tắt FIFO chưa giải nghĩa** "First-In First-Out" ở lần xuất hiện đầu. | `chapter_04.md:353` (và 362–371) | 7 | Nhẹ | Giải nghĩa FIFO ở lần đầu; thêm vào danh mục viết tắt. |
| 10 | **UART, LED xuất hiện lần đầu chưa giải nghĩa.** Lần đầu ở Ch1 (Bảng 1.1 / §1.3.2) chưa mở ngoặc; chỉ giải nghĩa ở Ch2 §2.8. | `chapter_01.md:48`, `chapter_01.md:110` | 7 | Nhẹ | Giải nghĩa ở lần đầu (Ch1) hoặc chấp nhận là thuật ngữ phổ biến nhưng vẫn đưa vào danh mục viết tắt. |
| 11 | **Bảng không đánh số ở Ch4.** Hai bảng cấu trúc thư mục (src/, test/) và bảng "Các loại định dạng lệnh" là bảng không số. | `chapter_04.md:9–23, 25–33, 105–120` | 4 | Nhẹ | Cân nhắc đánh số (Bảng 4.x) cho bảng định dạng lệnh; bảng cấu trúc thư mục có thể giữ là phụ trợ. |
| 12 | **Quy ước caption Hình cho bản dựng cuối.** Hình hiện ở dạng mô tả `[Hình x.y: …]` đặt trong dòng; bản in cuối cần đặt **caption Hình ở DƯỚI** ảnh (caption Bảng đã đặt TRÊN — đúng). | Toàn bộ chương có hình | 4 | Nhẹ | Khi dựng Word/LaTeX, đặt caption hình bên dưới ảnh; phân biệt mô tả-cách-vẽ với caption chính thức. |
| 13 | **Câu quá dài.** Một số câu liệt kê dài khó theo dõi (vd câu liệt kê toàn bộ thành phần). | `abstract.md:7`; `chapter_01.md:9,13` | 8 | Nhẹ | Tách thành 2–3 câu hoặc dùng gạch đầu dòng. |
| 14 | **Mật độ chú thích "(xem source: …)" dày** trong thân bài (Ch3, Ch4) — đọc nặng cho bản in chính thức. | `chapter_03.md`, `chapter_04.md` (nhiều chỗ) | 8 | Nhẹ | Cân nhắc chuyển một phần thành chú thích cuối trang hoặc bảng ánh xạ ở Phụ lục; giữ vài chỗ chốt trong thân bài. |
| 15 | **Hình 1.1 (ý niệm SoC, outline §1.1.1, không ⭐) bị lược** khỏi Ch1. | `chapter_01.md` §1.1.1 | 1, 4 | Nhẹ (info) | Chấp nhận được (trùng Hình 2.1); chỉ ghi nhận, không bắt buộc bổ sung. |
| 16 | **Front matter và Tài liệu tham khảo hợp nhất chưa có file.** Mỗi chương có danh mục riêng kèm ghi chú "sẽ hợp nhất". | Toàn bộ | 1, 6 | Nhẹ (đóng quyển) | Khi đóng quyển: dựng mục lục, danh mục hình/bảng/viết tắt và TLTK hợp nhất chuẩn IEEE. |
| 17 | **Outline đánh số TLTK lệch với chương** ([8]=IEEE754, [9]=KLTN trước, [10]=riscv-tests trong outline; còn chương dùng [8]=KLTN trước, [9]=IEEE754). Các chương **nhất quán nội bộ** nên không phải lỗi chương. | `01_outline.md:509–513` vs các chương | 6 | Nhẹ (info) | Khi hợp nhất TLTK, theo sơ đồ số của các chương; cập nhật outline cho khỏi nhầm về sau. |

---

## (3) CẦN TÁC GIẢ XÁC NHẬN *(không tính là lỗi)*

1. **Log verification chính thức (GNU binutils / Spike / riscv-tests):** số lệnh đối chiếu/bỏ qua, số tệp
   đạt/không đạt, phiên bản công cụ và commit `riscv-tests`. Hiện để placeholder `[CẦN BỔ SUNG KẾT QUẢ
   THỰC NGHIỆM]` ở `abstract.md:9` và `chapter_06.md:19` (và trong Ch5 — ngoài phạm vi). *Cách bổ sung:
   chỉ điền log/ảnh thực nghiệm thật, không điền số liệu mẫu.*
2. **Phân công công việc Lộc/Khang:** cần chốt để viết mục phân công + Bảng 1.3 (liên quan việc PHẢI sửa #1).
3. **Chi tiết KLTN khóa trước [8] (Nguyễn Gia Bảo Ngọc, 2025)** dùng trong Bảng 1.1: ví dụ cột "KLTN 2025"
   ghi có MMU nhưng (ngầm) không có cache, có TileLink/DMA, ngoại vi chỉ LED. Cần đối chiếu toàn văn [8]
   để bảo đảm đúng (outline §0.10 ghi hiện mới trích được mục lục + danh mục viết tắt của [8]).
4. **URL triển khai web:** Ch1 §1.4 (`chapter_01.md:132`) nói "định hướng triển khai dưới dạng ứng dụng web
   công khai"; README có `https://risc-v.vercel.app`. Nếu đưa URL vào báo cáo, xác nhận URL còn hoạt động
   và phiên bản đang deploy.
5. **Hằng số UART** (Ch4 §4.6.2, `chapter_04.md:419`): tần số ngoại vi 48 MHz, oversampling 16, hệ số chia
   mặc định 26 (≈115200 baud — phép tính khớp), tần số CPU 100 MHz. Outline §4.6.2 đã gắn ⚠️ — đối chiếu
   lại `src/js/uart.js`.
6. **Bảng 4.8 (DMA):** bit 2 và bit 30 cùng nhãn "done" — đối chiếu `src/js/dma.js` (liên quan việc sửa #6).
7. **Làm tròn dấu phẩy động:** Ch4 §4.2.3 (`chapter_04.md:212`) ghi "chế độ rne dùng `Math.round`". Trong
   JavaScript `Math.round` làm tròn nửa-lên, không phải "ties-to-even"; xác nhận cách hiện thực rounding
   (báo cáo đã nêu chưa kiểm chứng bit-exact, nên đây là điểm cần xác nhận, không kết luận là lỗi).
8. **Material Components Web [15]:** Ch4 §intro (`chapter_04.md:7`) nói UI dùng "Material Components Web +
   Material Icons" qua CDN. Analysis không nêu (cũng không mâu thuẫn) — đối chiếu `src/index.html`.

---

## (4) CẦN RÀ LẠI SAU KHI HOÀN THIỆN CHƯƠNG 5 *(điểm bị hoãn do phụ thuộc Chương 5)*

1. **Phát biểu kiểm chứng trong Tóm tắt và 6.1.** `abstract.md:9` và `chapter_06.md:19` khẳng định "kiểm
   thử đơn vị… đã đạt kết quả cho assembler, MMU, TileLink, DMA" (được analysis §6.9 hậu thuẫn) kèm
   placeholder cho số liệu đối chiếu GNU/Spike. Khi Ch5 §5.2–5.4 hoàn thiện, đối chiếu lại để câu chữ
   trong Tóm tắt/6.1 khớp với kết quả Ch5.
2. **Tham chiếu "mục 5.8".** `chapter_06.md:25` dẫn "các nhận định rút ra từ kiểm thử ở mục 5.8" — tạm hoãn
   đối chiếu Bảng 1.2/§6.2 ↔ §5.8 cho tới khi Ch5 xong.
3. **Đánh số trích dẫn liên quan Ch5.** Có khoảng trống [16], [17] giữa [15] (Ch4) và [19] (CAN, Ch4/Ch6).
   Cần xác nhận [16]–[18] được định nghĩa ở Ch5 và [19] là
   số kế tiếp đúng; đồng thời xác nhận GNU binutils/riscv-tests (mục (2)#8) có được cấp số ở Ch5 hay không.
4. **Hình/bảng ⭐ thuộc Ch5** (Hình 5.1 Quy trình kiểm thử; Bảng 5.1 Danh sách test case; Bảng 5.3 Đối
   chiếu Spike) — ngoài phạm vi đợt này; kiểm khi hoàn thiện Ch5.

---

## (5) PHỤ LỤC — DANH SÁCH PLACEHOLDER/TODO CÒN LẠI *(các file trong phạm vi, không quét Ch5)*

**Placeholder cố ý (đã đánh dấu nhất quán — chỉ chờ điền dữ liệu thật):**

| Dấu | Vị trí | Nội dung chờ |
|---|---|---|
| `[CẦN BỔ SUNG KẾT QUẢ THỰC NGHIỆM]` | `abstract.md:9`, `chapter_06.md:19` | Số liệu định lượng đối chiếu GNU/Spike + log chính thức (chỉ điền log/ảnh thật). |
| `[CẦN BỔ SUNG TÀI LIỆU THAM KHẢO]` | `chapter_01.md:13` | Citation cho phát biểu "công cụ trực quan hỗ trợ dạy/học". |
| `[CẦN NGUỒN]` | `chapter_02.md:37` | Citation cho phát biểu về đánh đổi giữa các mức mô phỏng. |

**Ghi chú "(cần ghi rõ… khi hoàn thiện)" trong danh mục tài liệu tham khảo** (rải ở Ch1/Ch2/Ch4/Ch6):

- `[6]` RISC-V ISA manual — cần phiên bản & năm. (`chapter_01.md:171`, `chapter_02.md:296`, `chapter_03.md:234`, `chapter_04.md:524`, `chapter_06.md:65`)
- `[7]` TileLink spec — ghi chú tài liệu tham chiếu nội bộ. (các chương)
- `[9]` IEEE 754 — cần thông tin xuất bản đầy đủ. (Ch1/Ch2/Ch4/Ch6)
- `[10]` Patterson & Hennessy COD — cần phiên bản & năm. (`chapter_02.md:304`, `chapter_04.md:530`)
- `[12]` CodeMirror, `[13]` MDN — cần phiên bản/ngày truy cập. (Ch2/Ch4)
- `[14]` RARS, `[15]` Material Components Web — cần ngày truy cập/phiên bản. (`chapter_04.md:538`, `chapter_04.md:540`)
- `[19]` CAN — đã xác nhận từ PDF local: Robert Bosch GmbH, *M_CAN Controller Area Network User's Manual*, Revision 3.3.1, 11/03/2023.
- `[1]`–`[5]` (Ch1) — ghi chú "cần rà soát lại định dạng và ngày truy cập khi hoàn thiện". (`chapter_01.md:159`)

**Hạng mục cấu trúc cần hoàn tất trước khi đóng quyển:** mục Phân công công việc + Bảng 1.3; Phụ lục A–E;
Danh mục từ viết tắt; mục lục + danh mục hình/bảng; Tài liệu tham khảo hợp nhất chuẩn IEEE.

---

## GHI CHÚ THEO TỪNG NHÓM KIỂM TRA

- **Nhóm 1 — Cấu trúc:** Có đủ Tóm tắt (abstract, kèm Abstract tiếng Anh tùy chọn), Tổng quan (Ch1), Cơ sở
  lý thuyết (Ch2), Phân tích–Thiết kế (Ch3), Hiện thực (Ch4), Kết luận + Hạn chế + Hướng phát triển (Ch6).
  Chương 5 (Kiểm thử–Đánh giá) **tồn tại** (`chapter_05.md`) — ghi nhận sự tồn tại, không rà nội dung.
  **Vấn đề:** thiếu mục Phân công công việc/Bảng 1.3, thiếu Phụ lục, thiếu Danh mục viết tắt, chưa có front
  matter/TLTK hợp nhất (xem bảng chính #1, #2, #3, #16). Ngân sách trang: ước lượng sơ bộ các chương ~khớp
  outline §0.1 (không đo chính xác được từ markdown); Ch1 có thể hụt nhẹ do thiếu mục phân công. Việc Ch1
  tái cấu trúc thành 1.1–1.6 (thay vì gộp trong 1.3 như outline) là hợp lý, **không phải lỗi**.
- **Nhóm 2 — Trung thực & đúng source: KHÔNG PHÁT HIỆN VẤN ĐỀ.** Không có overclaim/mâu thuẫn source; toàn
  bộ bất biến trung thực được giữ nhất quán (đã liệt kê ở mục (1)). Nhãn UI "coherent bus" được chú thích
  trung thực ở Ch3 §3.2.1, Ch4 §4.4.3/§4.7.1 và `figures/chapter_03_figures.md`. (Một điểm kỹ thuật nhỏ về
  `Math.round`/rne đã chuyển sang mục (3)#7 để tác giả xác nhận, không kết luận là lỗi.)
- **Nhóm 3 — Nhất quán liên chương:** Số liệu kỹ thuật **trùng khớp** (cache L1/L2 16×4×64B=4KB &
  64×4×64B=16KB, hit/miss 1/5 & 2/10; MMU trang 4096B, TLB 8 mục/4 way/2 set/LRU; latency bộ nhớ 20 chu kỳ;
  memory map UART `0x10000000`, LED `0xFF000000`, Mouse `0xFF100000`, DMA `0xFFED0000`, Keyboard
  `0xFFFF0000`; `.text`=`0x00400000`, `.data`=`0x10010000`). Đóng góp khớp giữa §1.5 ↔ abstract ↔ §6.1 (4
  đóng góp). Mục tiêu kỹ thuật §1.2.2.1–§1.2.2.5 được truy vết đủ trong §6.1. Phạm vi Bảng 1.2 ↔ §6.2 nhất
  quán. **Vấn đề duy nhất:** chỉ số IPS không nhất quán Ch3↔Ch4 (#4).
- **Nhóm 4 — Hình & bảng (không xét Ch5):** Đủ các hình/bảng ⭐ ngoài Ch5 (Hình 3.2/3.5/3.7, 4.3/4.8/4.10/
  4.11; Bảng 1.1, 2.3, 3.2, 3.3, 4.9). Đánh số liên tục, không trùng/nhảy. Caption Bảng đặt TRÊN (đúng).
  **Vấn đề:** hình mồ côi ở Ch3 (#5), Bảng 4.8 trùng nhãn (#6), bảng không số ở Ch4 (#11), quy ước caption
  hình cho bản dựng cuối (#12).
- **Nhóm 5 — Heading: KHÔNG PHÁT HIỆN VẤN ĐỀ.** Mọi chương dùng tối đa 3 cấp heading markdown (`#` / `##` /
  `###`); **không có heading cấp 4**. Mục 1.2.2.1–1.2.2.5 được viết dưới dạng **đoạn đánh số** (không phải
  heading) — đúng khuyến nghị của outline (tránh heading cấp 4). Không có mục quá ngắn/dài bất thường.
- **Nhóm 6 — Trích dẫn:** Đánh số `[n]` **nhất quán xuyên chương**: [6]=RISC-V ISA, [7]=TileLink, [8]=KLTN
  khóa trước, [9]=IEEE 754, [10]=Patterson COD, [11]=Hennessy CA, [12]=CodeMirror, [13]=MDN, [14]=RARS,
  [15]=Material Components Web, [19]=CAN (được trích ở Ch4/Ch6). Mỗi chương chỉ liệt kê nguồn thực sự trích — tốt.
  **Vấn đề:** tham chiếu tài liệu nội bộ "phân tích phạm vi" (#7), GNU binutils/riscv-tests chưa cấp số
  (#8), outline lệch số (#17); khoảng trống [16]/[17] phụ thuộc Ch5 (mục (4)#3).
- **Nhóm 7 — Danh mục từ viết tắt:** Phần lớn viết tắt giải nghĩa ở lần đầu (SoC, ISA, RISC/CISC, ALU, FPU,
  MMU, TLB, VPN/PPN/PTE, MMIO, DMA, LRU, TL-UL/UH/C, CSR, FCSR/fflags/frm, IEEE 754, SPA, DOM, CDN, ES
  module — đạt). **Vấn đề:** chưa có Danh mục viết tắt (#3); FIFO chưa giải nghĩa (#9); UART/CAN/LED chưa giải
  nghĩa ở lần đầu tại Ch1 (#10); IPS chưa định nghĩa nhất quán (#4).
- **Nhóm 8 — Văn phong:** Tiếng Việt học thuật, trang trọng, **không dùng ngôi thứ nhất** ("em/tôi") —
  đạt. Không phát hiện lỗi chính tả rõ. Lặp ý có (cảnh báo phạm vi lặp giữa §1.3.2/§2.6.3/§6.2) nhưng **chủ
  ý và phù hợp** cho một KLTN trung thực — không tính lỗi. **Vấn đề nhẹ:** vài câu quá dài (#13); mật độ
  chú thích "(xem source:)" dày (#14).
