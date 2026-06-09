# Chương 1. TỔNG QUAN ĐỀ TÀI

## 1.1. Lý do thực hiện đề tài

### 1.1.1. Bối cảnh và nhu cầu

Kiến trúc máy tính, hệ thống nhúng và hệ thống trên chip (System-on-Chip – SoC) là những nội dung nền tảng trong chương trình đào tạo ngành Kỹ thuật Máy tính. Một hệ thống tính toán thực tế không chỉ gồm một lõi xử lý đơn lẻ mà là sự phối hợp của nhiều thành phần: lõi xử lý, phân cấp bộ nhớ, đơn vị quản lý bộ nhớ, hệ thống bus kết nối (interconnect), bộ điều khiển truy cập bộ nhớ trực tiếp (Direct Memory Access – DMA) và các thiết bị ngoại vi. Tuy nhiên, cách các thành phần này phối hợp ở mức hệ thống – như dịch địa chỉ ảo sang vật lý, hoạt động của bộ nhớ đệm, các giao dịch trên bus hay luồng dữ liệu của DMA – tương đối trừu tượng, khó quan sát trực tiếp trên phần cứng và không hiển thị rõ nếu chỉ chạy chương trình ở mức tập lệnh.

Kiến trúc tập lệnh (Instruction Set Architecture – ISA) RISC-V được quan tâm rộng rãi trong giảng dạy và nghiên cứu nhờ tính mở, miễn phí bản quyền và thiết kế mô-đun: một tập lệnh cơ sở nhỏ gọn (RV32I) cùng các phần mở rộng tùy chọn như nhân/chia số nguyên (M), dấu phẩy động (F) và thao tác nguyên tử (A) [1]. Hệ sinh thái phần cứng mở quanh RISC-V cũng dùng các giao thức kết nối mở, tiêu biểu là TileLink – một giao thức bus công khai được dùng trong nhiều thiết kế SoC dựa trên RISC-V [2]. Trong bối cảnh đó, một công cụ mô phỏng trực quan hóa trạng thái hệ thống theo từng bước và chạy trực tiếp trên trình duyệt web mà không cần cài đặt là phương tiện hỗ trợ hiệu quả cho việc giảng dạy và tự học kiến trúc máy tính ở mức hệ thống [3].

### 1.1.2. Khảo sát các công cụ mô phỏng hiện có

Để xác định khoảng trống mà đề tài hướng đến, phần này khảo sát một số công cụ mô phỏng phổ biến cùng một khóa luận liên quan thực hiện trước đó tại đơn vị.

- **MARS.** Công cụ mô phỏng hợp ngữ cho kiến trúc MIPS, viết bằng Java, có trình soạn thảo, bảng thanh ghi và khung quan sát bộ nhớ [4]; hướng đến MIPS thay vì RISC-V và không bao quát bus kết nối hay DMA.
- **RISC-V Interpreter (Đại học Cornell).** Công cụ web đơn giản, cho phép biên dịch và quan sát giá trị thanh ghi [5]; không mô phỏng đường đi dữ liệu (datapath) và không hỗ trợ thiết bị ngoại vi.
- **WebRISC-V.** Công cụ web mô phỏng đường đi dữ liệu nhiều chu kỳ và pipeline của lõi RISC-V [6]; trọng tâm là bên trong lõi xử lý, chưa mở rộng đến kiến trúc SoC và ngoại vi.
- **Ripes.** Công cụ mã nguồn mở trực quan hóa đường đi dữ liệu, pipeline và bộ nhớ đệm [7]; tập trung vào vi kiến trúc CPU, mức tùy biến bus và DMA cho mô phỏng SoC còn hạn chế.
- **Spike.** Trình mô phỏng tham chiếu chuẩn của RISC-V, độ chính xác cao, thường dùng để kiểm chứng hành vi thực thi [8]; hoạt động qua giao diện dòng lệnh và không trực quan hóa trạng thái hệ thống.
- **Khóa luận liên quan trước đó.** Khóa luận "Phát triển trình mô phỏng SoC" của Nguyễn Gia Bảo Ngọc (2025) [9] cùng hướng và chung cán bộ hướng dẫn, gồm lõi xử lý RISC-V ở phạm vi RV32I cùng thao tác nguyên tử, MMU, giao thức TileLink, bộ điều khiển DMA và thiết bị ngoại vi ma trận đèn LED; chưa mở rộng sang nhóm lệnh nhân/chia số nguyên (M) và dấu phẩy động (F), số lượng ngoại vi cũng còn giới hạn.

Bảng 1.1 so sánh các công cụ trên theo một số tiêu chí ở mức hệ thống, với các ký hiệu: "Có" – hỗ trợ rõ ràng; "Hạn chế" – có nhưng ở mức giới hạn hoặc không phải trọng tâm; "Không" – không thuộc phạm vi công cụ.

**Bảng 1.1. So sánh một số công cụ mô phỏng liên quan**

| Tiêu chí | MARS [4] | RISC-V Interpreter [5] | WebRISC-V [6] | Ripes [7] | Spike [8] | KLTN 2025 [9] | Đề tài này |
|---|---|---|---|---|---|---|---|
| Nền tảng | Java (desktop) | Web | Web | Desktop | Dòng lệnh (CLI) | (xem [9]) | Web |
| Kiến trúc tập lệnh | MIPS | RISC-V | RISC-V | RISC-V | RISC-V | RV32I (+atomic) | RV32IMF (tập con) |
| Trình biên dịch hợp ngữ tích hợp | Có | Có | Hạn chế | Có | Không | Có | Có |
| Trực quan hóa thực thi CPU | Hạn chế | Hạn chế | Có (pipeline) | Có (datapath) | Không | Có | Có |
| Phân cấp bộ nhớ (cache, MMU) | Hạn chế | Không | Không | Hạn chế (cache) | Hạn chế | Có (MMU) | Có (cache + MMU) |
| Bus kết nối hệ thống | Không | Không | Không | Hạn chế | Không | Có (TileLink) | Có (TileLink UH/UL) |
| DMA | Không | Không | Không | Hạn chế | Không | Có | Có |
| Thiết bị ngoại vi tương tác | Hạn chế | Không | Không | Hạn chế | Không | Hạn chế (LED) | Có (UART, LED, bàn phím, chuột) |
| Mô phỏng ở mức SoC | Không | Không | Không | Hạn chế | Không | Có | Có |

Bảng 1.1 cho thấy các công cụ web hiện có dừng ở mức lõi xử lý, còn các công cụ mạnh về vi kiến trúc hoặc có độ chính xác tham chiếu cao lại không nhắm tới mô phỏng SoC đầy đủ trên nền web. Cột "Đề tài này" tương ứng với các thành phần đã hiện thực trong mã nguồn (chi tiết ở Chương 3 và Chương 4).

### 1.1.3. Khoảng trống và hướng giải quyết

Khảo sát trên cho thấy còn thiếu một công cụ web hội đủ đồng thời: mô phỏng ở mức hệ thống SoC với đầy đủ lõi xử lý, phân cấp bộ nhớ, bus kết nối, DMA và nhiều loại ngoại vi; hỗ trợ phạm vi tập lệnh RV32IMF; tích hợp trình biên dịch hợp ngữ và trực quan hóa từng thành phần; đồng thời được kiểm chứng đối chiếu với các công cụ tham chiếu được cộng đồng công nhận. Đề tài hướng đến lấp khoảng trống đó: phát triển một trình mô phỏng SoC dựa trên RISC-V RV32IMF và giao thức TileLink chạy hoàn toàn trên trình duyệt web, tích hợp trình biên dịch hợp ngữ, phân cấp bộ nhớ (cache và MMU), bus TileLink với bộ điều khiển DMA và các thiết bị ngoại vi tương tác, cùng các khung quan sát trực quan cho từng thành phần.

## 1.2. Mục tiêu của đề tài

### 1.2.1. Mục tiêu tổng quát

Mục tiêu tổng quát của đề tài là xây dựng một bộ công cụ mô phỏng hành vi của một hệ thống trên chip điển hình dựa trên kiến trúc RISC-V, kèm dịch vụ quản lý bộ nhớ, phục vụ mục tiêu giáo dục. Công cụ cho phép người dùng biên dịch mã nguồn hợp ngữ, mô phỏng hoạt động của các thành phần phần cứng và quan sát trạng thái của chúng trên nền tảng web dễ tiếp cận.

### 1.2.2. Mục tiêu kỹ thuật

Trên cơ sở mục tiêu tổng quát, đề tài đặt ra các mục tiêu kỹ thuật cụ thể, bám theo định hướng trong đề cương và phù hợp với hiện trạng đã hiện thực:

- Mô phỏng lõi xử lý RISC-V 32-bit hỗ trợ các nhóm lệnh RV32IMF (số nguyên cơ sở I, nhân/chia M, dấu phẩy động đơn F), với tệp thanh ghi số nguyên và dấu phẩy động cùng chu trình nạp – giải mã – thực thi lệnh.
- Tái hiện hệ thống bus kết nối dựa trên giao thức TileLink, trong đó cả bộ xử lý và bộ điều khiển DMA đều đóng vai trò master phát yêu cầu trên bus (tách thành hai phân hệ TileLink-UH và TileLink-UL kèm cầu nối); đồng thời minh họa khả năng giảm tải cho bộ xử lý khi DMA vận chuyển khối dữ liệu độc lập với luồng thực thi lệnh.
- Hiện thực dịch vụ quản lý bộ nhớ gồm MMU với cơ chế phân trang và bộ đệm dịch địa chỉ (Translation Lookaside Buffer – TLB), cùng phân cấp bộ nhớ đệm nhiều mức.
- Tích hợp trình biên dịch hợp ngữ và hệ thống thiết bị ngoại vi mô phỏng cùng các khung trực quan hóa, cho phép người dùng nạp mã nguồn và quan sát kết quả điều khiển phần cứng.

## 1.3. Đối tượng và phạm vi nghiên cứu

### 1.3.1. Đối tượng nghiên cứu

- Kiến trúc tập lệnh RISC-V (tập cơ sở RV32I cùng các phần mở rộng nhân/chia số nguyên M và dấu phẩy động đơn F) [1] và giao thức kết nối TileLink ở hai cấp độ TileLink-UL (Uncached Lightweight) và TileLink-UH (Uncached Heavyweight) [2].
- Kiến trúc hệ thống trên chip và cách tổ chức các thành phần: lõi xử lý, phân cấp bộ nhớ, bus kết nối, DMA và thiết bị ngoại vi.
- Các cơ chế quản lý bộ nhớ (phân trang, dịch địa chỉ ảo sang vật lý, TLB, cache) cùng các kỹ thuật xây dựng và trực quan hóa trình mô phỏng trên nền tảng web.

### 1.3.2. Phạm vi và giới hạn

Hệ thống mô phỏng ở mức hành vi/chức năng (behavioral/functional), tập trung tái hiện đúng hành vi logic của các thành phần; hệ thống không mô phỏng các đặc tính vật lý như độ trễ định thời chi tiết theo công nghệ chế tạo hay mức tiêu thụ năng lượng. Do được hiện thực bằng JavaScript chạy đơn luồng trên trình duyệt, tốc độ mô phỏng phụ thuộc vào máy của người dùng và không phản ánh tần số hoạt động của một chip thực tế.

Hệ thống hỗ trợ một tập con của RV32IMF phục vụ các chương trình ở chế độ người dùng; phần dấu phẩy động tính theo chuẩn IEEE 754 [10]. Một số thành phần của kiến trúc đầy đủ nằm ngoài phạm vi: lệnh truy cập thanh ghi điều khiển và trạng thái (Control and Status Register – CSR) cùng chế độ đặc quyền; thanh ghi điều khiển dấu phẩy động (FCSR), cờ ngoại lệ (fflags) và chế độ làm tròn động (frm); lệnh `fence` được mã hóa nhưng chưa thực thi; lệnh `AMOADD.W` thuộc phần mở rộng RV32A chỉ là mở rộng minh họa, nằm ngoài tên đề tài.

Về giao thức TileLink, hệ thống mô phỏng ở mức giao dịch trên hai kênh yêu cầu (A) và phản hồi (D) tương ứng TileLink-UL và TileLink-UH; chưa hiện thực các kênh B, C, E cùng cơ chế nhất quán bộ nhớ đệm (coherence) của TileLink-C. Cơ chế điều phối bus ở mức hàng đợi một giao dịch và chưa có đường tín hiệu ngắt (Interrupt Request – IRQ) tới bộ xử lý; trạng thái hoàn tất của DMA và ngoại vi được nhận biết qua cơ chế đọc thăm dò (polling). Các ngoại vi đã hiện thực gồm UART (Universal Asynchronous Receiver–Transmitter), ma trận LED, bàn phím và chuột; thiết bị CAN chỉ được để ngỏ cho hướng phát triển. Bảng 1.2 tóm tắt phạm vi chức năng của hệ thống theo ba mức.

**Bảng 1.2. Tóm tắt phạm vi chức năng của hệ thống**

| Mức độ | Nội dung |
|---|---|
| Đã hỗ trợ | Trình biên dịch hợp ngữ hai lượt; lõi xử lý với các nhóm lệnh RV32I, RV32M, RV32F; tệp thanh ghi số nguyên và dấu phẩy động; MMU với phân trang và TLB; phân cấp bộ nhớ đệm; bus TileLink-UH/UL và cầu nối; DMA; ngoại vi UART, LED, bàn phím, chuột; trực quan hóa sơ đồ SoC, bộ nhớ, thanh ghi và nhật ký hệ thống |
| Hỗ trợ một phần | Dấu phẩy động đơn theo biểu diễn IEEE 754 nhưng chưa đủ FCSR/fflags/frm; lệnh `fence` được mã hóa nhưng chưa thực thi; thao tác nguyên tử mới có `AMOADD.W`; điều phối bus ở mức hàng đợi một giao dịch |
| Ngoài phạm vi | Lệnh CSR và chế độ đặc quyền; các kênh B/C/E và nhất quán bộ nhớ đệm của TileLink-C; cơ chế ngắt phần cứng tới CPU; thiết bị CAN; mô phỏng đặc tính định thời/năng lượng vật lý |

### 1.3.3. Định hướng đánh giá

Tính đúng đắn của hệ thống được đánh giá bằng cách đối chiếu kết quả với các công cụ tham chiếu được cộng đồng công nhận, kết hợp với bộ kiểm thử nội bộ: đối chiếu kết quả mã hóa lệnh với bộ công cụ GNU RISC-V binutils và đối chiếu hành vi thực thi với trình mô phỏng tham chiếu Spike [8] trên bộ riscv-tests. Quy trình và kết quả chi tiết được trình bày trong Chương 5.

## 1.4. Phương pháp thực hiện

**Nghiên cứu tài liệu.** Nghiên cứu kiến trúc tập lệnh RISC-V RV32IMF [1], cấu trúc hệ thống trên chip, các cơ chế quản lý bộ nhớ (phân trang, TLB, cache) và giao thức TileLink ở hai cấp độ TL-UL và TL-UH [2]; đồng thời tìm hiểu cách triển khai của một số công cụ đã công bố [4]–[8] để rút ra yêu cầu thiết kế.

**Phát triển.** Hiện thực bộ mô phỏng SoC trên nền web bằng HTML, CSS và JavaScript theo mô hình mô-đun (ES modules), trong đó mỗi thành phần phần cứng là một mô-đun phần mềm riêng, được lắp ghép tại một thành phần khởi tạo trung tâm; giao diện dùng thư viện CodeMirror cho vùng nhập hợp ngữ và phần tử canvas để hiển thị ma trận LED.

**Kiểm thử.** Đối chiếu kết quả thực thi (trạng thái thanh ghi, bộ nhớ và kết quả mã hóa lệnh) với các công cụ mô phỏng tham chiếu thông qua các bộ chương trình kiểm thử, đồng thời xây dựng các kịch bản và chương trình minh họa chạy trực tiếp trên hệ thống.

## 1.5. Đóng góp của đề tài

Các đóng góp chính của đề tài gồm:

- Một trình mô phỏng SoC dựa trên RISC-V RV32IMF hoạt động trên nền web, tích hợp trong cùng một công cụ: trình biên dịch hợp ngữ, lõi xử lý, phân cấp bộ nhớ (cache và MMU), hệ thống bus TileLink, bộ điều khiển DMA và nhiều thiết bị ngoại vi, cùng các khung trực quan hóa trạng thái hệ thống.
- Mở rộng phạm vi tập lệnh so với khóa luận liên quan trước đó [9]: bổ sung nhóm lệnh nhân/chia số nguyên (RV32M) và nhóm lệnh dấu phẩy động đơn (RV32F) cùng tệp thanh ghi dấu phẩy động.
- Bổ sung số lượng và chủng loại thiết bị ngoại vi tương tác (UART có cấu hình tốc độ, ma trận LED, bàn phím, chuột) cùng các khung quan sát bổ trợ: sơ đồ SoC động, khung quan sát MMU và bộ nhớ đệm, và nhật ký hệ thống có khả năng lọc theo từng mô-đun.
- Một quy trình kiểm chứng đối chiếu với các công cụ được cộng đồng công nhận (GNU binutils và Spike) trên bộ riscv-tests, kèm bộ kiểm thử nội bộ cho các mô-đun. Những đóng góp này hướng đến một công cụ phục vụ giảng dạy và học tập kiến trúc máy tính ở mức hệ thống, thay vì chỉ ở mức tập lệnh.

## 1.6. Cấu trúc báo cáo

Phần còn lại của báo cáo gồm năm chương. Chương 2 trình bày cơ sở lý thuyết: hệ thống trên chip, kiến trúc tập lệnh RISC-V (RV32I, RV32M, RV32F), quản lý bộ nhớ và bộ nhớ đệm, giao thức TileLink, cơ chế DMA, thiết bị ngoại vi và các công nghệ nền tảng web. Chương 3 phân tích yêu cầu và thiết kế kiến trúc tổng quan, danh sách mô-đun, bản đồ địa chỉ bộ nhớ, mô hình mô phỏng theo chu kỳ và giao diện web. Chương 4 mô tả chi tiết hiện thực của trình biên dịch hợp ngữ, lõi xử lý, hệ thống bộ nhớ, bus TileLink, DMA, thiết bị ngoại vi và trực quan hóa. Chương 5 trình bày phương pháp, môi trường và kết quả kiểm thử (đối chiếu với GNU binutils và Spike trên bộ riscv-tests). Chương 6 tổng kết kết quả, hạn chế và hướng phát triển.

---

## Tài liệu tham khảo (trích dẫn trong Chương 1)

> *Ghi chú: Danh sách dưới đây liệt kê các tài liệu được trích dẫn trong Chương 1, trình bày theo chuẩn IEEE và đánh số theo thứ tự xuất hiện trong toàn báo cáo; danh sách này được hợp nhất vào mục Tài liệu tham khảo chung ở cuối báo cáo.*

[1] A. Waterman và K. Asanović (chủ biên), "The RISC-V Instruction Set Manual, Volume I: Unprivileged ISA, Document Version 20191213," RISC-V Foundation, tháng 12/2019. [Trực tuyến]. Có tại: https://riscv.org/technical/specifications/

[2] SiFive, Inc., "SiFive TileLink Specification, Version 1.8.1," 2020. [Trực tuyến]. Có tại: https://www.sifive.com/documentation/tilelink/

[3] B. Nikolic, Z. Radivojevic, J. Djordjevic và V. Milutinovic, "A Survey and Evaluation of Simulators Suitable for Teaching Courses in Computer Architecture and Organization," IEEE Transactions on Education, tập 52, số 4, trang 449–458, tháng 11/2009.

[4] K. Vollmar và P. Sanderson, "MARS: An education-oriented MIPS assembly language simulator," trong Proceedings of the 37th SIGCSE Technical Symposium on Computer Science Education (SIGCSE '06), Houston, TX, Hoa Kỳ, 2006, trang 239–243.

[5] "RISC-V Interpreter," Đại học Cornell, môn học CS 3410. [Trực tuyến]. Có tại: https://www.cs.cornell.edu/courses/cs3410/2019sp/riscv/interpreter/ (truy cập: 19/01/2026).

[6] R. Giorgi và G. Mariotti, "WebRISC-V: A Web-Based Education-Oriented RISC-V Pipeline Simulation Environment," trong Proceedings of the Workshop on Computer Architecture Education (WCAE '19), New York, NY, Hoa Kỳ, 2019, trang 1–6.

[7] M. B. Petersen, "Ripes: A Visual Computer Architecture Simulator," trong Proceedings of the 2021 ACM/IEEE Workshop on Computer Architecture Education (WCAE), 2021, trang 1–8.

[8] "Spike RISC-V ISA Simulator (riscv-software-src/riscv-isa-sim)," RISC-V Software. [Trực tuyến]. Có tại: https://github.com/riscv-software-src/riscv-isa-sim (truy cập: 19/01/2026).

[9] N. G. B. Ngọc, "Phát triển trình mô phỏng SoC," Khóa luận tốt nghiệp, Trường Đại học Công nghệ Thông tin, Đại học Quốc gia TP. Hồ Chí Minh, 2025.

[10] "IEEE Standard for Floating-Point Arithmetic," IEEE Std 754-2019 (bản sửa đổi của IEEE Std 754-2008), trang 1–84, tháng 7/2019.
