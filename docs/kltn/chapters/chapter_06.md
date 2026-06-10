# Chương 6. KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN

## 6.1. Kết luận

Khóa luận đã xây dựng được trình mô phỏng hệ thống trên chip (SoC) dựa trên kiến trúc tập lệnh RISC-V RV32IMF [1] và giao thức TileLink [2], chạy trực tiếp trên trình duyệt web. Hệ thống tích hợp trình biên dịch hợp ngữ, lõi xử lý, MMU/TLB, bộ nhớ đệm L1I/L1D/L2, bus TileLink-UH/UL, bộ điều khiển DMA, năm thiết bị ngoại vi (UART, CAN, ma trận LED, bàn phím, chuột) và các khung trực quan hóa trạng thái.

So với năm mục tiêu kỹ thuật ở mục 1.2.2, khóa luận đã hoàn thành 5/5 mục tiêu, tương đương khoảng 100% số mục tiêu đề ra trong phạm vi mô phỏng đã xác định:

- Lõi xử lý: hỗ trợ tập con RV32I/M/F, tệp thanh ghi số nguyên và dấu phẩy động, chu trình nạp, giải mã và thực thi lệnh.
- Hệ thống bus: mô phỏng TileLink-UH/UL ở mức giao dịch trên hai kênh A/D, có cầu nối giữa hai phân hệ.
- DMA: vận chuyển khối dữ liệu độc lập với luồng thực thi chính của CPU.
- Quản lý bộ nhớ: hiện thực MMU, TLB và phân cấp bộ nhớ đệm L1I/L1D/L2.
- Biên dịch, ngoại vi và trực quan hóa: tích hợp assembler hai lượt, các ngoại vi tương tác và các khung quan sát hệ thống.

Kết quả kiểm thử cho thấy các mô-đun trọng tâm đều chạy qua kiểm thử đơn vị; phần mã hóa lệnh đối chiếu 17.978 từ lệnh với GNU RISC-V binutils [18] và không có sai khác; 61/61 chương trình thuộc bộ `riscv-tests` [17] chạy thành công trên Spike [8]. So với khóa luận liên quan trước đó [9], hệ thống đã mở rộng thêm RV32M, RV32F, tệp thanh ghi dấu phẩy động, nhiều ngoại vi hơn và quy trình kiểm chứng định lượng rõ ràng hơn.

Nhìn chung, khóa luận đã đạt mục tiêu tổng quát ở mục 1.2.1: xây dựng một công cụ mô phỏng SoC RISC-V trên nền web phục vụ học tập và giảng dạy kiến trúc máy tính ở mức hệ thống.

## 6.2. Hạn chế

Hệ thống còn các hạn chế chính sau:

- Chỉ hỗ trợ tập con RV32IMF; chưa hiện thực CSR, chế độ đặc quyền, FCSR/fflags/frm đầy đủ và thực thi `fence`.
- TileLink mới dừng ở mức giao dịch A/D; chưa có kênh B/C/E và cơ chế nhất quán bộ nhớ đệm TileLink-C [2].
- Điều phối bus vẫn theo hàng đợi một giao dịch, chưa phải bộ phân xử đa master đầy đủ.
- Chưa có cơ chế ngắt phần cứng tới CPU; DMA và ngoại vi chủ yếu dùng đọc thăm dò.
- Chưa có bộ benchmark hiệu năng định lượng lặp lại; số liệu hiện phục vụ quan sát trong mô phỏng.
- CAN mới được mô phỏng ở mức frame/message qua MMIO để phục vụ giáo dục và demo SoC; chưa mô phỏng bit-level/physical layer đầy đủ, bit stuffing, CRC thật, ACK slot, arbitration theo từng bit, transceiver hoặc error frame hoàn chỉnh [19].

## 6.3. Hướng phát triển

Các hướng phát triển tiếp theo gồm:

- Bổ sung CSR, chế độ đặc quyền, FCSR, cờ ngoại lệ và chế độ làm tròn động cho nhóm lệnh dấu phẩy động.
- Thực thi `fence` như một thao tác có hiệu lực trong lõi xử lý.
- Mở rộng TileLink với các kênh B/C/E, cơ chế TileLink-C và bộ phân xử đa master đầy đủ.
- Bổ sung bộ điều khiển ngắt và đường IRQ từ DMA, UART, CAN, bàn phím, chuột tới CPU.
- Mở rộng mô hình CAN theo hướng kết nối nhiều nút và mô hình lỗi chi tiết hơn; chỉ nghiên cứu bit-level/physical layer khi có mục tiêu và bộ kiểm chứng phù hợp [19].
- Xây dựng benchmark hiệu năng định lượng cho bộ nhớ đệm, DMA và tốc độ mô phỏng.
- Hoàn thiện log kiểm chứng chính thức, mở rộng độ phủ kiểm thử và xây dựng thêm bài thực hành phục vụ giảng dạy.

---

## Tài liệu tham khảo (trích dẫn trong Chương 6)

> *Ghi chú: Danh sách dưới đây liệt kê các tài liệu được trích dẫn trong Chương 6, trình bày theo chuẩn IEEE và đánh số theo thứ tự xuất hiện trong toàn báo cáo; danh sách này được hợp nhất vào mục Tài liệu tham khảo chung ở cuối báo cáo.*

[1] A. Waterman và K. Asanović (chủ biên), "The RISC-V Instruction Set Manual, Volume I: Unprivileged ISA, Document Version 20191213," RISC-V Foundation, tháng 12/2019. [Trực tuyến]. Có tại: https://riscv.org/technical/specifications/

[2] SiFive, Inc., "SiFive TileLink Specification, Version 1.8.1," 2020. [Trực tuyến]. Có tại: https://www.sifive.com/documentation/tilelink/

[8] "Spike RISC-V ISA Simulator (riscv-software-src/riscv-isa-sim)," RISC-V Software. [Trực tuyến]. Có tại: https://github.com/riscv-software-src/riscv-isa-sim (truy cập: 19/01/2026).

[9] N. G. B. Ngọc, "Phát triển trình mô phỏng SoC," Khóa luận tốt nghiệp, Trường Đại học Công nghệ Thông tin, Đại học Quốc gia TP. Hồ Chí Minh, 2025.

[17] "riscv-software-src/riscv-tests," RISC-V Software, kho mã nguồn GitHub. [Trực tuyến]. Có tại: https://github.com/riscv-software-src/riscv-tests (truy cập: 19/01/2026).

[18] "GNU Binutils," GNU Project, và "riscv-gnu-toolchain," RISC-V Collaboration. [Trực tuyến]. Có tại: https://www.gnu.org/software/binutils/ và https://github.com/riscv-collab/riscv-gnu-toolchain (truy cập: 19/01/2026).

[19] Robert Bosch GmbH, "M_CAN Controller Area Network User's Manual," Revision 3.3.1, 11/03/2023.
