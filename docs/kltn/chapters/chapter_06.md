# Chương 6. KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN

Chương này tổng kết các kết quả đã đạt được của khóa luận theo các mục tiêu kỹ thuật đã đặt ra ở mục 1.2.2, khẳng định lại các đóng góp chính đã nêu ở mục 1.5, trình bày một cách trung thực các hạn chế còn tồn tại, và đề xuất các hướng phát triển tiếp theo. Đây là chương tổng hợp; các kết quả và số liệu được nhắc lại đều dựa trên những gì đã trình bày ở Chương 1 đến Chương 5, không bổ sung kết quả thực nghiệm hay hình/bảng mới.

## 6.1. Kết luận

Khóa luận đã xây dựng được một trình mô phỏng hệ thống trên chip (SoC) dựa trên kiến trúc tập lệnh RISC-V RV32IMF [6] và giao thức kết nối TileLink [7], hoạt động hoàn toàn trên trình duyệt web và mô phỏng ở mức hành vi/chức năng theo chu kỳ. Kiến trúc tổng quan và mô hình mô phỏng theo chu kỳ đã được phân tích và thiết kế ở Chương 3, được hiện thực chi tiết cho từng thành phần ở Chương 4, và được kiểm thử ở Chương 5. So với các mục tiêu kỹ thuật đề ra ở mục 1.2.2, kết quả đạt được có thể tóm tắt như sau.

Thứ nhất, đối với mục tiêu mô phỏng lõi xử lý (mục 1.2.2.1), hệ thống đã hiện thực lõi xử lý RISC-V 32 bit với tệp thanh ghi số nguyên và tệp thanh ghi dấu phẩy động, thực hiện chu trình nạp – giải mã – thực thi và truy cập bộ nhớ theo mô hình bất đồng bộ qua bus (chi tiết ở mục 4.2). Lõi xử lý hỗ trợ một tập con của RV32IMF gồm tập số nguyên cơ sở (I), nhóm lệnh nhân/chia số nguyên (M) và nhóm lệnh dấu phẩy động đơn (F) phục vụ cho các chương trình ở chế độ người dùng. Cần khẳng định lại rằng đây là tập con phục vụ mô phỏng: như đã nêu ở mục 1.3.2, các lệnh truy cập thanh ghi điều khiển/trạng thái (CSR) và chế độ đặc quyền chưa được hiện thực; thanh ghi điều khiển dấu phẩy động (FCSR), các cờ ngoại lệ (fflags) và lựa chọn chế độ làm tròn động (frm) chưa được hiện thực đầy đủ; lệnh `fence` được trình biên dịch mã hóa nhưng chưa được lõi xử lý thực thi như một thao tác có hiệu lực; và lệnh `AMOADD.W` thuộc nhóm thao tác nguyên tử được xem là một mở rộng minh họa của RV32A, nằm ngoài phạm vi tên đề tài RV32IMF.

Thứ hai, đối với mục tiêu tái hiện hệ thống bus kết nối (mục 1.2.2.2), hệ thống đã mô phỏng giao thức TileLink ở mức giao dịch trên hai kênh chính là kênh yêu cầu (A) và kênh phản hồi (D), được tổ chức thành hai phân hệ bus TileLink-UH và TileLink-UL kèm cầu nối giữa hai bus (chi tiết ở mục 4.4). Cả bộ xử lý và bộ điều khiển DMA đều đóng vai trò thành phần chủ động phát yêu cầu (master) trên bus, qua đó minh họa được việc điều phối truy cập tài nguyên giữa các thành phần. Đúng với phạm vi đã công bố, mô hình này dừng ở mức giao dịch A/D, chưa hiện thực các kênh B, C, E cùng cơ chế bảo đảm nhất quán bộ nhớ đệm (coherence) theo cấp độ TileLink-C; cơ chế điều phối được mô hình hóa ở mức hàng đợi với một giao dịch được xử lý tại một thời điểm.

Thứ ba, đối với mục tiêu minh họa khả năng giảm tải cho bộ xử lý qua DMA (mục 1.2.2.3), hệ thống đã hiện thực bộ điều khiển DMA cho phép vận chuyển khối dữ liệu một cách độc lập với luồng thực thi lệnh của CPU, với cấu trúc mô tả truyền (descriptor), hàng đợi mô tả, các chế độ địa chỉ và tùy chọn đảo byte (chi tiết ở mục 4.5). Trạng thái hoàn tất của DMA được nhận biết thông qua cơ chế đọc thăm dò (polling) các thanh ghi trạng thái, nhất quán với việc hệ thống chưa có đường tín hiệu ngắt nối tới bộ xử lý.

Thứ tư, đối với mục tiêu hiện thực dịch vụ quản lý bộ nhớ (mục 1.2.2.4), hệ thống đã hiện thực đơn vị quản lý bộ nhớ với cơ chế phân trang và bộ đệm dịch địa chỉ (TLB), cùng phân cấp bộ nhớ đệm nhiều mức gồm L1I, L1D và L2 (chi tiết ở mục 4.3). Các thành phần này có cơ chế kiểm tra quyền truy cập, phân biệt vùng nhớ có thể lưu đệm và vùng vào/ra ánh xạ bộ nhớ, đồng thời ghi nhận thống kê hoạt động phục vụ cho việc quan sát.

Thứ năm, đối với mục tiêu tích hợp trình biên dịch hợp ngữ, thiết bị ngoại vi và trực quan hóa (mục 1.2.2.5), hệ thống đã hiện thực trình biên dịch hợp ngữ hai lượt hỗ trợ các chỉ thị, lệnh giả và mã hóa lệnh cho ba nhóm RV32I/M/F (chi tiết ở mục 4.1); bốn thiết bị ngoại vi gồm UART, ma trận LED, bàn phím và chuột (chi tiết ở mục 4.6); cùng các khung trực quan hóa gồm sơ đồ SoC động làm nổi bật giao dịch, khung quan sát MMU và bộ nhớ đệm, khung quan sát thanh ghi và bộ nhớ, và nhật ký hệ thống có khả năng lọc theo từng mô-đun (chi tiết ở mục 4.7).

Về mặt kiểm chứng, như đã trình bày ở Chương 5, hệ thống có bằng chứng kiểm thử đơn vị đạt yêu cầu cho các mô-đun trọng tâm gồm trình biên dịch hợp ngữ, MMU, TileLink và DMA; đồng thời đã thiết lập một quy trình đối chiếu nhiều lớp với các công cụ được cộng đồng công nhận: đối chiếu mã hóa lệnh với GNU RISC-V binutils và đối chiếu hành vi thực thi với trình mô phỏng tham chiếu Spike trên bộ `riscv-tests`. Đúng với nguyên tắc trình bày trung thực của Chương 5, các số liệu định lượng tổng hợp của các lớp đối chiếu tham chiếu (số lệnh được đối chiếu/bỏ qua, số tệp kiểm thử đạt/không đạt, phiên bản công cụ và commit của `riscv-tests`) cần được bổ sung kèm log chính thức trước khi đóng bản báo cáo: `[CẦN BỔ SUNG KẾT QUẢ THỰC NGHIỆM]`.

Tổng hợp lại, các đóng góp chính của khóa luận — nhất quán với mục 1.5 — gồm: (1) một trình mô phỏng SoC dựa trên RISC-V RV32IMF chạy trên nền web, tích hợp trong cùng một công cụ trình biên dịch hợp ngữ, lõi xử lý, phân cấp bộ nhớ (cache và MMU), hệ thống bus TileLink, bộ điều khiển DMA và nhiều thiết bị ngoại vi cùng các khung trực quan hóa; (2) mở rộng phạm vi tập lệnh so với khóa luận liên quan trước đó [8] bằng việc bổ sung nhóm lệnh nhân/chia số nguyên (RV32M) và nhóm lệnh dấu phẩy động đơn (RV32F) cùng tệp thanh ghi dấu phẩy động; (3) bổ sung số lượng và chủng loại thiết bị ngoại vi tương tác cùng các khung quan sát bổ trợ; và (4) một quy trình kiểm chứng đối chiếu với GNU binutils và Spike trên `riscv-tests`, kèm bộ kiểm thử nội bộ cho các mô-đun. Những kết quả này cho thấy đề tài đã đạt được mục tiêu tổng quát đặt ra ở mục 1.2.1 là xây dựng một công cụ mô phỏng hành vi của một SoC điển hình dựa trên RISC-V, phục vụ cho mục tiêu giảng dạy và học tập kiến trúc máy tính ở mức hệ thống.

## 6.2. Hạn chế

Bên cạnh các kết quả đạt được, hệ thống còn một số hạn chế cần được nêu rõ; các hạn chế này nhất quán với phạm vi đã công bố ở Bảng 1.2, mục 1.3.2 và các nhận định rút ra từ kiểm thử ở mục 5.8.

Thứ nhất, về phạm vi tập lệnh, hệ thống mới hỗ trợ một tập con của RV32IMF phục vụ mô phỏng: chưa hiện thực các lệnh CSR và chế độ đặc quyền; chưa hiện thực đầy đủ FCSR/fflags/frm cho dấu phẩy động nên chưa kiểm chứng được tính chính xác theo bit (bit-exact) cho mọi trường hợp biên của chuẩn IEEE 754 [9]; và lệnh `fence` mới được mã hóa ở trình biên dịch chứ chưa được lõi xử lý thực thi.

Thứ hai, về giao thức kết nối, TileLink mới được mô phỏng ở mức giao dịch trên hai kênh A/D (tương ứng TileLink-UL và TileLink-UH); hệ thống chưa hiện thực các kênh B, C, E và cơ chế nhất quán bộ nhớ đệm theo cấp độ TileLink-C, do đó các kết quả kiểm thử bus chỉ chứng minh tính đúng đắn của tập con giao dịch đã hiện thực, không phải mức tuân thủ đầy đủ đặc tả TileLink.

Thứ ba, về cơ chế điều phối bus, mặc dù cả CPU và DMA cùng có thể đóng vai trò master, cơ chế hiện tại dựa trên hàng đợi và một giao dịch được xử lý tại một thời điểm, chưa phải một bộ phân xử đa master đầy đủ với chính sách ưu tiên, công bằng hay nhiều giao dịch song song.

Thứ tư, hệ thống chưa có cơ chế ngắt phần cứng tới bộ xử lý. Các thiết bị như UART, bàn phím và bộ điều khiển DMA mới chỉ có các bit trạng thái/điều khiển; việc nhận biết sự kiện và hoàn tất đều dựa trên đọc thăm dò (polling), chưa có bộ điều khiển ngắt và đường tín hiệu IRQ nối tới CPU.

Thứ năm, hệ thống chưa có bộ đánh giá hiệu năng định lượng đầy đủ. Hiện chỉ có sẵn các bộ đếm thống kê trong simulator (tỉ lệ trúng/trượt bộ nhớ đệm, số lần dịch địa chỉ của TLB, số chu kỳ, tốc độ mô phỏng) mà chưa có quy trình đo lặp lại để so sánh định lượng giữa các cấu hình bộ nhớ đệm hay giữa sao chép bằng CPU và sao chép bằng DMA; bên cạnh đó, hiệu năng mô phỏng còn chịu ràng buộc của mô hình thực thi đơn luồng trên trình duyệt.

Thứ sáu, về thiết bị ngoại vi, thiết bị truyền thông CAN tuy được nhắc đến trong định hướng ban đầu nhưng chưa được hiện thực trong hệ thống, và do đó không được xem là một tính năng đã hoàn thành.

## 6.3. Hướng phát triển

Trên cơ sở các hạn chế nêu ở mục 6.2, khóa luận đề xuất một số hướng phát triển, mỗi hướng nhằm khắc phục một hạn chế tương ứng.

**Tăng độ chính xác của mô hình mô phỏng.** Có thể nâng cấp mô hình thực thi từ mức hành vi theo chu kỳ hiện tại lên mức mô phỏng đường ống lệnh (pipeline) hoặc mô phỏng chính xác theo chu kỳ (cycle-accurate) để phản ánh sát hơn hành vi vi kiến trúc. Song song, đối với dấu phẩy động, cần bổ sung thanh ghi điều khiển FCSR cùng các cờ ngoại lệ và chế độ làm tròn động, tiến tới kiểm chứng chính xác theo bit so với chuẩn IEEE 754 [9] trên các trường hợp biên (khắc phục hạn chế về độ chính xác dấu phẩy động ở mục 6.2).

**Hoàn thiện phạm vi tập lệnh.** Bổ sung nhóm lệnh truy cập thanh ghi điều khiển/trạng thái (CSR) và hỗ trợ chế độ đặc quyền, đồng thời hiện thực việc thực thi lệnh `fence` như một thao tác có hiệu lực thay vì chỉ mã hóa. Hướng này giúp hệ thống tiến gần hơn tới một lõi RISC-V đầy đủ và có thể chạy được nhiều chương trình kiểm thử chuẩn hơn (khắc phục hạn chế thứ nhất ở mục 6.2).

**Mở rộng giao thức và cơ chế điều phối bus.** Bổ sung các kênh B, C, E và cơ chế nhất quán bộ nhớ đệm theo cấp độ TileLink-C [7] để mô phỏng được các hệ thống nhiều lõi có chia sẻ bộ nhớ; đồng thời thay cơ chế hàng đợi một giao dịch hiện tại bằng một bộ phân xử đa master thực sự, có chính sách ưu tiên/công bằng và hỗ trợ nhiều giao dịch song song (khắc phục hạn chế thứ hai và thứ ba ở mục 6.2).

**Bổ sung cơ chế ngắt.** Hiện thực một bộ điều khiển ngắt cùng các đường tín hiệu IRQ nối tới bộ xử lý, cho phép các thiết bị như UART, DMA và bàn phím báo sự kiện theo cơ chế ngắt thay cho đọc thăm dò. Hướng này mở rộng khả năng mô phỏng các chương trình nhúng hướng sự kiện (khắc phục hạn chế thứ tư ở mục 6.2).

**Mở rộng hệ thống ngoại vi.** Hiện thực thiết bị truyền thông CAN [18] đã được nêu trong định hướng ban đầu, cùng các thiết bị ngoại vi khác, nhằm làm phong phú thêm các kịch bản mô phỏng vào/ra ở mức hệ thống (khắc phục hạn chế thứ sáu ở mục 6.2).

**Cải thiện hiệu năng và bổ sung đánh giá định lượng.** Tối ưu hóa hiệu năng của trình mô phỏng trong ràng buộc thực thi đơn luồng trên trình duyệt; đồng thời xây dựng một bộ đánh giá định lượng có quy trình đo lặp lại để so sánh tỉ lệ trúng/trượt và chi phí chu kỳ khi bật/tắt hoặc thay đổi cấu hình bộ nhớ đệm, và so sánh giữa sao chép bằng CPU và sao chép bằng DMA trên cùng kích thước dữ liệu (khắc phục hạn chế thứ năm ở mục 6.2). Cần lưu ý rằng phân cấp bộ nhớ đệm L1I/L1D/L2 đã được hiện thực (mục 4.3); hướng phát triển ở đây là tinh chỉnh và đánh giá định lượng chính sách bộ nhớ đệm chứ không phải bổ sung bộ nhớ đệm còn thiếu.

**Mở rộng bộ kiểm thử và tích hợp vào công cụ giảng dạy.** Hoàn thiện và lưu kèm log chính thức cho các lớp đối chiếu với GNU binutils và Spike trên `riscv-tests`, mở rộng độ phủ kiểm thử cho lõi xử lý và các đường tích hợp; trên cơ sở đó, xây dựng các bài thực hành (lab) sử dụng trình mô phỏng để phục vụ trực tiếp cho việc giảng dạy kiến trúc máy tính ở mức hệ thống.

Những hướng phát triển trên vừa giúp khắc phục các hạn chế hiện tại, vừa nâng cao giá trị của hệ thống như một công cụ phục vụ giảng dạy và nghiên cứu kiến trúc máy tính.

---

## Tài liệu tham khảo (trích dẫn trong Chương 6)

> *Ghi chú: Các mục [6]–[9] đã được thiết lập ở Chương 1–2 và được dùng lại trong chương này. Mục [18] là nguồn mới cho thiết bị CAN, đánh số tiếp sau các nguồn của Chương 5; toàn bộ danh sách sẽ được hợp nhất và chuẩn hóa theo IEEE ở mục Tài liệu tham khảo chung của báo cáo.*

[6] A. Waterman và K. Asanović (chủ biên), "The RISC-V Instruction Set Manual, Volume I: Unprivileged ISA," RISC-V International. [Trực tuyến]. Có tại: https://riscv.org/technical/specifications/ *(cần ghi rõ phiên bản và năm khi hoàn thiện)*

[7] SiFive Inc., "TileLink Specification, Version 1.8.1," 2020. *(tài liệu tham chiếu nội bộ: `docs/ref/tilelink_spec_1.8.1.pdf`)*

[8] N. G. B. Ngọc, "Phát triển trình mô phỏng SoC," Khóa luận tốt nghiệp, Trường Đại học Công nghệ Thông tin, Đại học Quốc gia TP. Hồ Chí Minh, 2025.

[9] "IEEE Standard for Floating-Point Arithmetic," IEEE Std 754-2019. *(cần bổ sung thông tin xuất bản đầy đủ khi hoàn thiện)*

[18] Robert Bosch GmbH, "CAN Specification, Version 2.0," 1991; và ISO 11898, "Road vehicles — Controller area network (CAN)." *(nguồn tham khảo cho hướng phát triển thiết bị CAN; cần ghi rõ thông tin xuất bản đầy đủ và ngày truy cập khi hoàn thiện)*
