# Chương 5. KIỂM THỬ VÀ ĐÁNH GIÁ

Chương này trình bày cách kiểm thử và xác minh tính đúng đắn của hệ thống đã hiện thực ở Chương 4. Trọng tâm là hai hướng bổ trợ nhau: kiểm thử đơn vị từng mô-đun bằng Node.js, và đối chiếu kết quả của trình biên dịch hợp ngữ với các công cụ tham chiếu được cộng đồng RISC-V sử dụng rộng rãi. Phần cuối nêu một số hạn chế phát hiện được qua kiểm thử.

## 5.1. Phương pháp và môi trường kiểm thử

Để xác minh hệ thống, đề tài kết hợp ba lớp kiểm thử. Thứ nhất là kiểm thử đơn vị và kiểm thử khói: mỗi script Node.js trong thư mục `test/` khởi tạo trực tiếp một mô-đun (assembler, MMU, TileLink, DMA) hoặc một cấu hình tích hợp nhỏ, rồi so sánh kết quả với giá trị kỳ vọng bằng các phép kiểm tra (assertion). Thứ hai là đối chiếu mã hóa lệnh: lấy mã máy do trình biên dịch hợp ngữ của đề tài sinh ra so khớp từng từ lệnh 32 bit với mã máy do GNU RISC-V binutils tạo ra, dùng bộ chương trình kiểm thử chuẩn `riscv-tests` làm dữ liệu đầu vào [17], [18]. Thứ ba là đối chiếu thực thi: chạy các chương trình `riscv-tests` trên trình mô phỏng tham chiếu Spike để khẳng định hành vi thực thi đúng [8].

Môi trường kiểm thử gồm Node.js để chạy các script `.mjs`, GNU RISC-V binutils (`riscv64-unknown-elf-as`, `objcopy`, `objdump`) làm công cụ đối chiếu mã hóa, Spike làm trình mô phỏng tham chiếu, và một bản checkout cục bộ của `riscv-tests` để cung cấp dữ liệu kiểm thử ISA (xem source: `test/README_rv32imf_verification.md`).

## 5.2. Kiểm thử đơn vị các mô-đun

Mỗi mô-đun chính có một script kiểm thử riêng và đều chạy qua (pass) toàn bộ phép kiểm tra. Script `assembler_verify.mjs` kiểm các đường mã hóa dễ sai như cú pháp `jalr`, các lệnh giả `jr`/`ret`/`call`/`li`, mã hóa `fence`, các lệnh dấu phẩy động có rounding mode và các directive dữ liệu; kết quả mong đợi được viết dưới dạng từ lệnh hex hoặc byte trong bộ nhớ nên đây là kiểm thử tất định ở mức trình biên dịch. Script `mmu_basic_verify.mjs` kiểm logic dịch địa chỉ của MMU: identity fallback khi chưa có ánh xạ, ánh xạ VA→PA qua bảng trang rồi hit TLB ở lần sau, thay thế LRU trong TLB, lỗi quyền truy cập và đường request/response.

Script `tilelink_verify.mjs` kiểm fabric ở cấu hình tích hợp nhỏ gồm cache, memory, TileLink-UH/UL, bridge và DMA: đọc/ghi qua memory, ghi một phần (partial write) đúng byte lane, lệnh nguyên tử, và định tuyến hai chiều qua bridge. Script `dma_verify.mjs` kiểm DMA qua ba kịch bản: gọi trực tiếp API copy trong RAM, để CPU ghi các thanh ghi DMA bằng chương trình hợp ngữ rồi poll bit `BUSY` cho tới khi xong, và chế độ byte-swap. Cả bốn script trên đều chạy thành công (xem source: `test/assembler_verify.mjs`, `test/mmu_basic_verify.mjs`, `test/tilelink_verify.mjs`, `test/dma_verify.mjs`).

## 5.3. Đối chiếu mã hóa lệnh với GNU binutils

Đây là phép kiểm chứng quan trọng nhất đối với trình biên dịch hợp ngữ. Ý tưởng là so sánh mã máy do đề tài sinh ra với mã máy do một công cụ chuẩn, đã được kiểm chứng rộng rãi, tạo ra cho cùng một chương trình; nếu hai bên trùng khớp ở mọi lệnh thì có cơ sở tin rằng phần mã hóa lệnh của đề tài là đúng. Công cụ tham chiếu được chọn là GNU RISC-V binutils, và dữ liệu đầu vào là bộ `riscv-tests` — bộ chương trình kiểm thử ISA chính thức của cộng đồng RISC-V [17], [18].

Quy trình thực hiện trong script `verify_rv32imf_against_gnu.mjs` như sau: với mỗi tập tin ELF đã biên dịch sẵn trong `riscv-tests` (các nhóm `rv32ui`, `rv32um`, `rv32uf`), dùng `objdump` tách từng lệnh kèm mã máy gốc; chuẩn hóa các lệnh nhảy tương đối theo PC (như `beq`, `jal`) về offset tương ứng tại địa chỉ đang xét; biên dịch lại từng lệnh bằng trình biên dịch của đề tài tại đúng địa chỉ đó; rồi so khớp từ lệnh 32 bit. Các lệnh không thuộc phạm vi RV32IMF của đề tài — chủ yếu là lệnh CSR và lệnh đặc quyền xuất hiện trong đoạn khởi tạo môi trường của `riscv-tests` — được đánh dấu bỏ qua (skipped) và thống kê riêng, không dùng để che lỗi.

Kết quả: trên 61 tập tin ELF của `riscv-tests`, đề tài đối chiếu 17.978 từ lệnh thuộc phạm vi RV32IMF và **tất cả đều trùng khớp** với GNU binutils, không có lệnh nào sai (0 mismatch); 1.456 lệnh CSR/đặc quyền nằm ngoài phạm vi được bỏ qua. Ngoài ra, một bộ chương trình mẫu cục bộ gồm 83 từ lệnh (đại diện cho các nhóm R/I/load-store/điều khiển của RV32I, RV32M và RV32F) cũng trùng khớp hoàn toàn (xem source: `test/verify_rv32imf_against_gnu.mjs`).

Bảng 5.1 minh họa một vài lệnh tiêu biểu thuộc các nhóm RV32I, RV32M và RV32F cùng mã máy 32 bit; với mỗi lệnh, mã máy do đề tài sinh ra trùng khớp với mã máy do GNU binutils tạo ra.

**Bảng 5.1. Ví dụ mã hóa lệnh do đề tài sinh ra, đối chiếu với GNU binutils**

| Lệnh hợp ngữ | Mã máy đề tài sinh | Mã máy GNU binutils |
|---|---|---|
| `addi x1, x2, -2048` | `0x80010093` | `0x80010093` |
| `mul x1, x2, x3` | `0x023100B3` | `0x023100B3` |
| `lw x5, 0(x6)` | `0x00032283` | `0x00032283` |
| `fadd.s f1, f2, f3` | `0x003170D3` | `0x003170D3` |

## 5.4. Đối chiếu thực thi với Spike trên riscv-tests

Bên cạnh việc kiểm tra mã hóa tĩnh, đề tài dùng trình mô phỏng tham chiếu Spike để kiểm tra hành vi thực thi [8]. Script `verify_riscv_tests_spike.mjs` chạy lần lượt các ELF `rv32ui`, `rv32um`, `rv32uf` của `riscv-tests` trên Spike với cấu hình ISA `RV32IMF_zicclsm`, rồi phân loại pass/fail theo cơ chế kết thúc của `riscv-tests`. Phần mở rộng `zicclsm` được bật để hỗ trợ các bài kiểm tra truy cập bộ nhớ không căn hàng (ví dụ `rv32ui-p-ma_data`); nếu chạy với `RV32IMF` thuần, Spike có thể phát sinh trap misaligned load/store.

Kết quả: toàn bộ 61/61 chương trình `riscv-tests` thuộc ba nhóm RV32I, RV32M và RV32F đều chạy thành công trên Spike, không có chương trình nào timeout hay kết thúc với mã lỗi (xem source: `test/verify_riscv_tests_spike.mjs`).

## 5.5. Nhận xét và hạn chế

Kết quả kiểm thử cho thấy các mô-đun trọng tâm của hệ thống đã có bằng chứng đúng đắn rõ ràng: trình biên dịch hợp ngữ sinh mã trùng khớp với GNU binutils trên gần mười tám nghìn lệnh, các chương trình ISA chuẩn chạy đúng trên Spike, và các mô-đun MMU, TileLink, DMA đều qua kiểm thử đơn vị. So với khóa luận trước của Nguyễn Gia Bảo Ngọc [9], đề tài mở rộng phạm vi tập lệnh sang RV32M và RV32F, đồng thời bổ sung quy trình đối chiếu định lượng với GNU binutils và Spike.

Tuy nhiên, phạm vi kiểm thử cũng cho thấy một số giới hạn cần nêu trung thực. Kết quả chỉ khẳng định tính đúng đắn trong phạm vi tập con RV32IMF ở chế độ người dùng: các lệnh CSR và lệnh đặc quyền nằm ngoài phạm vi nên được bỏ qua khi đối chiếu, và `fence` mới được mã hóa chứ chưa có nhánh thực thi riêng. Đối với TileLink, kiểm thử chỉ xác minh mô hình giao dịch A/D cùng các opcode đọc/ghi/nguyên tử đã hiện thực, chưa bao phủ kênh B/C/E hay coherence đầy đủ. Cuối cùng, hệ thống chưa có cơ chế ngắt phần cứng tới CPU nên DMA và các ngoại vi đều hoạt động theo cơ chế polling, và đề tài chưa xây dựng bộ benchmark hiệu năng định lượng có quy trình đo lặp lại — các bộ đếm cache/TLB và số chu kỳ trong trình mô phỏng hiện chỉ phục vụ quan sát (xem source: `src/js/cpu.js`, `src/js/tilelink.js`, `docs/kltn/00_project_analysis.md`).

---

## Tài liệu tham khảo (trích dẫn trong Chương 5)

> *Ghi chú: Danh sách dưới đây liệt kê các tài liệu được trích dẫn trong Chương 5, trình bày theo chuẩn IEEE và đánh số theo thứ tự xuất hiện trong toàn báo cáo; danh sách này được hợp nhất vào mục Tài liệu tham khảo chung ở cuối báo cáo.*

[8] "Spike RISC-V ISA Simulator (riscv-software-src/riscv-isa-sim)," RISC-V Software. [Trực tuyến]. Có tại: https://github.com/riscv-software-src/riscv-isa-sim (truy cập: 19/01/2026).

[9] N. G. B. Ngọc, "Phát triển trình mô phỏng SoC," Khóa luận tốt nghiệp, Trường Đại học Công nghệ Thông tin, Đại học Quốc gia TP. Hồ Chí Minh, 2025.

[17] "riscv-software-src/riscv-tests," RISC-V Software, kho mã nguồn GitHub. [Trực tuyến]. Có tại: https://github.com/riscv-software-src/riscv-tests (truy cập: 19/01/2026).

[18] "GNU Binutils," GNU Project, và "riscv-gnu-toolchain," RISC-V Collaboration. [Trực tuyến]. Có tại: https://www.gnu.org/software/binutils/ và https://github.com/riscv-collab/riscv-gnu-toolchain (truy cập: 19/01/2026).
