# Chương 1. TỔNG QUAN ĐỀ TÀI

Chương này trình bày bối cảnh và lý do thực hiện đề tài, khảo sát một số công cụ mô phỏng kiến trúc máy tính đang được sử dụng phổ biến nhằm xác định khoảng trống mà đề tài hướng đến giải quyết. Trên cơ sở đó, chương xác định mục tiêu tổng quát và các mục tiêu kỹ thuật, đối tượng và phạm vi nghiên cứu, phương pháp thực hiện, các đóng góp chính, và mô tả cấu trúc của phần còn lại của báo cáo.

## 1.1. Lý do thực hiện đề tài

### 1.1.1. Bối cảnh và nhu cầu thực tiễn

Kiến trúc máy tính, hệ thống nhúng và hệ thống trên chip (System-on-Chip – SoC) là những nội dung nền tảng trong chương trình đào tạo ngành Kỹ thuật Máy tính. Khác với cách tiếp cận chỉ tập trung vào tập lệnh của một bộ vi xử lý đơn lẻ, một hệ thống tính toán thực tế là sự phối hợp của nhiều thành phần: lõi xử lý, phân cấp bộ nhớ (cache, bộ nhớ chính), đơn vị quản lý bộ nhớ, hệ thống bus kết nối (interconnect), bộ điều khiển truy cập bộ nhớ trực tiếp (Direct Memory Access – DMA) và các thiết bị ngoại vi. Việc hiểu được cách các thành phần này trao đổi dữ liệu và phối hợp hoạt động ở mức hệ thống là một yêu cầu quan trọng nhưng cũng tương đối trừu tượng đối với người học.

Trong những năm gần đây, kiến trúc tập lệnh RISC-V nổi lên như một lựa chọn được quan tâm trong cả giảng dạy và nghiên cứu nhờ tính chất mở, miễn phí bản quyền và thiết kế theo hướng mô-đun: một tập lệnh cơ sở nhỏ gọn (RV32I) cùng các phần mở rộng tùy chọn như nhân/chia số nguyên (M), dấu phẩy động (F), thao tác nguyên tử (A) [6]. Đặc tính mô-đun này khiến RISC-V phù hợp để minh họa từng lớp khái niệm một cách có hệ thống. Bên cạnh đó, hệ sinh thái phần cứng mở xoay quanh RISC-V cũng sử dụng các giao thức kết nối mở, tiêu biểu là TileLink – một giao thức bus được công bố công khai và sử dụng trong nhiều thiết kế SoC dựa trên RISC-V [7]. Do đó, việc tiếp cận đồng thời RISC-V và một giao thức interconnect như TileLink mang lại bức tranh tương đối đầy đủ về cách một SoC hiện đại được tổ chức.

Một khó khăn thường gặp trong quá trình học các nội dung nói trên là tính trừu tượng của các cơ chế bên trong: quá trình dịch địa chỉ ảo sang địa chỉ vật lý, hoạt động của bộ nhớ đệm, các giao dịch trên bus, hay luồng dữ liệu khi DMA vận chuyển khối dữ liệu song song với bộ xử lý. Những cơ chế này khó quan sát trực tiếp trên phần cứng thật và cũng không hiển thị rõ ràng nếu chỉ chạy chương trình ở mức tập lệnh. Vì vậy, các công cụ mô phỏng có khả năng trực quan hóa trạng thái hệ thống theo từng bước được xem là phương tiện hỗ trợ hữu ích cho việc giảng dạy và tự học [CẦN BỔ SUNG TÀI LIỆU THAM KHẢO].

Ngoài yêu cầu về khả năng trực quan hóa, khả năng tiếp cận của công cụ cũng là một yếu tố thực tiễn. Các công cụ yêu cầu cài đặt môi trường phức tạp (ví dụ máy ảo Java, trình biên dịch chéo, hệ điều hành cụ thể) tạo ra rào cản đối với người mới bắt đầu. Một công cụ chạy trực tiếp trên trình duyệt web, không cần cài đặt, sẽ thuận tiện hơn cho mục đích học tập và trình diễn.

Từ những lý do trên, việc xây dựng một trình mô phỏng SoC dựa trên RISC-V, hoạt động trên nền web và có khả năng trực quan hóa hoạt động của toàn hệ thống là một hướng có ý nghĩa thực tiễn đối với việc dạy và học kiến trúc máy tính.

### 1.1.2. Khảo sát các công cụ mô phỏng hiện có

Để xác định rõ khoảng trống mà đề tài hướng đến, phần này khảo sát một số công cụ mô phỏng kiến trúc máy tính đang được sử dụng phổ biến, cùng một khóa luận liên quan trực tiếp được thực hiện trước đó tại đơn vị. Các đặc điểm nêu dưới đây được tổng hợp từ tài liệu chính thức của từng công cụ [1]–[5] và từ khóa luận liên quan [8].

**MARS (MIPS Assembler and Runtime Simulator).** MARS là công cụ mô phỏng hợp ngữ và thực thi cho kiến trúc MIPS, được viết bằng Java và có giao diện đồ họa tích hợp trình soạn thảo, bảng thanh ghi và khung quan sát bộ nhớ [1]. MARS hữu ích cho việc học tập ở mức tập lệnh, tuy nhiên nó hướng đến kiến trúc MIPS thay vì RISC-V, yêu cầu môi trường chạy Java, và tập trung ở mức mô phỏng tập lệnh của một bộ xử lý đơn lẻ; các thành phần ở mức hệ thống như bus kết nối và DMA không nằm trong trọng tâm của công cụ này [1].

**RISC-V Interpreter (Đại học Cornell).** Đây là một công cụ chạy trên web, đơn giản và dễ sử dụng, cho phép biên dịch và quan sát giá trị thanh ghi cơ bản [2]. Tuy nhiên công cụ này không tập trung mô phỏng đường đi dữ liệu (datapath) và không mô phỏng các thiết bị ngoại vi, do đó phù hợp cho việc làm quen với hợp ngữ RISC-V hơn là quan sát hoạt động ở mức hệ thống.

**WebRISC-V.** WebRISC-V là công cụ mô phỏng trên web tập trung vào việc mô phỏng đường đi dữ liệu theo cơ chế nhiều chu kỳ và pipeline của bộ xử lý RISC-V [3]. Trọng tâm của công cụ là hoạt động bên trong lõi xử lý; phạm vi của nó chưa mở rộng đến kiến trúc SoC và chưa hỗ trợ tương tác với các thiết bị ngoại vi.

**Ripes.** Ripes là một công cụ mã nguồn mở nổi bật trong việc trực quan hóa đường đi dữ liệu và pipeline của bộ xử lý, đồng thời có hỗ trợ minh họa bộ nhớ đệm [4]. Ripes tập trung khá sâu vào vi kiến trúc của CPU; theo định hướng so sánh trong đề cương đề tài, mức độ tùy biến hệ thống bus và tích hợp bộ điều khiển DMA phục vụ mục đích mô phỏng SoC ở công cụ này còn hạn chế.

**Spike.** Spike là trình mô phỏng tham chiếu chuẩn của RISC-V International, có độ chính xác cao và thường được dùng làm mô hình tham chiếu để kiểm chứng hành vi thực thi [5]. Tuy nhiên Spike hoạt động qua giao diện dòng lệnh và không cung cấp khả năng trực quan hóa trạng thái hệ thống, nên ít thuận lợi cho việc hình dung hoạt động của hệ thống đối với người học.

**Khóa luận liên quan thực hiện trước đó.** Khóa luận "Phát triển trình mô phỏng SoC" của tác giả Nguyễn Gia Bảo Ngọc (2025) [8] là công trình liên quan trực tiếp nhất, cùng hướng xây dựng trình mô phỏng SoC cho RISC-V và có chung một cán bộ hướng dẫn với đề tài này. Theo phạm vi được trình bày trong khóa luận đó, hệ thống bao gồm lõi xử lý RISC-V ở phạm vi tập lệnh cơ sở RV32I cùng các thao tác nguyên tử trên bộ nhớ, đơn vị quản lý bộ nhớ (MMU), giao thức kết nối TileLink, bộ điều khiển DMA và thiết bị ngoại vi dạng ma trận LED [8]. Phạm vi tập lệnh của khóa luận này tập trung ở RV32I và thao tác nguyên tử, chưa mở rộng sang nhóm lệnh nhân/chia số nguyên (M) và nhóm lệnh dấu phẩy động (F); số lượng thiết bị ngoại vi cũng còn giới hạn. Đây chính là những điểm mà đề tài hiện tại kế thừa và mở rộng.

Bảng 1.1 tổng hợp so sánh các công cụ nói trên theo một số tiêu chí ở mức hệ thống. Các ký hiệu được sử dụng: "Có" – có hỗ trợ rõ ràng; "Hạn chế" – có nhưng ở mức giới hạn hoặc không phải trọng tâm; "Không" – không thuộc phạm vi công cụ.

**Bảng 1.1. So sánh một số công cụ mô phỏng liên quan**

| Tiêu chí | MARS [1] | RISC-V Interpreter [2] | WebRISC-V [3] | Ripes [4] | Spike [5] | KLTN 2025 [8] | Đề tài này |
|---|---|---|---|---|---|---|---|
| Nền tảng | Java (desktop) | Web | Web | Desktop | Dòng lệnh (CLI) | (xem [8]) | Web |
| Kiến trúc tập lệnh | MIPS | RISC-V | RISC-V | RISC-V | RISC-V | RV32I (+atomic) | RV32IMF (tập con) |
| Trình biên dịch hợp ngữ tích hợp | Có | Có | Hạn chế | Có | Không | Có | Có |
| Trực quan hóa thực thi CPU | Hạn chế | Hạn chế | Có (pipeline) | Có (datapath) | Không | Có | Có |
| Phân cấp bộ nhớ (cache, MMU) | Hạn chế | Không | Không | Hạn chế (cache) | Hạn chế | Có (MMU) | Có (cache + MMU) |
| Bus kết nối hệ thống | Không | Không | Không | Hạn chế | Không | Có (TileLink) | Có (TileLink UH/UL) |
| DMA | Không | Không | Không | Hạn chế | Không | Có | Có |
| Thiết bị ngoại vi tương tác | Hạn chế | Không | Không | Hạn chế | Không | Hạn chế (LED) | Có (UART, LED, bàn phím, chuột) |
| Phạm vi mô phỏng ở mức SoC | Không | Không | Không | Hạn chế | Không | Có | Có |

*Ghi chú: Đặc điểm của các công cụ [1]–[5] được tổng hợp từ tài liệu chính thức tương ứng và phần khảo sát trong đề cương đề tài; cột "KLTN 2025" dựa trên phạm vi được trình bày trong khóa luận [8]. Các tính năng được liệt kê ở cột "Đề tài này" tương ứng với những thành phần đã được hiện thực trong mã nguồn của hệ thống (chi tiết trình bày ở Chương 3 và Chương 4).*

### 1.1.3. Khoảng trống nghiên cứu và hướng giải quyết

Từ khảo sát trên có thể rút ra một số nhận xét. Thứ nhất, các công cụ chạy trên web hiện có (RISC-V Interpreter, WebRISC-V) thuận tiện về khả năng tiếp cận nhưng phạm vi mô phỏng dừng ở mức lõi xử lý, chưa bao quát các thành phần ở mức hệ thống như bus, DMA và ngoại vi. Thứ hai, các công cụ có thế mạnh trực quan hóa vi kiến trúc (Ripes) hoặc có độ chính xác tham chiếu cao (Spike) lại hoặc không hướng đến mô phỏng SoC đầy đủ trên nền web, hoặc không cung cấp khả năng trực quan hóa. Thứ ba, khóa luận liên quan thực hiện trước đó [8] đã tiếp cận hướng mô phỏng SoC cho RISC-V nhưng còn giới hạn về phạm vi tập lệnh (chưa có nhóm lệnh nhân/chia số nguyên và dấu phẩy động) và về số lượng thiết bị ngoại vi.

Như vậy, hiện còn thiếu một công cụ hội đủ đồng thời các đặc điểm: (i) chạy trên nền web, không yêu cầu cài đặt; (ii) mô phỏng ở mức hệ thống SoC với đầy đủ lõi xử lý, phân cấp bộ nhớ, bus kết nối, DMA và nhiều loại ngoại vi; (iii) hỗ trợ phạm vi tập lệnh RV32IMF (bao gồm cả nhân/chia số nguyên và dấu phẩy động đơn); (iv) tích hợp sẵn trình biên dịch hợp ngữ và khả năng trực quan hóa trạng thái từng thành phần; và (v) được kiểm chứng đối chiếu với các công cụ tham chiếu được cộng đồng công nhận.

Đề tài này hướng đến lấp khoảng trống đó bằng cách phát triển một trình mô phỏng SoC dựa trên RISC-V RV32IMF và giao thức TileLink, hoạt động hoàn toàn trên trình duyệt web, tích hợp trình biên dịch hợp ngữ, mô phỏng phân cấp bộ nhớ (cache và MMU), hệ thống bus TileLink với bộ điều khiển DMA và các thiết bị ngoại vi tương tác, đồng thời cung cấp các khung quan sát trực quan cho từng thành phần.

## 1.2. Mục tiêu của đề tài

### 1.2.1. Mục tiêu tổng quát

Mục tiêu tổng quát của đề tài là xây dựng một bộ công cụ mô phỏng có khả năng mô tả hành vi của một hệ thống trên chip điển hình dựa trên kiến trúc RISC-V, kèm theo dịch vụ quản lý bộ nhớ, nhằm tạo nên một công cụ hỗ trợ cho mục tiêu giáo dục. Bộ công cụ cho phép người dùng biên dịch mã nguồn hợp ngữ, mô phỏng hoạt động của các thành phần phần cứng và quan sát trạng thái hoạt động của các thành phần được mô phỏng, trên một nền tảng web dễ tiếp cận.

### 1.2.2. Mục tiêu kỹ thuật

Trên cơ sở mục tiêu tổng quát, đề tài đặt ra các mục tiêu kỹ thuật cụ thể như sau. Các mục tiêu này bám theo định hướng trong đề cương đề tài, đồng thời được diễn đạt phù hợp với hiện trạng đã hiện thực trong mã nguồn.

1.2.2.1. Mô phỏng lõi xử lý RISC-V 32-bit, hỗ trợ các nhóm lệnh của RV32IMF gồm tập lệnh số nguyên cơ sở (I), nhóm lệnh nhân/chia số nguyên (M) và nhóm lệnh dấu phẩy động đơn (F). Lõi xử lý có tệp thanh ghi số nguyên, tệp thanh ghi dấu phẩy động và thực hiện chu trình nạp – giải mã – thực thi lệnh (xem source: `src/js/cpu.js`).

1.2.2.2. Tái hiện cơ chế hoạt động của hệ thống bus kết nối dựa trên giao thức TileLink, trong đó cả bộ xử lý và bộ điều khiển DMA đều có vai trò là thành phần chủ động phát yêu cầu (master) trên bus, minh họa quá trình điều phối truy cập tài nguyên giữa các thành phần. Hệ thống phân tách thành hai phân hệ bus là TileLink-UH và TileLink-UL kèm cầu nối giữa hai bus (xem source: `src/js/tilelink_base.js`, `src/js/tilelink_UH.js`, `src/js/tilelink_UL.js`, `src/js/tilelink_bridge.js`, `src/js/soc.js`).

1.2.2.3. Minh họa khả năng giảm tải cho bộ xử lý thông qua cơ chế truy cập bộ nhớ trực tiếp (DMA), cho phép vận chuyển khối dữ liệu một cách độc lập với luồng thực thi lệnh của CPU (xem source: `src/js/dma.js`).

1.2.2.4. Hiện thực dịch vụ quản lý bộ nhớ gồm đơn vị quản lý bộ nhớ với cơ chế phân trang và bộ đệm dịch địa chỉ (TLB), cùng phân cấp bộ nhớ đệm nhiều mức phục vụ cho quá trình truy cập bộ nhớ (xem source: `src/js/mmu.js`, `src/js/SimpleCache.js`).

1.2.2.5. Tích hợp trình biên dịch hợp ngữ và hệ thống thiết bị ngoại vi mô phỏng đa dạng, cùng các khung trực quan hóa hệ thống, cho phép người dùng nạp mã nguồn và quan sát kết quả điều khiển phần cứng (xem source: `src/js/assembler.js`, `src/js/uart.js`, `src/js/led_matrix.js`, `src/js/keyboard.js`, `src/js/mouse.js`, `src/js/soc_diagram.js`, `src/js/javascript.js`).

## 1.3. Đối tượng và phạm vi nghiên cứu

### 1.3.1. Đối tượng nghiên cứu

Đối tượng nghiên cứu của đề tài bao gồm:

- Kiến trúc tập lệnh RISC-V, cụ thể là tập cơ sở RV32I và các phần mở rộng nhân/chia số nguyên (M) và dấu phẩy động đơn (F) [6].
- Kiến trúc hệ thống trên chip và cách tổ chức các thành phần: lõi xử lý, phân cấp bộ nhớ, bus kết nối, DMA và thiết bị ngoại vi.
- Giao thức kết nối TileLink, cụ thể là hai cấp độ TileLink-UL (Uncached Lightweight) và TileLink-UH (Uncached Heavyweight) [7].
- Các cơ chế quản lý bộ nhớ: phân trang, dịch địa chỉ ảo sang vật lý, bộ đệm dịch địa chỉ (TLB) và bộ nhớ đệm (cache).
- Các kỹ thuật xây dựng và trực quan hóa trình mô phỏng trên nền tảng web.

### 1.3.2. Phạm vi và giới hạn

Để bảo đảm tính chính xác khi trình bày, phần này nêu rõ phạm vi đã hiện thực và các giới hạn của hệ thống. Bảng 1.2 tóm tắt phạm vi chức năng theo ba mức: đã hỗ trợ, hỗ trợ một phần và ngoài phạm vi.

Về mức độ mô phỏng, hệ thống mô phỏng ở mức hành vi/chức năng (behavioral/functional), tập trung tái hiện đúng hành vi logic của các thành phần; hệ thống không mô phỏng các đặc tính vật lý như độ trễ định thời chi tiết theo công nghệ chế tạo hay mức tiêu thụ năng lượng. Do được hiện thực bằng JavaScript chạy đơn luồng trên trình duyệt, tốc độ mô phỏng phụ thuộc vào máy của người dùng và không phản ánh tần số hoạt động của một chip thực tế.

Về phạm vi tập lệnh, hệ thống hỗ trợ các nhóm lệnh thuộc RV32IMF phục vụ cho các chương trình ở chế độ người dùng, gồm tập số nguyên cơ sở, nhân/chia số nguyên và dấu phẩy động đơn (xem source: `src/js/cpu.js`, `src/js/assembler.js`). Một số thành phần của kiến trúc RISC-V đầy đủ nằm ngoài phạm vi hiện tại:

- Các lệnh truy cập thanh ghi điều khiển và trạng thái (CSR) cũng như các lệnh thuộc chế độ đặc quyền chưa được hiện thực (xem source: `src/js/cpu.js`, `src/js/assembler.js`).
- Đối với dấu phẩy động, hệ thống thực hiện các phép tính trên số thực đơn theo dạng biểu diễn của chuẩn IEEE 754 [9], nhưng chưa hiện thực thanh ghi điều khiển dấu phẩy động (FCSR), các cờ ngoại lệ (fflags) và lựa chọn chế độ làm tròn động (frm) một cách đầy đủ.
- Lệnh `fence` được trình biên dịch mã hóa nhưng chưa được lõi xử lý giải mã và thực thi như một thao tác có hiệu lực (xem source: `src/js/assembler.js` có mã hóa `fence`; `src/js/cpu.js` không có nhánh thực thi tương ứng).
- Hệ thống có hiện thực lệnh `AMOADD.W` thuộc nhóm thao tác nguyên tử; nhóm lệnh này thuộc phần mở rộng RV32A, nằm ngoài phạm vi của tên đề tài RV32IMF và được xem như một mở rộng minh họa (xem source: `src/js/cpu.js`, `src/js/tilelink.js`).

Về giao thức TileLink, hệ thống mô phỏng ở mức giao dịch trên hai kênh chính là kênh yêu cầu (A) và kênh phản hồi (D), tương ứng các cấp độ TileLink-UL và TileLink-UH; hệ thống chưa hiện thực đầy đủ các kênh B, C, E cùng cơ chế bảo đảm nhất quán bộ nhớ đệm (coherence) theo cấp độ TileLink-C (xem source: `src/js/tilelink.js`). Cơ chế điều phối trên bus được mô hình hóa ở mức hàng đợi yêu cầu với một giao dịch được xử lý tại một thời điểm; trên cơ sở đó, hệ thống thể hiện việc nhiều thành phần (CPU và DMA) cùng đóng vai trò master phát yêu cầu (xem source: `src/js/tilelink_base.js`).

Về cơ chế ngắt, hệ thống hiện chưa có đường tín hiệu ngắt (IRQ) nối tới bộ xử lý; trạng thái hoàn tất của DMA và trạng thái của các thiết bị ngoại vi được nhận biết thông qua cơ chế đọc thăm dò (polling) các thanh ghi trạng thái (xem source: `src/js/dma.js`, `src/js/uart.js`).

Về thiết bị ngoại vi, các thiết bị đã được hiện thực gồm UART, ma trận LED, bàn phím và chuột (xem source: `src/js/uart.js`, `src/js/led_matrix.js`, `src/js/keyboard.js`, `src/js/mouse.js`). Thiết bị truyền thông CAN tuy được nhắc đến trong định hướng ban đầu nhưng không nằm trong phạm vi đã hiện thực của hệ thống, và được để ngỏ cho hướng phát triển về sau.

**Bảng 1.2. Tóm tắt phạm vi chức năng của hệ thống**

| Mức độ | Nội dung |
|---|---|
| Đã hỗ trợ | Trình biên dịch hợp ngữ hai lượt; lõi xử lý với các nhóm lệnh RV32I, RV32M, RV32F; tệp thanh ghi số nguyên và dấu phẩy động; MMU với phân trang và TLB; phân cấp bộ nhớ đệm; bus TileLink-UH/UL và cầu nối; DMA; ngoại vi UART, LED, bàn phím, chuột; trực quan hóa sơ đồ SoC, bộ nhớ, thanh ghi và nhật ký hệ thống |
| Hỗ trợ một phần | Dấu phẩy động đơn theo biểu diễn IEEE 754 nhưng chưa có FCSR/fflags/frm đầy đủ; lệnh `fence` được mã hóa nhưng chưa thực thi; thao tác nguyên tử mới có `AMOADD.W`; điều phối bus ở mức hàng đợi một giao dịch |
| Ngoài phạm vi | Lệnh CSR và chế độ đặc quyền; các kênh B/C/E và nhất quán bộ nhớ đệm của TileLink-C; cơ chế ngắt phần cứng tới CPU; thiết bị CAN; mô phỏng đặc tính định thời/năng lượng vật lý |

### 1.3.3. Định hướng đánh giá

Tính đúng đắn của hệ thống được định hướng đánh giá thông qua việc đối chiếu kết quả với các công cụ tham chiếu được cộng đồng công nhận, kết hợp với bộ kiểm thử nội bộ. Cụ thể, đề tài sử dụng bộ công cụ GNU RISC-V binutils để đối chiếu kết quả mã hóa lệnh và sử dụng Spike làm mô hình tham chiếu cho hành vi thực thi, trên các tập tin kiểm thử từ bộ `riscv-tests` của cộng đồng RISC-V (xem source: `test/README_rv32imf_verification.md`, `test/verify_rv32imf_against_gnu.mjs`, `test/verify_riscv_tests_spike.mjs`). Chi tiết về quy trình và kết quả kiểm thử được trình bày trong Chương 5.

## 1.4. Phương pháp thực hiện

Đề tài được thực hiện theo các phương pháp sau:

**Phương pháp nghiên cứu tài liệu.** Nghiên cứu kiến trúc tập lệnh RISC-V RV32IMF [6], cấu trúc của hệ thống trên chip, các cơ chế quản lý bộ nhớ (phân trang, TLB, cache) và giao thức kết nối TileLink ở hai cấp độ TL-UL và TL-UH [7]. Đồng thời tìm hiểu cách thức triển khai của một số công cụ mô phỏng đã được công bố [1]–[5] để rút ra yêu cầu thiết kế.

**Phương pháp phát triển.** Hiện thực bộ mô phỏng SoC trên nền tảng web sử dụng HTML, CSS và JavaScript theo mô hình mô-đun (ES modules), trong đó mỗi thành phần phần cứng được mô hình hóa thành một mô-đun phần mềm riêng và được lắp ghép tại một thành phần khởi tạo trung tâm (xem source: `src/js/soc.js`, `src/index.html`, `src/js/javascript.js`). Giao diện sử dụng thư viện soạn thảo mã CodeMirror cho vùng nhập hợp ngữ và sử dụng phần tử canvas để hiển thị thiết bị ma trận LED (xem source: `src/index.html`, `src/js/led_matrix.js`).

**Phương pháp kiểm thử.** Đối chiếu kết quả thực thi (trạng thái thanh ghi, bộ nhớ và kết quả mã hóa lệnh) với các công cụ mô phỏng tham chiếu chuẩn thông qua các bộ chương trình kiểm thử, đồng thời xây dựng các kịch bản kiểm thử và chương trình minh họa chạy trực tiếp trên hệ thống (xem source: thư mục `test/`). Sản phẩm cũng được định hướng triển khai dưới dạng ứng dụng web công khai để có thể truy cập qua đường dẫn (xem source: `README.md`).

## 1.5. Đóng góp của đề tài

Các đóng góp chính của đề tài, tương ứng với những thành phần đã được hiện thực trong mã nguồn, bao gồm:

- Một trình mô phỏng SoC dựa trên RISC-V RV32IMF hoạt động trên nền web, tích hợp trong cùng một công cụ: trình biên dịch hợp ngữ, lõi xử lý, phân cấp bộ nhớ (cache và MMU), hệ thống bus TileLink, bộ điều khiển DMA và nhiều thiết bị ngoại vi, cùng các khung trực quan hóa trạng thái hệ thống (xem source: `src/js/soc.js` và các mô-đun thành phần).
- Mở rộng phạm vi tập lệnh so với khóa luận liên quan trước đó [8]: bổ sung nhóm lệnh nhân/chia số nguyên (RV32M) và nhóm lệnh dấu phẩy động đơn (RV32F) cùng tệp thanh ghi dấu phẩy động, bên cạnh tập số nguyên cơ sở (xem source: `src/js/cpu.js`, `src/js/assembler.js`).
- Bổ sung số lượng và chủng loại thiết bị ngoại vi tương tác (UART có cấu hình tốc độ, ma trận LED, bàn phím, chuột) cùng các khung quan sát bổ trợ như sơ đồ SoC động, khung quan sát MMU và bộ nhớ đệm, và nhật ký hệ thống có khả năng lọc theo từng mô-đun (xem source: `src/js/uart.js`, `src/js/led_matrix.js`, `src/js/keyboard.js`, `src/js/mouse.js`, `src/js/soc_diagram.js`, `src/js/system_log_bootstrap.js`).
- Một quy trình kiểm chứng đối chiếu với các công cụ được cộng đồng công nhận (GNU binutils và Spike) trên bộ `riscv-tests`, kèm theo bộ kiểm thử nội bộ cho các mô-đun (xem source: thư mục `test/`).

Những đóng góp trên hướng đến một công cụ phục vụ giảng dạy và học tập kiến trúc máy tính ở mức hệ thống, thay vì chỉ ở mức tập lệnh.

## 1.6. Cấu trúc báo cáo

Phần còn lại của báo cáo được tổ chức như sau:

- **Chương 2 – Cơ sở lý thuyết:** trình bày các kiến thức nền tảng, gồm khái niệm hệ thống trên chip, kiến trúc tập lệnh RISC-V (RV32I, RV32M, RV32F), cơ chế quản lý bộ nhớ và bộ nhớ đệm, giao thức kết nối TileLink, cơ chế DMA, thiết bị ngoại vi và vào/ra ánh xạ bộ nhớ, cùng các công nghệ nền tảng web được sử dụng.
- **Chương 3 – Phân tích và thiết kế hệ thống:** phân tích yêu cầu, trình bày kiến trúc tổng quan của trình mô phỏng SoC, danh sách mô-đun và bản đồ địa chỉ bộ nhớ, mô hình mô phỏng theo chu kỳ, thiết kế giao diện web và luồng thực thi chương trình hợp ngữ.
- **Chương 4 – Hiện thực hệ thống:** mô tả chi tiết hiện thực của từng thành phần: trình biên dịch hợp ngữ, lõi xử lý, hệ thống bộ nhớ (bộ nhớ chính, MMU, cache), hệ thống bus TileLink, bộ điều khiển DMA, các thiết bị ngoại vi và các thành phần trực quan hóa.
- **Chương 5 – Kiểm thử và đánh giá:** trình bày phương pháp và môi trường kiểm thử, kết quả kiểm thử đơn vị, kết quả đối chiếu mã hóa lệnh với GNU binutils và đối chiếu thực thi với Spike trên `riscv-tests`, kết quả các chương trình minh họa, đánh giá và so sánh.
- **Chương 6 – Kết luận và hướng phát triển:** tổng kết các kết quả đạt được, nêu các hạn chế còn tồn tại và đề xuất hướng phát triển trong tương lai.

---

## Tài liệu tham khảo (trích dẫn trong Chương 1)

> *Ghi chú: Danh sách dưới đây liệt kê các tài liệu được trích dẫn trong Chương 1, trình bày theo chuẩn IEEE; danh sách này sẽ được hợp nhất vào mục Tài liệu tham khảo chung của báo cáo. Các mục [1]–[5] được lấy theo đề cương đề tài; cần rà soát lại định dạng và ngày truy cập khi hoàn thiện.*

[1] "MARS MIPS Assembler and Runtime Simulator," Computer Science Department, Missouri State University. Truy cập: 19/01/2026. [Trực tuyến]. Có tại: https://ComputerScience.MissouriState.edu/mars-mips-simulator.htm

[2] "RISC-V Interpreter," Cornell University. Truy cập: 19/01/2026. [Trực tuyến]. Có tại: https://www.cs.cornell.edu/courses/cs3410/2019sp/riscv/interpreter/

[3] "WebRISC-V – RISC-V Pipelined Datapath Simulation Online." Truy cập: 19/01/2026. [Trực tuyến]. Có tại: https://webriscv.altervista.org/

[4] M. B. Petersen, "Ripes," kho mã nguồn GitHub. Truy cập: 19/01/2026. [Trực tuyến]. Có tại: https://github.com/mortbopet/Ripes

[5] "riscv-software-src/riscv-isa-sim (Spike)," RISC-V Software. Truy cập: 19/01/2026. [Trực tuyến]. Có tại: https://github.com/riscv-software-src/riscv-isa-sim

[6] A. Waterman và K. Asanović (chủ biên), "The RISC-V Instruction Set Manual, Volume I: Unprivileged ISA," RISC-V International. [Trực tuyến]. Có tại: https://riscv.org/technical/specifications/ *(cần ghi rõ phiên bản và năm khi hoàn thiện)*

[7] SiFive Inc., "TileLink Specification, Version 1.8.1," 2020. *(tài liệu tham chiếu nội bộ: `docs/ref/tilelink_spec_1.8.1.pdf`)*

[8] N. G. B. Ngọc, "Phát triển trình mô phỏng SoC," Khóa luận tốt nghiệp, Trường Đại học Công nghệ Thông tin, Đại học Quốc gia TP. Hồ Chí Minh, 2025.

[9] "IEEE Standard for Floating-Point Arithmetic," IEEE Std 754-2019. *(cần bổ sung thông tin xuất bản đầy đủ khi hoàn thiện)*
