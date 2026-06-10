# Chương 3. PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG

Trên cơ sở lý thuyết đã trình bày ở Chương 2, chương này phân tích yêu cầu của hệ thống và mô tả thiết kế của trình mô phỏng ở mức kiến trúc. Nội dung tập trung trả lời các câu hỏi mang tính thiết kế: hệ thống gồm những thành phần nào, mỗi thành phần đảm nhận vai trò mô phỏng gì, các thành phần được nối với nhau qua giao diện và cổng kết nối ra sao, không gian địa chỉ được phân chia thế nào, mô hình tiến triển theo chu kỳ được tổ chức ra sao, giao diện web được bố trí thế nào, và một chương trình hợp ngữ được xử lý từ đầu đến cuối theo luồng nào. Các chi tiết hiện thực bên trong từng mô-đun — giải thuật, cấu trúc dữ liệu, bảng mã hóa lệnh, bản đồ thanh ghi của từng thiết bị — không thuộc phạm vi chương này và được trình bày ở Chương 4; những chỗ cần thiết sẽ có câu chuyển tiếp tương ứng. Phần kiểm thử chi tiết được trình bày ở Chương 5; ở đây chỉ nêu các định hướng thiết kế có liên quan đến khả năng kiểm thử.

Để bảo đảm tính chính xác, mỗi thành phần thiết kế được nêu trong chương đều được ánh xạ tới tệp mã nguồn tương ứng qua chú thích "(xem source: …)". Những phần chưa được hiện thực đầy đủ trong mã nguồn được nêu trung thực thay vì khẳng định quá mức, nhất quán với phạm vi và giới hạn đã công bố ở mục 1.3.2 và mục 2.6.3.

## 3.1. Phân tích yêu cầu

Hệ thống được xác định là một công cụ phục vụ học tập và minh họa, có đối tượng sử dụng chính là người học kiến trúc máy tính ở mức hệ thống. Yêu cầu của hệ thống được phân thành hai nhóm: yêu cầu chức năng (mô tả những việc hệ thống phải làm được) và yêu cầu phi chức năng (mô tả các thuộc tính chất lượng mà hệ thống cần đạt). Các yêu cầu được rút ra từ mục tiêu đề tài (mục 1.2), từ mô tả chức năng trong tài liệu dự án và từ các thành phần đã hiện thực trong mã nguồn (xem source: `README.md`, `src/index.html`).

### 3.1.1. Yêu cầu chức năng

Nhóm yêu cầu chức năng bao quát toàn bộ vòng đời thao tác của người học với một chương trình hợp ngữ: soạn thảo, biên dịch, nạp, thực thi (chạy liên tục hoặc theo từng bước), và quan sát trạng thái của các thành phần phần cứng được mô phỏng. Bảng 3.1 liệt kê các yêu cầu chức năng chính kèm mô tả ngắn và tệp nguồn hiện thực tương ứng; chi tiết cách mỗi chức năng được hiện thực được trình bày ở Chương 4.

**Bảng 3.1. Danh sách yêu cầu chức năng của hệ thống**

| Mã | Yêu cầu chức năng | Mô tả ngắn | Nguồn hiện thực |
|---|---|---|---|
| FR1 | Soạn thảo chương trình | Nhập mã hợp ngữ RISC-V trong trình soạn thảo có tô màu cú pháp và gợi ý nhập | `src/index.html`, `src/js/editor_hint.js` |
| FR2 | Biên dịch (assemble) | Biên dịch mã hợp ngữ sang mã máy, báo lỗi theo từng dòng | `src/js/assembler.js` |
| FR3 | Nạp chương trình | Ghi mã máy và dữ liệu vào bộ nhớ, đặt bộ đếm chương trình về địa chỉ bắt đầu | `src/js/soc.js`, `src/js/cpu.js` |
| FR4 | Chạy liên tục | Thực thi liên tục với điều khiển Run/Pause/Stop | `src/js/javascript.js` |
| FR5 | Chạy từng bước | Thực thi từng lệnh một (Step) để quan sát thay đổi trạng thái | `src/js/javascript.js`, `src/js/soc.js` |
| FR6 | Đặt điểm dừng | Đặt điểm dừng (breakpoint) theo dòng lệnh; Run dừng khi tới điểm dừng | `src/js/javascript.js` |
| FR7 | Điều chỉnh tốc độ | Điều chỉnh số chu kỳ mỗi khung hình và hiển thị tốc độ thực thi ước lượng (IPS) | `src/js/javascript.js`, `src/index.html` |
| FR8 | Quan sát thanh ghi | Hiển thị tệp thanh ghi số nguyên (x0–x31) và dấu phẩy động (f0–f31) | `src/index.html`, `src/js/javascript.js` |
| FR9 | Quan sát bộ nhớ | Hiển thị vùng mã lệnh (disassembly) và vùng dữ liệu (hex/ASCII) | `src/index.html`, `src/js/javascript.js` |
| FR10 | Quan sát MMU | Hiển thị cấu hình, bảng trang, bộ đệm dịch địa chỉ (TLB) và lịch sử dịch địa chỉ | `src/index.html`, `src/js/mmu.js`, `src/js/javascript.js` |
| FR11 | Quan sát bộ nhớ đệm | Hiển thị trạng thái và thống kê trúng/trượt của L1I, L1D, L2 | `src/index.html`, `src/js/SimpleCache.js` |
| FR12 | Quan sát sơ đồ SoC | Hiển thị sơ đồ khối động, làm nổi bật các giao dịch trên bus theo thời gian thực | `src/js/soc_diagram.js`, `src/js/javascript.js` |
| FR13 | Tương tác ngoại vi | Tương tác với UART (console), CAN ở mức frame/message, ma trận LED, bàn phím và chuột | `src/index.html`, `src/js/javascript.js` |
| FR14 | Nhật ký hệ thống | Ghi và lọc nhật ký hệ thống theo từng mô-đun (CPU, MMU, cache, bus, DMA…) | `src/js/system_log_bootstrap.js`, `src/index.html` |
| FR15 | Khởi tạo lại hệ thống | Đặt lại trạng thái mô phỏng (Reset) mà vẫn giữ mã nguồn trong trình soạn thảo | `src/js/javascript.js`, `src/js/soc.js` |

Các yêu cầu FR8–FR12 và FR14 phản ánh đặc thù của một công cụ giáo dục: ngoài việc thực thi đúng chương trình, hệ thống còn phải làm cho các trạng thái nội bộ vốn khó quan sát trên phần cứng thật — nội dung bộ nhớ đệm, các mục trong TLB, các giao dịch trên bus — trở nên hiển thị được và theo dõi được theo từng bước.

### 3.1.2. Yêu cầu phi chức năng

Bên cạnh các chức năng, hệ thống cần đáp ứng một số thuộc tính chất lượng sau:

- **Khả năng tiếp cận không cần cài đặt.** Hệ thống phải chạy được trực tiếp trên trình duyệt web hiện đại, không yêu cầu cài đặt môi trường hay biên dịch trước. Đây là một mục tiêu đã nêu ở Chương 1 và định hình lựa chọn nền tảng web tĩnh (xem source: `src/index.html`, `README.md`).
- **Tính trực quan.** Trạng thái của các thành phần phải được trình bày một cách trực quan, có cấu trúc và có làm nổi bật thay đổi (ví dụ tô sáng thanh ghi vừa thay đổi, làm nổi bật đường bus đang có giao dịch), nhằm hỗ trợ việc quan sát và suy luận của người học (xem source: `src/js/javascript.js`, `src/js/soc_diagram.js`).
- **Hiệu năng đủ cho tương tác.** Tốc độ mô phỏng phải đủ để thao tác mượt mà ở chế độ tương tác. Vòng lặp chạy được tổ chức theo cơ chế vẽ lại theo khung hình của trình duyệt, cho phép điều chỉnh số chu kỳ thực thi trên mỗi khung hình và hiển thị tốc độ thực thi ước lượng (xem source: `src/js/javascript.js`). Hệ thống mô phỏng ở mức hành vi nên không nhằm đạt tần số của một chip thật (xem mục 1.3.2).
- **Kiến trúc mã mô-đun và khả năng kiểm thử.** Mã nguồn được tổ chức theo mô-đun ES, trong đó mỗi thành phần phần cứng là một mô-đun JavaScript độc lập và được lắp ghép tại một thành phần khởi tạo trung tâm (xem source: `src/js/soc.js`). Việc các mô-đun được tách rời qua lớp trừu tượng cổng kết nối (mục 3.3.2) giúp mỗi mô-đun có thể được khởi tạo và kiểm thử một cách độc lập, kể cả trong môi trường không có trình duyệt: nhiều mô-đun có thể được nạp và chạy kiểm thử ở chế độ dòng lệnh bằng Node.js (xem source: thư mục `test/`). Đây là một định hướng thiết kế hướng tới khả năng kiểm thử; quy trình và kết quả kiểm thử cụ thể được trình bày ở Chương 5.

### 3.1.3. Mô hình use case tổng quát

Hệ thống có người dùng chính là **người học** (learner) — người sử dụng công cụ để viết, chạy và quan sát chương trình. Vì là một ứng dụng chạy hoàn toàn phía trình duyệt, hệ thống không có đối tượng ngoài (hệ thống bên thứ ba, dịch vụ mạng) trong luồng sử dụng chính. Các trường hợp sử dụng (use case) được nhóm theo vòng đời thao tác đã nêu ở mục 3.1.1.

[Hình 3.1: Sơ đồ use case tổng quát. Một ô "Người học" đặt ở bên trái, nối tới một khung hệ thống "Trình mô phỏng SoC RISC-V" chứa các use case dạng ô chữ nhật: (1) "Soạn thảo chương trình hợp ngữ"; (2) "Biên dịch chương trình"; (3) "Nạp và chạy chương trình"; (4) "Chạy từng bước"; (5) "Quan sát trạng thái hệ thống"; (6) "Tương tác với thiết bị ngoại vi"; (7) "Cấu hình tham số MMU/cache"; (8) "Tra cứu hướng dẫn (Help)". Nhóm "Quan sát trạng thái hệ thống" được nối tới các ô quan sát cụ thể: "Xem thanh ghi", "Xem bộ nhớ", "Xem bộ nhớ đệm", "Xem MMU", "Xem sơ đồ SoC và giao dịch bus", "Xem nhật ký hệ thống". Các đường nối trong hình dùng đoạn thẳng hoặc đoạn gấp khúc để tránh chồng lấn và giữ bố cục dễ đọc.] (xem source: `README.md`, `src/index.html`)

Mô hình use case cho thấy hệ thống được thiết kế xoay quanh một chu trình lặp: người học soạn thảo, biên dịch, chạy, quan sát kết quả, rồi quay lại chỉnh sửa. Toàn bộ thiết kế kiến trúc và giao diện ở các mục tiếp theo phục vụ cho chu trình này.

## 3.2. Kiến trúc tổng quan hệ thống

### 3.2.1. Sơ đồ kiến trúc tổng quan

Về tổng thể, hệ thống tái hiện một SoC RISC-V điển hình theo đúng năm nhóm thành phần đã nêu ở mục 2.1.2: lõi xử lý, phân cấp bộ nhớ, hệ thống kết nối, bộ điều khiển DMA và các thiết bị ngoại vi. Các thành phần này được khởi tạo và nối với nhau tại thành phần khởi tạo trung tâm của trình mô phỏng (xem source: `src/js/soc.js`), trong khi mô tả trực quan của chúng được định nghĩa độc lập cho sơ đồ động (xem source: `src/js/soc_diagram.js`; đối chiếu `docs/ref/SoC.png`).

Đường truy cập bộ nhớ chính đi theo một chuỗi từ lõi xử lý xuống bộ nhớ chính: lõi xử lý phát yêu cầu qua đơn vị quản lý bộ nhớ; đơn vị này dịch địa chỉ rồi chuyển tiếp yêu cầu tới bộ nhớ đệm cấp một (tách riêng phần lệnh và phần dữ liệu); khi trượt, yêu cầu đi tiếp xuống bộ nhớ đệm cấp hai dùng chung; khi vẫn trượt, yêu cầu đi ra bus hiệu năng cao TileLink-UH để tới bộ nhớ chính. Song song với đường này, bộ điều khiển DMA và cầu nối bus nằm bên cạnh lõi xử lý và cùng tham gia vào hệ thống kết nối. Hình 3.2 minh họa kiến trúc tổng quan này.

[Hình 3.2: Kiến trúc tổng quan của trình mô phỏng SoC. Bố cục gồm bốn lớp từ trên xuống.

— Lớp tính toán (trên cùng): khối "RISC-V Core (RV32IMF)" ở giữa và khối "DMA Controller" ở góc phải trên. Hai khối này là các thành phần chủ động (master).

— Lớp bộ nhớ–dịch địa chỉ: ngay dưới lõi xử lý là khối "MMU"; từ MMU tỏa xuống hai khối "L1I Cache" (bên trái) và "L1D Cache" (bên phải); cả hai nối vào khối "L2 Cache" ở giữa.

— Lớp bus: dưới L2 là khối bus "TileLink-UH" (giữa) và khối bus "TileLink-UL" (phải).

— Lớp bộ nhớ và ngoại vi (dưới cùng): khối "Main Memory (RAM)" ở trái nối vào TileLink-UH; hàng ngoại vi gồm "UART", "CAN", "LED Matrix", "Keyboard", "Mouse" nối vào TileLink-UL.

Các cung (mũi tên) và nhãn cổng/bus:
- CPU → MMU: cung một chiều xuống dưới, nhãn cổng `cpu-to-mmu` (nhóm bus core).
- MMU ↔ L1I và MMU ↔ L1D: hai cung hai chiều, nhãn `mmu-to-l1i`, `mmu-to-l1d` (bus core); thể hiện hai cổng tách biệt cho luồng nạp lệnh và luồng dữ liệu.
- L1I ↔ L2 và L1D ↔ L2: hai cung hai chiều, nhãn `l1i-to-l2`, `l1d-to-l2` (bus core).
- L2 ↔ TileLink-UH: cung hai chiều, nhãn `l2-to-tilelink-uh` (bus UH).
- TileLink-UH ↔ Main Memory: cung hai chiều, nhãn `uh-to-main-memory` (bus UH).
- TileLink-UH ↔ DMA: hai cung hai chiều chạy vòng lên góc phải — một cung là DMA đóng vai trò master phát yêu cầu lên UH (nhãn `uh-to-dma`), một cung là các thanh ghi điều khiển DMA đóng vai trò slave nhận yêu cầu từ UH (nhãn `uh-to-dma-regs`).
- TileLink-UH ↔ TileLink-UL: cung hai chiều qua cầu nối, nhãn `bridge (UH↔UL)`; thể hiện hai cầu nối một chiều ghép lại (UH→UL và UL→UH).
- TileLink-UL ↔ DMA: cung hai chiều, nhãn `ul-to-dma`; thể hiện DMA cũng là master trên bus UL.
- TileLink-UL → {UART, CAN, LED Matrix, Keyboard, Mouse}: năm cung hai chiều xuống hàng ngoại vi, gồm `ul-to-uart`, `ul-to-can`, `ul-to-led`, `ul-to-keyboard`, `ul-to-mouse`.

Chú giải màu: nhóm "compute/master" (CPU, DMA), nhóm "memory & cache" (MMU, L1I, L1D, L2, RAM), nhóm "TileLink interconnect" (UH, UL), nhóm "MMIO peripherals" (UART, CAN, LED, Keyboard, Mouse). Điểm cần nhấn mạnh: khối DMA có cung nối tới CẢ HAI bus UH và UL, thể hiện DMA là master trên cả hai phân hệ bus.] (xem source: `src/js/soc.js`, `src/js/soc_diagram.js`)

Có hai đặc điểm thiết kế cần nêu rõ để tránh hiểu nhầm về phạm vi.

Thứ nhất, về vai trò của bus TileLink-UH. Trong nhãn hiển thị của giao diện, bus này được gọi là "coherent bus (high-speed)"; tuy nhiên, đúng như đã phân tích ở mục 2.6.3, hệ thống chỉ hiện thực mô hình giao dịch trên hai kênh A và D, không hiện thực các kênh B/C/E cùng cơ chế bảo đảm nhất quán bộ nhớ đệm. Vì vậy, trong báo cáo này, TileLink-UH được hiểu là **bus hiệu năng cao** dành cho truy cập bộ nhớ khối lượng lớn (cho phép truyền chuỗi và thao tác nguyên tử), còn TileLink-UL là **bus nhẹ** dành cho các thiết bị ngoại vi đơn giản; cả hai đều ở mức giao dịch, không phải bus có nhất quán bộ nhớ đệm theo nghĩa đầy đủ của TileLink-C [2].

Thứ hai, về tính "đa master". Hệ thống có hai thành phần cùng đóng vai trò master phát yêu cầu trên bus là lõi xử lý (thông qua đường L2 → TileLink-UH) và bộ điều khiển DMA. Đây là cơ sở để minh họa việc nhiều thành phần cùng truy cập tài nguyên chung. Tuy nhiên, cơ chế điều phối hiện được mô hình hóa ở mức hàng đợi yêu cầu với một giao dịch được xử lý tại một thời điểm, chưa phải là một cơ chế phân xử (arbitration) đa master đầy đủ (xem mục 2.6.3; source: `src/js/tilelink_base.js`). Hệ thống cũng chưa có đường tín hiệu ngắt (IRQ) tới lõi xử lý; trạng thái hoàn tất của DMA và trạng thái thiết bị ngoại vi được nhận biết qua đọc thăm dò (xem mục 1.3.2).

### 3.2.2. Danh sách mô-đun và vai trò

Mỗi khối phần cứng trong sơ đồ kiến trúc được hiện thực bằng một hoặc một nhóm mô-đun phần mềm. Bảng 3.2 liệt kê các thành phần thiết kế, vai trò mô phỏng, tệp hiện thực và ghi chú về cổng kết nối. Bảng được trình bày ở mức vai trò và giao diện kết nối; chi tiết nội bộ của từng mô-đun được trình bày ở Chương 4.

**Bảng 3.2. Danh sách mô-đun của hệ thống và vai trò mô phỏng**

| Thành phần thiết kế | Vai trò mô phỏng | File hiện thực | Ghi chú (cổng/kết nối) |
|---|---|---|---|
| Lõi xử lý (RV32IMF) | Thực thi lệnh theo chu trình nạp–giải mã–thực thi; tệp thanh ghi số nguyên và dấu phẩy động; phát yêu cầu truy cập bộ nhớ | `src/js/cpu.js` | Master chính; có cổng trên (upper) và cổng dưới (lower) nối xuống MMU; truy cập bộ nhớ theo mô hình bất đồng bộ |
| Đơn vị quản lý bộ nhớ (MMU) | Dịch địa chỉ ảo sang vật lý, TLB, kiểm tra quyền, xác định vùng có thể lưu đệm | `src/js/mmu.js` | Nằm trên đường CPU → bộ nhớ đệm; có cổng lệnh và cổng dữ liệu riêng; không phải tầng được cấp xung riêng |
| Bộ nhớ đệm L1I / L1D | Bộ nhớ đệm cấp một, tách riêng phần lệnh và phần dữ liệu | `src/js/SimpleCache.js`, `src/js/soc.js` | Nối lên MMU, nối xuống L2; bỏ qua đệm với vùng không lưu đệm |
| Bộ nhớ đệm L2 | Bộ nhớ đệm cấp hai dùng chung, phục vụ trượt của L1 | `src/js/SimpleCache.js`, `src/js/soc.js` | Nhận từ L1I/L1D, nối xuống TileLink-UH |
| Bộ nhớ chính (RAM) | Lưu mã lệnh và dữ liệu; mô hình độ trễ và đáp ứng theo beat | `src/js/mem.js` | Slave trên TileLink-UH cho mọi địa chỉ không thuộc MMIO |
| Lõi giao thức TileLink | Định nghĩa mã thao tác kênh A/D, mặt nạ byte, thao tác nguyên tử, ảnh chụp giao dịch | `src/js/tilelink.js` | Thư viện dùng chung cho các bus và endpoint |
| Hạ tầng interconnect | Hàng đợi yêu cầu/phản hồi, định tuyến master/slave theo địa chỉ | `src/js/tilelink_base.js` | Lớp cơ sở của hai bus; một giao dịch in-flight |
| Bus TileLink-UH | Bus hiệu năng cao cho RAM, thanh ghi DMA và cầu nối; cho phép đủ tập thao tác (kể cả nguyên tử) | `src/js/tilelink_UH.js` | Nối L2, RAM, DMA (master + thanh ghi), cầu nối UH→UL |
| Bus TileLink-UL | Bus nhẹ cho thiết bị ngoại vi; cho phép đọc/ghi và lệnh gợi ý | `src/js/tilelink_UL.js` | Nối UART, CAN, LED, bàn phím, chuột, DMA (master), cầu nối UL→UH |
| Cầu nối UH↔UL | Chuyển giao dịch giữa bus hiệu năng cao và bus ngoại vi | `src/js/tilelink_bridge.js` | Hai cầu nối một chiều; slave trên bus này, truy cập trực tiếp sang bus kia |
| Lớp cổng kết nối (Port) | Trừu tượng hóa việc nối hai mô-đun hoặc đăng ký endpoint vào bus | `src/js/port_link.js` | Cung cấp các loại cổng link/upper/lower/memory |
| Bộ điều khiển DMA | Truyền khối dữ liệu độc lập với CPU theo mô tả truyền | `src/js/dma.js`, `src/js/soc.js` | Master trên cả UH và UL; thanh ghi điều khiển là slave trên UH (0xFFED0000) |
| UART | Giao tiếp nối tiếp dạng console, có cấu hình tốc độ | `src/js/uart.js`, `src/js/soc.js` | Endpoint MMIO không lưu đệm trên UL (0x10000000) |
| Bộ điều khiển CAN | Mô phỏng CAN controller ở mức frame/message qua MMIO với TX/RX FIFO, loopback và ID chuẩn/mở rộng | `src/js/can.js`, `src/js/soc.js` | Endpoint MMIO không lưu đệm trên UL (`0xFF200000`–`0xFF2000FF`); phục vụ giáo dục và demo SoC, không mô phỏng bit-level/physical layer đầy đủ |
| Ma trận LED | Hiển thị lưới 32×32 điểm ảnh từ vùng bộ nhớ hiển thị | `src/js/led_matrix.js`, `src/js/soc.js` | Endpoint MMIO trên UL (0xFF000000); vẽ bằng canvas |
| Bàn phím | Bộ đệm ký tự nhập vào để phần mềm đọc thăm dò | `src/js/keyboard.js`, `src/js/soc.js` | Endpoint MMIO trên UL (0xFFFF0000) |
| Chuột | Cung cấp tọa độ con trỏ và trạng thái nút qua thanh ghi | `src/js/mouse.js`, `src/js/soc.js` | Endpoint MMIO trên UL (0xFF100000) |
| Sơ đồ SoC động | Vẽ sơ đồ khối SVG và làm nổi bật giao dịch bus | `src/js/soc_diagram.js` | Đọc dấu vết giao dịch từ thành phần khởi tạo trung tâm |
| Nhật ký hệ thống | Bắt, phân loại và lọc nhật ký theo từng mô-đun | `src/js/system_log_bootstrap.js`, `src/index.html` | Hỗ trợ quan sát và gỡ lỗi |
| Trình biên dịch hợp ngữ | Biên dịch hai lượt mã hợp ngữ sang mã máy | `src/js/assembler.js`, `src/js/editor_hint.js` | Sinh dữ liệu nạp vào bộ nhớ |
| Vỏ giao diện web | Bố cục, thanh bên, các view, bảng thanh ghi/bộ nhớ, vùng I/O, log | `src/index.html`, `src/style.css` | Khung trình bày |
| Vòng điều khiển và cập nhật giao diện | Điều phối assemble/run/step/reset, vẽ lại trạng thái, đo IPS | `src/js/javascript.js` | Lớp kết nối giao diện với lõi mô phỏng |
| Thành phần khởi tạo trung tâm | Khởi tạo mô-đun, lập bản đồ địa chỉ, nối cổng, điều phối vòng tick | `src/js/soc.js` | Nơi lắp ghép toàn hệ thống |

### 3.2.3. Bản đồ địa chỉ bộ nhớ

Các thành phần của hệ thống chia sẻ một không gian địa chỉ phẳng 32 bit. Việc một địa chỉ thuộc về bộ nhớ chính hay thuộc về một thiết bị ngoại vi, và việc một truy cập đi qua bus nào, được quyết định bởi bản đồ địa chỉ cấu hình tại thành phần khởi tạo trung tâm (xem source: `src/js/soc.js`). Bản đồ này cũng xác định thuộc tính có thể lưu đệm của từng vùng: các vùng thuộc thiết bị ngoại vi và vùng thanh ghi DMA được đánh dấu không lưu đệm để mọi truy cập tác động trực tiếp lên thiết bị, phù hợp với đặc tính của vùng MMIO (xem mục 2.8); mọi địa chỉ còn lại được coi là bộ nhớ chính và có thể lưu đệm. Bảng 3.3 tổng hợp bản đồ địa chỉ.

**Bảng 3.3. Bản đồ địa chỉ bộ nhớ của hệ thống**

| Vùng / thiết bị | Địa chỉ nền (base) | Kích thước | Dải địa chỉ | Bus | Có thể lưu đệm |
|---|---|---|---|---|---|
| Bộ nhớ chính (RAM) | (mọi địa chỉ không thuộc MMIO) | — | Phần còn lại của không gian địa chỉ | TileLink-UH | Có |
| UART | `0x10000000` | 20 byte (`0x14`) | `0x10000000`–`0x10000013` | TileLink-UL | Không |
| LED Matrix (VRAM) | `0xFF000000` | 4096 byte (32×32×4) | `0xFF000000`–`0xFF000FFF` | TileLink-UL | Không |
| Mouse | `0xFF100000` | 20 byte (`0x14`) | `0xFF100000`–`0xFF100013` | TileLink-UL | Không |
| CAN Controller | `0xFF200000` | 256 byte (`0x100`) | `0xFF200000`–`0xFF2000FF` | TileLink-UL | Không |
| DMA (thanh ghi điều khiển) | `0xFFED0000` | 8 byte (`0x08`) | `0xFFED0000`–`0xFFED0007` | TileLink-UH | Không |
| Keyboard | `0xFFFF0000` | 8 byte (`0x08`) | `0xFFFF0000`–`0xFFFF0007` | TileLink-UL | Không |

Trong vùng bộ nhớ chính, trình biên dịch hợp ngữ sử dụng hai địa chỉ nền quy ước để nạp chương trình: vùng mã lệnh (`.text`) bắt đầu tại `0x00400000` và vùng dữ liệu (`.data`) bắt đầu tại `0x10010000` (xem source: `src/js/assembler.js`). Cả hai vùng này đều là địa chỉ bộ nhớ chính, do đó được truy cập qua TileLink-UH và có thể lưu đệm. Có thể thấy vùng dữ liệu `0x10010000` nằm cao hơn dải của UART (`0x10000000`–`0x10000013`) nên không xảy ra chồng lấn giữa vùng dữ liệu chương trình và vùng MMIO. Bản đồ địa chỉ này là cơ sở để hệ thống định tuyến mỗi yêu cầu tới đúng thành phần đích; cơ chế định tuyến cụ thể được trình bày ở mục 3.3.2 và Chương 4.

## 3.3. Mô hình mô phỏng theo chu kỳ và trừu tượng kết nối

Mục này trình bày hai trụ cột thiết kế khiến cho việc lắp ghép một hệ thống nhiều thành phần trở nên khả thi và quan sát được: mô hình tiến triển theo chu kỳ thống nhất cho toàn hệ thống, và lớp trừu tượng cổng kết nối tách rời mô-đun khỏi cách chúng được đấu nối.

### 3.3.1. Mô hình tick theo chu kỳ

Toàn hệ thống tiến triển theo các bước chu kỳ rời rạc. Mỗi lần gọi thao tác tiến một bước (`tick`) tại thành phần khởi tạo trung tâm tương ứng với một chu kỳ mô phỏng và làm tăng bộ đếm chu kỳ lên một (xem source: `src/js/soc.js`). Trong mỗi chu kỳ, các mô-đun được cho tiến một bước theo một **thứ tự cố định** từ phía phát yêu cầu xuống phía phục vụ yêu cầu: lõi xử lý, rồi bộ điều khiển DMA, rồi bộ nhớ đệm L1I, L1D, rồi bộ nhớ đệm L2, rồi bus TileLink-UH, bus TileLink-UL, rồi bộ nhớ chính, và cuối cùng là UART. Đơn vị quản lý bộ nhớ không được cấp một bước tiến riêng trong vòng này: nó thực hiện việc dịch địa chỉ ngay trên đường yêu cầu đi từ lõi xử lý xuống bộ nhớ đệm (mục 3.3.2), chứ không phải là một tầng được cấp xung độc lập.

Việc cố định thứ tự tiến bước theo chiều truyền yêu cầu nhằm mục đích để mỗi chặng (hop) trên đường đi của một yêu cầu tiêu tốn đúng một chu kỳ, qua đó phản ánh tương quan chi phí giữa các chặng một cách nhất quán (xem source: ghi chú thiết kế trong `src/js/soc.js`). Để biểu diễn tương quan chi phí giữa các loại truy cập, hệ thống còn gán các giá trị độ trễ theo số chu kỳ cho từng thao tác — ví dụ truy cập trúng/trượt ở mỗi cấp bộ nhớ đệm và độ trễ của bộ nhớ chính — như đã nêu ở mục 2.5; các tham số cụ thể được trình bày ở Chương 4. Cần nhắc lại rằng đây là mô hình ở mức hành vi, không phải mô phỏng chính xác theo chu kỳ của vi kiến trúc (xem mục 2.2).

Một hệ quả quan trọng của mô hình này là lõi xử lý truy cập bộ nhớ theo cách **bất đồng bộ**: khi cần nạp lệnh hoặc thực hiện một lệnh nạp/lưu, lõi xử lý phát một yêu cầu xuống cổng dưới rồi tạm dừng, giữ nguyên bộ đếm chương trình, cho đến khi phản hồi tương ứng quay về ở một chu kỳ sau; khi đó lệnh được "thực hiện lại" để hoàn tất và bộ đếm chương trình mới tiến tới lệnh kế tiếp (xem source: `src/js/cpu.js`). Nhờ vậy, một lệnh có truy cập bộ nhớ có thể trải dài qua nhiều chu kỳ tương ứng với thời gian dữ liệu di chuyển qua các tầng. Chi tiết máy trạng thái truy cập bộ nhớ của lõi xử lý được trình bày ở Chương 4.

[Hình 3.3: Trình tự tiến bước trong một chu kỳ và sự lan truyền yêu cầu qua nhiều chu kỳ. Phần trên của hình là một dải ngang biểu diễn thứ tự tiến bước cố định trong MỘT chu kỳ, gồm các ô nối tiếp theo chiều mũi tên: "CPU.tick" → "DMA.tick" → "L1I.tick" → "L1D.tick" → "L2.tick" → "TileLink-UH.tick" → "TileLink-UL.tick" → "Memory.tick" → "UART.tick", kết thúc bằng thao tác "cycleCount += 1". Phần dưới của hình là một biểu đồ thời gian (các cột là chu kỳ N, N+1, N+2, …) cho một thao tác nạp dữ liệu: tại chu kỳ N, CPU phát yêu cầu Get xuống MMU/L1D và chuyển sang trạng thái chờ (PC bị "đóng băng", ký hiệu bằng ô tô đậm "stall"); các chu kỳ kế tiếp, yêu cầu lan dần L1D → L2 → TileLink-UH → Main Memory (mỗi chặng một chu kỳ); tại Main Memory yêu cầu chờ thêm số chu kỳ bằng độ trễ bộ nhớ; sau đó phản hồi AccessAckData lan ngược trở lại CPU; ở chu kỳ nhận phản hồi, CPU "thực hiện lại" lệnh, ghi kết quả vào thanh ghi và cho PC tiến tới lệnh kế. Mũi tên xuống biểu diễn yêu cầu, mũi tên lên biểu diễn phản hồi.] (xem source: `src/js/soc.js`, `src/js/cpu.js`)

Thao tác khởi tạo lại (reset) đặt bộ đếm chu kỳ về 0 và khôi phục trạng thái ban đầu cho toàn bộ mô-đun và thiết bị ngoại vi, được thực hiện bằng cách khởi tạo lại thành phần trung tâm (xem source: `src/js/soc.js`). Ngoài chế độ chạy liên tục, hệ thống còn hỗ trợ chạy theo từng lệnh: thao tác bước-một-lệnh lặp việc tiến chu kỳ cho đến khi số lệnh hoàn tất tăng thêm một, tức là tới khi đúng một lệnh được hoàn thành (kể cả khi lệnh đó phải chờ qua nhiều chu kỳ truy cập bộ nhớ) (xem source: `src/js/soc.js`).

### 3.3.2. Trừu tượng cổng kết nối (Port)

Để các mô-đun không phụ thuộc trực tiếp vào nhau, hệ thống đưa vào một lớp trừu tượng trung gian gọi là **cổng kết nối** (Port). Một đối tượng cổng đóng vai trò trung gian: hoặc nối trực tiếp hai mô-đun theo kiểu điểm–điểm, hoặc đăng ký một mô-đun như một endpoint vào một bus/interconnect. Nhờ lớp này, mỗi mô-đun chỉ cần cung cấp một giao diện thống nhất gồm các thao tác gửi/nhận yêu cầu và gửi/nhận phản hồi, mà không cần biết phía bên kia là mô-đun cụ thể nào hay được đấu nối ra sao (xem source: `src/js/port_link.js`).

Lớp cổng định nghĩa bốn loại cổng tương ứng với bốn tình huống đấu nối:

- **Cổng liên kết (link)** nối trực tiếp hai mô-đun theo kiểu điểm–điểm. Khi gắn, cổng yêu cầu mô-đun phía trên (upper) và mô-đun phía dưới (lower) cùng đăng ký tham chiếu tới nhau qua cổng này. Đây là loại cổng dùng cho chuỗi lõi xử lý → MMU → bộ nhớ đệm.
- **Cổng phía trên (upper)** đăng ký một thành phần chủ động (master/requester) vào một bus host. Lõi xử lý và bộ điều khiển DMA được đưa lên bus theo loại cổng này.
- **Cổng phía dưới (lower)** đăng ký một thành phần bị động (slave/target) vào bus host, kèm một hàm phán đoán địa chỉ (match) để bus quyết định những địa chỉ nào sẽ được định tuyến tới thành phần này. Bộ nhớ chính, các thanh ghi DMA, các endpoint ngoại vi và cầu nối đều được đăng ký theo loại cổng này, mỗi loại kèm điều kiện địa chỉ tương ứng từ bản đồ địa chỉ ở mục 3.2.3.
- **Cổng bộ nhớ (memory)** cung cấp một "khung nhìn bộ nhớ" để một số thao tác truy cập trực tiếp hoặc gỡ lỗi có thể nhìn thấy bộ nhớ phía dưới.

Trên giao diện thống nhất đó, cổng chuyển tiếp một yêu cầu từ phía trên xuống phía dưới (thao tác gửi yêu cầu được ánh xạ thành thao tác nhận yêu cầu của mô-đun phía dưới) và chuyển tiếp một phản hồi từ phía dưới ngược lên phía trên. Cổng được thiết kế để dung hòa hai quy ước đặt tên thao tác khác nhau có thể tồn tại giữa các mô-đun (một số mô-đun trả phản hồi bằng thao tác "gửi phản hồi", số khác bằng "nhận phản hồi"), nhờ đó các mô-đun viết độc lập vẫn ghép nối được với nhau. Ngoài ra, các hàm tiện ích đọc/ghi trực tiếp được chuyển tiếp qua cổng để phục vụ các endpoint MMIO và bộ nhớ (xem source: `src/js/port_link.js`).

Việc lắp ghép toàn hệ thống được thực hiện tập trung bằng các hàm trợ giúp gắn cổng: một hàm tổng quát để nối hai mô-đun hoặc gắn một mô tả cổng vào bus, cùng hai hàm chuyên biệt để gắn riêng cổng lệnh và cổng dữ liệu cho đơn vị quản lý bộ nhớ (phản ánh việc MMU có hai đường tách biệt tới L1I và L1D). Nhờ tách bạch giữa "định nghĩa mô-đun" và "cách đấu nối", thành phần khởi tạo trung tâm có thể mô tả toàn bộ tô-pô kết nối của hệ thống một cách tường minh tại một nơi (xem source: `src/js/soc.js`).

[Hình 3.4: Mô hình cổng kết nối giữa các mô-đun. Bên trái minh họa cổng liên kết điểm–điểm: ba khối "CPU", "MMU", "Cache" xếp dọc; giữa CPU và MMU là một đối tượng "Port (link)", giữa MMU và Cache là một "Port (link)" khác. Mỗi cổng có hai mũi tên: mũi tên đi xuống nhãn "sendRequest → receiveRequest" (yêu cầu) và mũi tên đi lên nhãn "receiveResponse ← sendResponse" (phản hồi). Bên phải minh họa cách gắn endpoint vào bus: một khối bus "TileLink-UH" ở giữa; phía trên bus, một "Port (upper)" gắn master "CPU/L2" và một "Port (upper)" gắn master "DMA"; phía dưới bus, các "Port (lower)" gắn các slave "Main Memory", "DMA Regs", "Bridge→UL", mỗi cổng lower kèm nhãn "match(addr)" thể hiện điều kiện địa chỉ định tuyến. Một "Port (memory)" nhỏ gắn vào bus để biểu thị khung nhìn bộ nhớ phục vụ gỡ lỗi.] (xem source: `src/js/port_link.js`, `src/js/soc.js`)

## 3.4. Thiết kế giao diện web

Giao diện web là nơi người học tương tác với toàn bộ hệ thống. Thiết kế giao diện hướng tới hai mục tiêu đã nêu trong yêu cầu phi chức năng: cho phép thao tác trọn vẹn chu trình soạn thảo–biên dịch–chạy–quan sát, và trình bày trạng thái nội bộ của hệ thống một cách trực quan, có cấu trúc.

### 3.4.1. Bố cục và điều hướng

Giao diện được tổ chức thành ba khu vực: một thanh bên dọc bên trái để điều hướng giữa các khung nhìn (view), một thanh công cụ ngang phía trên để điều khiển thực thi, và một vùng nội dung chính ở giữa hiển thị khung nhìn đang được chọn (xem source: `src/index.html`, `src/style.css`).

Thanh bên gồm bảy mục điều hướng, mỗi mục tương ứng một khung nhìn: **Editor** (soạn thảo và thanh ghi), **SoC** (sơ đồ khối hệ thống), **MMU** (đơn vị quản lý bộ nhớ), **Cache** (bộ nhớ đệm), **Memory** (bộ nhớ lệnh và dữ liệu), **I/O** (thiết bị ngoại vi) và **Help** (hướng dẫn). Tại mỗi thời điểm chỉ một khung nhìn được hiển thị; việc chọn một mục trên thanh bên sẽ chuyển khung nhìn tương ứng (xem source: `src/index.html`, `src/js/javascript.js`). Bảng 3.4 tóm tắt vai trò của bảy khung nhìn.

**Bảng 3.4. Bảy khung nhìn của giao diện và nội dung chính**

| Khung nhìn | Nội dung chính | Phục vụ yêu cầu |
|---|---|---|
| Editor | Trình soạn thảo mã hợp ngữ; bảng kết quả mã máy (console/binary output); bảng thanh ghi số nguyên và dấu phẩy động | FR1, FR2, FR8 |
| SoC | Sơ đồ khối động của toàn hệ thống; làm nổi bật đường bus đang có giao dịch; chú giải và tooltip | FR12 |
| MMU | Tổng quan và cấu hình; bảng trang phần mềm; bảng TLB; lịch sử dịch địa chỉ gần đây | FR10 |
| Cache | Trạng thái L1I, L1D, L2 (tập, đường, hợp lệ, bẩn, thẻ); thống kê trúng/trượt | FR11 |
| Memory | Bộ nhớ lệnh (địa chỉ, mã máy, disassembly, cột đặt điểm dừng); vùng dữ liệu theo hàng, chuyển đổi hex/ASCII | FR6, FR9 |
| I/O | Ma trận LED; console UART; khung CAN TX/RX và inject frame; ô nhập bàn phím và trạng thái bộ đệm | FR13 |
| Help | Tra cứu lệnh, pseudo-instruction, directive, syscall, bản đồ địa chỉ và hướng dẫn quy trình chạy | (hỗ trợ FR1–FR5) |

Thanh công cụ phía trên chứa các nút điều khiển thực thi theo đúng vòng đời thao tác: **Assemble** (biên dịch và nạp), **Reset** (khởi tạo lại), **Run** (chạy liên tục), **Pause** (tạm dừng/tiếp tục), **Stop** (dừng hẳn) và **Step** (chạy từng bước). Bên cạnh đó là một thanh trượt điều chỉnh tốc độ (Speed) cho phép thay đổi số chu kỳ thực thi trên mỗi khung hình, và một chỉ số hiển thị tốc độ thực thi ước lượng (IPS — số lệnh/chu kỳ trên giây) cập nhật trong khi chạy (xem source: `src/index.html`, `src/js/javascript.js`). Trạng thái khả dụng của các nút thay đổi theo trạng thái chạy: ví dụ Pause và Stop chỉ được kích hoạt khi chương trình đang chạy, còn Step bị vô hiệu hóa khi đang chạy liên tục mà chưa tạm dừng.

[Hình 3.5: Giao diện web tổng quan. Bố cục ba khu vực. (1) Thanh bên dọc bên trái: bảy biểu tượng xếp dọc kèm nhãn theo thứ tự Editor, SoC, MMU, Cache, Memory, I/O, Help; mục đang chọn được tô nổi. (2) Thanh công cụ ngang phía trên vùng chính: từ trái sang phải là nút "Assemble", dấu ngăn cách, các nút "Reset", "Run", "Pause", "Stop", "Step", dấu ngăn cách, thanh trượt "Speed: 1x", và ô chỉ số "IPS: 0 Hz". (3) Vùng nội dung chính (đang hiển thị khung Editor): chia hai cột — cột trái phía trên là vùng soạn thảo mã hợp ngữ (có đánh số dòng và tô màu cú pháp), phía dưới là khung "Console / Binary Output"; cột phải là bảng thanh ghi với hai thẻ "Registers" (số nguyên) và "Floating Point".] (xem source: `src/index.html`, `src/style.css`, `src/js/javascript.js`; đối chiếu `screenshot.png`)

### 3.4.2. Các khung quan sát trạng thái

Ngoài khu vực soạn thảo và điều khiển, phần lớn giao diện dành cho việc quan sát trạng thái. Mục này mô tả hai nhóm khung quan sát tiêu biểu là khung thanh ghi và khung bộ nhớ; các khung còn lại (MMU, Cache, SoC, I/O, nhật ký hệ thống) hiển thị trạng thái của các mô-đun tương ứng và được trình bày chi tiết ở Chương 4.

Khung thanh ghi nằm trong khung nhìn Editor, gồm hai bảng chuyển đổi qua thẻ. Bảng thanh ghi số nguyên hiển thị 32 thanh ghi x0–x31 cùng giá trị ở dạng thập lục phân và thập phân; bảng thanh ghi dấu phẩy động hiển thị 32 thanh ghi f0–f31 cùng giá trị số thực và biểu diễn bit ở dạng thập lục phân. Khi một thanh ghi thay đổi giá trị sau một bước thực thi, ô tương ứng được tô sáng để người học dễ nhận ra (xem source: `src/index.html`, `src/js/javascript.js`).

Khung bộ nhớ nằm trong khung nhìn Memory, gồm hai bảng. Bảng bộ nhớ lệnh (Instruction Memory) liệt kê từng lệnh theo địa chỉ, kèm mã máy, dạng disassembly và mã nguồn gốc, cùng một cột để đặt/bỏ điểm dừng. Bảng vùng dữ liệu (Data Segment) hiển thị nội dung bộ nhớ theo hàng (mỗi hàng nhiều từ liên tiếp), cho phép nhập địa chỉ để nhảy tới và chuyển đổi giữa hiển thị thập lục phân và hiển thị ký tự (ASCII) (xem source: `src/index.html`).

[Hình 3.6: Các khung quan sát thanh ghi và bộ nhớ. Phía trên là khung thanh ghi với hai thẻ: thẻ "Registers" hiển thị bảng ba cột (Name, Value (Hex), Dec) cho x0–x31; thẻ "Floating Point" hiển thị bảng ba cột (Register, Float Value, Hex (Bits)) cho f0–f31; một vài hàng được tô sáng biểu thị giá trị vừa thay đổi. Phía dưới là khung bộ nhớ với hai bảng: bảng "Instruction Memory" gồm các cột (Bkpt, Address, Code, Basic, Source) với một ô Bkpt được đánh dấu là điểm dừng; bảng "Data Segment" gồm cột địa chỉ và nhiều cột giá trị theo độ dịch (+0, +4, +8, …), kèm ô nhập "Go to Address" và nút "Toggle Hex/ASCII".] (xem source: `src/index.html`, `src/js/javascript.js`)

## 3.5. Luồng thực thi chương trình hợp ngữ

Mục này mô tả luồng xử lý đầu–cuối (end-to-end) của một chương trình hợp ngữ, từ lúc người học nhập mã nguồn cho đến lúc chương trình kết thúc và kết quả được phản ánh trên giao diện. Luồng này gắn kết các thành phần đã trình bày ở các mục trước: trình biên dịch hợp ngữ (mục 3.2.2), bản đồ địa chỉ và việc nạp chương trình (mục 3.2.3), mô hình tiến triển theo chu kỳ (mục 3.3.1) và giao diện điều khiển (mục 3.4). Các điểm chính của luồng được dẫn nguồn tới `src/js/javascript.js` (điều phối giao diện), `src/js/assembler.js` (biên dịch) và `src/js/cpu.js` (thực thi và xử lý dịch vụ hệ thống).

**Bước 1 — Soạn thảo và biên dịch.** Người học nhập hoặc chọn một chương trình hợp ngữ trong khung soạn thảo, rồi nhấn Assemble. Khi đó hệ thống trước hết khởi tạo lại thành phần trung tâm để đưa toàn bộ SoC về trạng thái sạch, sau đó gọi trình biên dịch hợp ngữ để biên dịch mã nguồn (xem source: `src/js/javascript.js`).

**Bước 2 — Biên dịch hai lượt.** Trình biên dịch thực hiện theo hai lượt. Lượt thứ nhất duyệt từng dòng để tách nhãn, tính địa chỉ và kích thước của từng lệnh/dữ liệu, đồng thời xử lý các chỉ thị (directive) — qua đó dựng được bảng nhãn và bố trí địa chỉ; vùng mã lệnh mặc định bắt đầu tại `0x00400000`. Lượt thứ hai mã hóa từng lệnh và dữ liệu thành mã máy và ghi vào ảnh bộ nhớ của chương trình. Kết thúc, trình biên dịch xác định địa chỉ bắt đầu thực thi (ưu tiên nhãn `_start` nếu có, nếu không thì lấy lệnh đầu tiên trong vùng mã) và trả về một gói dữ liệu gồm ảnh bộ nhớ, địa chỉ bắt đầu và danh sách lệnh đã mã hóa (xem source: `src/js/assembler.js`). Nếu phát hiện lỗi cú pháp hoặc lỗi mã hóa, lỗi được báo theo dòng và hiển thị ở khung kết quả, luồng dừng tại đây để người học sửa mã rồi biên dịch lại. Cấu trúc chi tiết của hai lượt biên dịch, danh mục chỉ thị, pseudo-instruction và bảng mã hóa được trình bày ở Chương 4.

**Bước 3 — Nạp chương trình.** Khi biên dịch thành công, hệ thống nạp ảnh bộ nhớ vào bộ nhớ chính, đặt bộ đếm chương trình của lõi xử lý về địa chỉ bắt đầu và chuyển lõi xử lý sang trạng thái sẵn sàng chạy; danh sách mã máy đồng thời được hiển thị ở khung kết quả và bộ nhớ lệnh (xem source: `src/js/javascript.js`, `src/js/cpu.js`, `src/js/soc.js`). Hệ thống cũng thiết lập các hàm gọi lại (callback) để xuất kết quả vào/ra (console UART, dịch vụ hệ thống) phù hợp với trạng thái vừa khởi tạo.

**Bước 4 — Thực thi.** Người học chọn chạy liên tục (Run) hoặc chạy từng bước (Step). Ở chế độ chạy liên tục, hệ thống dùng vòng lặp gắn với cơ chế vẽ lại theo khung hình của trình duyệt; mỗi khung hình thực thi một số chu kỳ tương ứng với mức tốc độ đã chọn bằng cách lặp lại thao tác tiến chu kỳ của thành phần trung tâm, đồng thời kiểm tra các điều kiện dừng (gặp điểm dừng tại địa chỉ hiện tại, lõi xử lý dừng, hoặc vượt số chu kỳ tối đa), đo tốc độ thực thi ước lượng và cập nhật giao diện sau mỗi khung hình (xem source: `src/js/javascript.js`). Ở chế độ từng bước, hệ thống tiến đúng một lệnh rồi cập nhật giao diện. Trong mỗi chu kỳ, lõi xử lý thực hiện chu trình nạp–giải mã–thực thi và có thể phát sinh giao dịch trên bus, kích hoạt bộ điều khiển DMA hoặc tác động lên thiết bị ngoại vi; các giao dịch này lan truyền qua các tầng theo mô hình tiến chu kỳ đã trình bày ở mục 3.3.1.

**Bước 5 — Dịch vụ hệ thống và xuất vào/ra.** Trong quá trình thực thi, lệnh `ECALL` được dùng để gọi các dịch vụ hệ thống mô phỏng. Các dịch vụ bao gồm in số nguyên, in chuỗi và ghi ra đầu ra chuẩn (kết quả hiển thị ở khung console), kết thúc chương trình, cùng một số dịch vụ điều khiển ánh xạ bộ nhớ của đơn vị quản lý bộ nhớ; ngoài ra, vào/ra với thiết bị được thực hiện qua các thanh ghi MMIO như UART (xem source: `src/js/cpu.js`, `src/js/javascript.js`). Danh sách đầy đủ các dịch vụ hệ thống và hành vi của chúng được trình bày ở Chương 4.

**Bước 6 — Điều kiện dừng và cập nhật giao diện.** Quá trình chạy kết thúc khi xảy ra một trong các điều kiện: chương trình gọi dịch vụ kết thúc, lõi xử lý dừng (halt), gặp điểm dừng, hoặc vượt giới hạn số chu kỳ. Khi dừng, hệ thống có thể hoàn tất nốt các giao dịch DMA còn dở, đặt lại chỉ số tốc độ và cập nhật toàn bộ giao diện để phản ánh trạng thái cuối cùng (thanh ghi, bộ nhớ, bộ nhớ đệm, MMU, sơ đồ SoC, thiết bị ngoại vi và nhật ký) (xem source: `src/js/javascript.js`). Người học có thể quan sát kết quả, đặt thêm điểm dừng, chạy tiếp hoặc khởi tạo lại để lặp chu trình.

[Hình 3.7: Sơ đồ hoạt động luồng thực thi chương trình hợp ngữ (đầu–cuối). Bắt đầu ở nút "Start". (1) Hành động "Nhập/chọn mã hợp ngữ"; (2) "Nhấn Assemble" → "Khởi tạo lại SoC" → "Biên dịch lượt 1: dựng bảng nhãn, tính địa chỉ/kích thước, xử lý directive" → "Biên dịch lượt 2: mã hóa lệnh/dữ liệu, ghi vào ảnh bộ nhớ" → nút quyết định "Có lỗi?": nếu CÓ → "Hiển thị lỗi theo dòng" → quay về (1); nếu KHÔNG → "Xác định địa chỉ bắt đầu (_start hoặc lệnh đầu .text)". (3) "Nạp ảnh bộ nhớ vào RAM, đặt PC = địa chỉ bắt đầu, lõi xử lý sẵn sàng". (4) Nút quyết định "Run hay Step?". Nhánh Run → vòng lặp "Mỗi khung hình: thực thi N chu kỳ (tick), đo IPS, cập nhật giao diện" với nhánh kiểm tra "Điểm dừng / halt / vượt max?"; nhánh Step → "Tiến đúng một lệnh → cập nhật giao diện". Bên trong mỗi tick có chú thích "CPU nạp–giải mã–thực thi; phát giao dịch Bus/DMA/Ngoại vi; xử lý ECALL và xuất I/O". (5) Khi gặp điều kiện dừng → "Hoàn tất DMA còn dở, cập nhật giao diện cuối" → nút "End". Một cung phản hồi từ "End" quay lại (1) thể hiện chu trình chỉnh sửa–chạy lại.] (xem source: `src/js/javascript.js`, `src/js/assembler.js`, `src/js/cpu.js`)

Như vậy, luồng thực thi đầu–cuối gắn kết toàn bộ các thành phần thiết kế thành một chu trình khép kín phục vụ người học: từ mã nguồn hợp ngữ, qua biên dịch hai lượt và nạp vào không gian địa chỉ chung, đến thực thi theo mô hình tiến chu kỳ với sự tham gia của lõi xử lý, hệ thống kết nối, DMA và thiết bị ngoại vi, và cuối cùng phản ánh kết quả lên các khung quan sát của giao diện. Các quyết định thiết kế ở mức kiến trúc trình bày trong chương này là cơ sở cho phần hiện thực chi tiết của từng thành phần ở Chương 4.

---

## Tài liệu tham khảo (trích dẫn trong Chương 3)

> *Ghi chú: Danh sách dưới đây liệt kê các tài liệu được trích dẫn trong Chương 3, trình bày theo chuẩn IEEE và đánh số theo thứ tự xuất hiện trong toàn báo cáo; danh sách này được hợp nhất vào mục Tài liệu tham khảo chung ở cuối báo cáo.*

[2] SiFive, Inc., "SiFive TileLink Specification, Version 1.8.1," 2020. [Trực tuyến]. Có tại: https://www.sifive.com/documentation/tilelink/
