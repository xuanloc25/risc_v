# Ghi chú thuyết trình phản biện — từng slide + ngân hàng câu hỏi

> Dùng kèm deck Canva (22 slide, bám mẫu Khoa KTMT-UIT). Mỗi mục dưới đây là **lời thoại gợi ý** cho slide tương ứng — copy vào ô **Notes** của PowerPoint, rồi tinh gọn lại.
> Phản biện ~1 tiếng, **hệ số 2**, chưa chấm điểm nhưng định hình điểm yếu cần sửa trước bảo vệ. Nguyên tắc xuyên suốt: **chủ động nêu phạm vi trung thực trước khi bị hỏi.**
> Cập nhật 14/06/2026. Số liệu lấy từ [kich_ban_danh_gia.md](kich_ban_danh_gia.md) và lần chạy kiểm chứng 14/06.

---

## PHẦN MỞ ĐẦU

### Slide 1 — Trang bìa
**Cần điền:** tên đề tài chính xác, GVHD, họ tên + MSSV 2 SV.
**Lời thoại (~20s):** "Em chào thầy/cô. Em là [tên], cùng với [tên] thực hiện khóa luận *[tên đề tài]* dưới sự hướng dẫn của [GVHD]. Hôm nay nhóm em xin trình bày phần phản biện. Đề tài xây dựng một trình mô phỏng SoC RISC-V chạy trực tiếp trên trình duyệt, phục vụ giảng dạy Kiến trúc máy tính."

### Slide 2 — Nội dung báo cáo
**Lời thoại (~15s):** "Báo cáo gồm 4 phần theo mẫu của Khoa: tổng quan đề tài; giải pháp đề xuất; kết quả; và kết luận–hướng phát triển. Cuối cùng là phần hỏi đáp và phụ lục giải thích chi tiết."
**Mẹo:** nói nhanh, đây chỉ là slide bản lề.

---

## PHẦN 01 — TỔNG QUAN

### Slide 3 — Divider 01
Chỉ đọc tiêu đề phần, chuyển slide.

### Slide 4 — Bối cảnh & vấn đề
**Lời thoại (~45s):** "Khi học Kiến trúc máy tính, sinh viên cần *thấy* được dữ liệu di chuyển thế nào trong một SoC: từ CPU qua MMU, cache, lên bus, tới bộ nhớ và các ngoại vi. Các công cụ phổ biến như RARS hay Ripes rất tốt cho CPU và pipeline, nhưng ít trực quan hóa *toàn bộ* SoC — đặc biệt là MMU, cache nhiều cấp, bus, DMA và ngoại vi ánh xạ bộ nhớ. Còn các mô phỏng SoC đầy đủ như Spike hay gem5 thì cài đặt phức tạp và không chạy ngay trên trình duyệt. Vì vậy, vấn đề đặt ra là: cần một công cụ chạy ngay trên web, trực quan hóa toàn bộ SoC, phục vụ dạy và học."
**Có thể bị hỏi:** "RARS/Ripes đã có rồi, đề tài khác gì?" → trả lời ở Slide 5.

### Slide 5 — Khảo sát & tính mới
**Lời thoại (~50s):** "Nhóm em khảo sát RARS, Ripes, QtRvSim và Spike (bảng so sánh chi tiết ở phụ lục). Điểm chung là chúng tập trung vào CPU/pipeline hoặc cần cài đặt. Đề tài cũng kế thừa và phát triển từ khóa luận trước của bạn Nguyễn Gia Bảo Ngọc năm 2025. Điểm mới của nhóm em: (1) chạy 100% trên trình duyệt, không cài đặt; (2) trực quan hóa datapath *sống* — sơ đồ bus động, log lọc theo từng module, bảng TLB và cache cập nhật theo thời gian thực; (3) tích hợp cả assembler, CPU và toàn SoC trong một công cụ thống nhất."
**Lưu ý trung thực:** nếu hỏi so với KLTN 2025 cụ thể khác gì, nói rõ phần mình bổ sung/cải tiến (bus TileLink UL/UH + bridge, DMA descriptor/backpressure, MMU+syscall, kiểm chứng 3 lớp với GNU/Spike). Đừng overclaim.

### Slide 6 — Mục tiêu & Phạm vi (TRUNG THỰC)
**Đây là slide quan trọng nhất phần 1 — chủ động "rào" phạm vi.**
**Lời thoại (~60s):** "Mục tiêu là xây dựng đầy đủ chuỗi: assembler, CPU RV32IMF, MMU, cache L1/L2, bus TileLink UL/UH, DMA và các ngoại vi, chạy trên web và trực quan hóa. Nhóm em xin nêu rõ phạm vi một cách trung thực ngay từ đầu: RV32IMF ở đây là *tập con* — chưa có CSR, chưa có chế độ đặc quyền, và *chưa có ngắt* nên mọi ngoại vi giao tiếp bằng thăm dò (polling). Lệnh `fence` được mã hóa đúng nhưng CPU chưa thực thi. FPU chưa đủ FCSR/fflags/frm. Bus TileLink chỉ ở mức giao dịch kênh A/D, chưa có B/C/E và chưa có coherence. `AMOADD.W` là lệnh RV32A duy nhất, nằm ngoài tên đề tài, nhóm giữ theo thống nhất với thầy hướng dẫn. MMU tối giản 4KB fully-associative. Ngoại vi CAN mới ở mức khung (frame), nhóm tạm gác đợt này."
**Vì sao nói trước:** mọi câu hỏi "đã làm X chưa?" sẽ được trả lời sẵn → giảng viên thấy nhóm hiểu rõ giới hạn của mình.

---

## PHẦN 02 — GIẢI PHÁP

### Slide 7 — Divider 02
Đọc tiêu đề, chuyển.

### Slide 8 — Kiến trúc tổng thể SoC
**Cần chèn hình:** `docs/kltn/figures/fig_3_2_soc_simulator_architecture.svg` (hoặc fig_2_1_soc_block).
**Lời thoại (~50s):** "Đây là kiến trúc tổng thể. Một truy cập của CPU đi qua MMU để dịch địa chỉ, xuống cache L1 rồi L2, ra bus TileLink-UH tới bộ nhớ chính. Khi truy cập ngoại vi, giao dịch rẽ qua cầu nối UH sang UL tới thiết bị. Bản đồ bộ nhớ: LED ở 0xFF000000, UART ở 0x10000000, chuột, bàn phím và thanh ghi DMA ở các vùng riêng. Mô hình chạy theo từng chu kỳ; vì chưa có ngắt nên CPU đồng bộ với thiết bị bằng polling."
**Có thể bị hỏi:** "Vì sao tách UL và UH?" → UH cho đường bộ nhớ hiệu năng cao (burst), UL cho ngoại vi đơn giản; bridge nối hai miền.

### Slide 9 — CPU RV32IMF & Assembler
**Cần chèn hình:** fig_4_1_two_pass_assembler.svg, fig_4_3_rv32imf_cpu_core.svg.
**Lời thoại (~50s):** "Assembler hoạt động hai lượt (two-pass): lượt một thu thập nhãn, lượt hai sinh mã — nhờ vậy xử lý được cả nhãn tham chiếu tới phía trước. Nó mở rộng các pseudo-instruction như `li`, `la`, `call`, `ret`. Một điểm thiết kế nhóm em tâm đắc: bảng mã lệnh (opcode) được *dùng chung* trong file isa.js cho cả assembler, CPU và phần tô màu cú pháp — nên ba nơi này luôn nhất quán 100%. CPU chạy chu trình fetch–decode–execute, hỗ trợ các nhóm lệnh số nguyên, nhân/chia và dấu phẩy động."
**Có thể bị hỏi:** "Làm sao chắc assembler đúng?" → "Đối chiếu với GNU binutils, sẽ trình bày ở phần kết quả."

### Slide 10 — MMU & Cache
**Cần chèn hình:** fig_4_5_mmu_translation_path.svg, fig_4_6_cache_hierarchy.svg.
**Lời thoại (~50s):** "MMU dịch địa chỉ ảo sang vật lý; khi chưa có ánh xạ thì rơi về chế độ identity (địa chỉ ảo bằng địa chỉ vật lý) để chương trình bare-metal vẫn chạy. TLB 8 entry, fully-associative, thay thế theo LRU, kiểm tra quyền đọc/ghi/thực thi và tính cacheable. Việc tạo/xóa ánh xạ thực hiện qua syscall. Cache: L1 lệnh và L1 dữ liệu 16 set 4 way, L2 64 set 4 way, block 64 byte, ghi xuyên (write-through). Vùng MMIO được đánh dấu non-cacheable và bypass cache để lệnh ghi thiết bị có hiệu lực ngay."
**Bẫy cần biết:** lớp test có cấu hình `tlbWays:2` để kiểm LRU — nhưng *cấu hình SoC thật* hardcode fully-associative. Nếu bị soi, giải thích: class MMU tổng quát hơn để kiểm chứng được, còn SoC dùng cấu hình tối giản theo yêu cầu GVHD.

### Slide 11 — TileLink & DMA
**Cần chèn hình:** fig_4_7_tilelink_a_d_frame.svg, fig_4_10_dma_transfer_flow.svg.
**Lời thoại (~55s):** "Bus TileLink dùng hai kênh: kênh A mang yêu cầu, kênh D mang phản hồi — đúng mức giao dịch. Cầu nối UH–UL hoạt động hai chiều. UH hỗ trợ burst nhiều beat, với ràng buộc số beat là lũy thừa của 2. DMA được lập trình bằng một descriptor 3 từ (nguồn, đích, cấu hình), có hai FIFO đọc và ghi *độc lập*, copy được RAM–RAM hoặc RAM ra ngoại vi. Một điểm nhóm em xử lý kỹ là *backpressure*: khi FIFO phát của UART đầy, DMA sẽ giữ giao dịch lại thay vì làm tràn — nhờ vậy không mất byte nào, kể cả khi DMA nhanh hơn tốc độ phát của UART."
**Số liệu mạnh:** trước khi có backpressure, gửi 65 byte chỉ ra được ~16; sau khi sửa: đủ 65/65, 0 mất.

### Slide 12 — Ngoại vi & Giao diện web
**Cần chèn:** ảnh chụp giao diện (app screenshot).
**Lời thoại (~45s):** "Các ngoại vi đều ánh xạ bộ nhớ: UART có baud cấu hình qua divisor, LED Matrix 32×32 dạng VRAM, chuột và bàn phím — tất cả đọc bằng polling. Giao diện web gồm trình soạn thảo có gợi ý lệnh, bảng thanh ghi và bộ nhớ, sơ đồ SoC *sống* hiển thị giao dịch chạy trên bus, bảng cache và TLB, và một bảng log hệ thống lọc được theo từng module — CPU, MMU, cache, bus, DMA, I/O. Toàn bộ chạy trực tiếp trên trình duyệt."

---

## PHẦN 03 — KẾT QUẢ

### Slide 13 — Divider 03
Đọc tiêu đề, chuyển.

### Slide 14 — Phương pháp kiểm chứng 3 lớp
**Cần chèn hình:** `docs/kltn/figures/fig_5_1_verification_dashboard.png` (dashboard tổng quan).
**Lời thoại (~50s):** "Nhóm em kiểm chứng theo ba lớp bổ trợ nhau. Lớp một là kiểm thử đơn vị từng mô-đun bằng Node.js. Lớp hai là đối chiếu *mã hóa lệnh* với GNU binutils — công cụ chuẩn — trên bộ test ISA chính thức riscv-tests. Lớp ba là đối chiếu *thực thi* trên Spike, trình mô phỏng tham chiếu chính thức của RISC-V. Điểm quan trọng: hai lớp ngoài dùng *công cụ và dữ liệu của cộng đồng quốc tế*, nên kết quả khách quan, không phải nhóm tự viết test rồi tự đúng."

### Slide 15 — Kết quả mô phỏng (định lượng)
**Lời thoại (~45s):** "Về số liệu: 14 trên 14 script kiểm thử đơn vị đều đạt, chạy lại trực tiếp ngày 14/06. Đối chiếu với GNU binutils trên 61 file ELF của riscv-tests: 17.978 lệnh trùng khớp, *không có lệnh nào sai*; 1.456 lệnh CSR và đặc quyền nằm ngoài phạm vi được bỏ qua có thống kê. Đối chiếu thực thi trên Spike: 61 trên 61 file đều đạt. Cả ba lớp đều tái lập được ngay trên máy demo — script Node tự động gọi sang môi trường WSL để chạy GNU và Spike."
**Câu chốt mạnh:** "Em có thể chạy lại tại chỗ nếu thầy/cô muốn."

### Slide 16 — Demo / Kết quả hiển thị
**Cần chèn:** ảnh hoặc video demo.
**Lời thoại (~50s):** "Về kết quả hiển thị thực tế: chương trình tô gradient lên ma trận LED 32×32; DMA tự tô một hàng LED trong khi CPU tính toán song song. Với UART, DMA đẩy 65 byte ra và nhờ backpressure không mất byte nào. Với MMU, bảng TLB cập nhật ngay trên màn hình, cho thấy địa chỉ ảo 0x5020 được dịch sang địa chỉ vật lý 0x10010020. Và trên sơ đồ SoC, nhiều đường bus sáng đồng thời với bộ đếm giao dịch tăng liên tục — minh họa toàn hệ đang hoạt động."
**Mẹo demo:** nếu demo trực tiếp, dùng `tools/dev_server.py` (no-cache); demo vòng lặp vô hạn thì kết thúc bằng Stop. Có video dự phòng.

---

## PHẦN 04 — KẾT LUẬN

### Slide 17 — Divider 04
Đọc tiêu đề, chuyển.

### Slide 18 — Kết luận & Đóng góp
**Lời thoại (~45s):** "Kết luận: nhóm em đã hoàn thiện một công cụ mô phỏng SoC RISC-V chạy trên web, trực quan hóa toàn bộ datapath, và kiểm chứng bằng ba lớp với công cụ chuẩn quốc tế — không có sai sót về mã hóa lẫn thực thi trong phạm vi. Đóng góp chính là một công cụ dạy và học Kiến trúc máy tính và Hệ điều hành, mã nguồn mở. Về hạn chế, nhóm em nêu thẳng: chưa có ngắt, CSR và chế độ đặc quyền; bus chưa có coherence; FPU chưa đầy đủ rounding-mode."
**Vì sao nêu hạn chế:** chủ động > bị động. Giảng viên phản biện đánh giá cao sự thành thật.

### Slide 19 — Hướng phát triển
**Lời thoại (~35s):** "Hướng phát triển: bổ sung ngắt và chế độ đặc quyền/CSR; mở rộng TileLink thêm các kênh B/C/E và coherence, phân xử đa master; hoàn thiện FPU và mở rộng ngoại vi CAN; cuối cùng là trực quan hóa pipeline và bổ sung benchmark định lượng hiệu năng."

### Slide 20 — Phân công & Tài liệu tham khảo
**Cần điền:** bảng phân công Lộc/Khang thật (Bảng 1.3 trong báo cáo).
**Lời thoại (~30s):** "Về phân công, [tên] phụ trách [các phần], [tên] phụ trách [các phần], theo tiến độ từng giai đoạn. Tài liệu tham khảo chính gồm đặc tả RISC-V ISA, đặc tả TileLink, bộ riscv-tests, Spike và tài liệu M_CAN."
**Lưu ý:** slide này phục vụ tiêu chí LO7 (lập kế hoạch/quản lý) — đừng bỏ.

### Slide 21 — Hỏi & Đáp / Cảm ơn
**Lời thoại:** "Phần trình bày của nhóm em đến đây là hết. Em cảm ơn thầy/cô đã lắng nghe và rất mong nhận được câu hỏi, góp ý để hoàn thiện trước buổi bảo vệ."

### Slide 22 — Phụ lục (câu hỏi phản biện)
Không trình bày; chỉ mở khi được hỏi. Nội dung chi tiết ở ngân hàng câu hỏi bên dưới.

---

# NGÂN HÀNG CÂU HỎI PHẢN BIỆN (chuẩn bị trả lời)

> In riêng phần này, mỗi người đọc thuộc ý chính. Trả lời ngắn gọn, đúng phạm vi, không vòng vo.

**1. Vì sao chọn TileLink mà không phải AXI hay Wishbone?**
TileLink là giao thức mở, có phân tầng rõ (TL-UL đơn giản cho ngoại vi, TL-UH thêm burst cho bộ nhớ), phù hợp mục tiêu *giáo dục* vì kênh A/D đủ minh họa một giao dịch bus mà không quá phức tạp như AXI (5 kênh). Nhóm em chỉ hiện thực mức giao dịch A/D, chưa làm coherence — đúng phạm vi.

**2. Vì sao dùng polling mà không có ngắt?**
Vì phạm vi đề tài chưa hiện thực cơ chế ngắt (IRQ) và CSR. Mọi ngoại vi và DMA đồng bộ bằng thăm dò trạng thái (đọc thanh ghi STATUS/CTRL). Đây là lựa chọn thiết kế đã nêu rõ, không phải thiếu sót che giấu; ngắt nằm trong hướng phát triển.

**3. Làm sao chắc assembler/CPU đúng?**
Ba lớp: unit test; đối chiếu *mã hóa* với GNU binutils trên riscv-tests (17.978 lệnh, 0 sai); đối chiếu *thực thi* trên Spike (61/61 ELF). Dùng công cụ và dữ liệu chuẩn của cộng đồng → khách quan.

**4. fcvt.w.s(6.5) ra 7 — có phải sai không?**
Không sai về giá trị, nhưng là *giới hạn đã biết*: FPU chưa hiện thực FCSR/frm nên rounding-mode "dyn" rơi vào mặc định làm tròn (Math.round) → 6.5 thành 7. Nếu hiện thực đầy đủ frm với chế độ truncate thì ra 6. Nhóm em nêu thẳng đây là hạn chế.

**5. Vài demo kết thúc với a0 khác 0 — có phải fail?**
Không. Một số demo (dma_demo, dma_led_demo, bus_demo, mmu_syscall_test, test_cache) cố ý dùng a0 làm *dữ liệu* (tổng tính song song, giá trị đọc về) chứ không phải mã lỗi. Tiêu chí đúng của các demo đó là nội dung bộ nhớ/đăng ký khớp kỳ vọng. Các demo dùng quy ước a0=0=PASS là soc_full_demo, demo_uart_dma, led_demo.

**6. Test MMU có tlbWays=2 nhưng báo cáo nói fully-associative — mâu thuẫn?**
Class MMU được viết tổng quát (hỗ trợ set/way) để *kiểm chứng* được cơ chế thay thế LRU. Còn *cấu hình SoC thật* và giao diện thì hardcode 4KB fully-associative theo yêu cầu GVHD. Hai mức khác nhau, không mâu thuẫn — cấu hình production là fully-associative.

**7. Burst của TileLink là thật hay chỉ vòng lặp ghi?**
Là burst thật mức mô hình: một giao dịch Get/PutFullData mang nhiều beat (số beat là lũy thừa 2), thấy rõ trong log "beats=4 (multi-beat)". Test dma_burst_verify xác nhận 4 burst × 4 beat cho 16 word, và bus có độ trễ 2 chu kỳ mỗi giao dịch.

**8. Vì sao tin số 17.978 và 61/61? Có chạy lại được không?**
Có. Hai script `verify_rv32imf_against_gnu.mjs` và `verify_riscv_tests_spike.mjs` tự gọi sang WSL (đã cài GNU toolchain + Spike) và chạy trên 61 ELF của riscv-tests. Em có thể chạy lại tại chỗ; log lưu ở `test-artifacts/eval_run/`.

**9. Cache có chứng minh coherence không?**
Không. Bus một-giao-dịch, chỉ kênh A/D, không có TL-C coherence và chưa phân xử đa master. Cache chỉ chứng minh phân cấp L1/L2, thay thế LRU và tính đúng của write-through cho một master CPU.

**10. Đề tài hai người, ai làm gì?**
[Trả lời theo Bảng 1.3 — điền cụ thể: ai phụ trách assembler/CPU, ai phụ trách MMU/cache/bus/DMA/ngoại vi/giao diện; cả hai cùng làm kiểm chứng.]

**11. So với KLTN 2025 của bạn Bảo Ngọc, nhóm khác gì?**
[Điền cụ thể phần kế thừa và phần mới — gợi ý: bổ sung/cải tiến bus TileLink UL/UH + bridge, DMA descriptor + backpressure, MMU + syscall map/unmap, và bộ kiểm chứng 3 lớp đối chiếu GNU/Spike.] Tránh nói quá; chỉ nêu phần thực sự nhóm làm.

**12. CAN tới đâu rồi?**
Mức khung/thông điệp qua MMIO (ID 11-bit, DLC 0–8, loopback); chưa có physical layer, bit-stuffing, CRC, ACK hay arbitration. Đợt này nhóm tạm gác CAN; nếu cần sẽ trình bày bổ sung. Lý thuyết giao thức dẫn chuẩn ISO 11898-1.

---

## CHECKLIST TRƯỚC PHẢN BIỆN
- [ ] Điền tên đề tài, GVHD, họ tên + MSSV vào Slide 1; phân công thật vào Slide 20.
- [ ] Chèn hình: kiến trúc SoC (S8), assembler/CPU (S9), MMU/cache (S10), TileLink/DMA (S11), giao diện (S12), dashboard `fig_5_1` (S14), ảnh/video demo (S16).
- [ ] Hoàn thành bảng so sánh công cụ (RARS/Ripes/QtRvSim/Spike) cho phụ lục.
- [ ] Tập đọc thuộc 12 câu trong ngân hàng câu hỏi; phân vai ai trả lời mảng nào.
- [ ] Chạy thử `node test/verify_riscv_tests_spike.mjs` để sẵn sàng chạy lại tại chỗ.
