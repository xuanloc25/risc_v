# Chương 2. CƠ SỞ LÝ THUYẾT

Chương này trình bày các kiến thức nền tảng cần thiết để theo dõi phần phân tích, thiết kế và hiện thực hệ thống ở Chương 3 và Chương 4. Nội dung được giới hạn ở mức vừa đủ để hiểu các lựa chọn thiết kế của trình mô phỏng, không đi sâu như một giáo trình chuyên khảo; những khái niệm chỉ được sử dụng một phần trong hệ thống sẽ được nêu rõ giới hạn tương ứng. Cụ thể, chương lần lượt giới thiệu: khái niệm hệ thống trên chip và các thành phần điển hình; các mức mô phỏng và vị trí của đề tài trong phổ các mức đó; kiến trúc tập lệnh RISC-V với các nhóm lệnh RV32I, RV32M, RV32F (và nhắc ngắn RV32A); cơ chế quản lý bộ nhớ với đơn vị quản lý bộ nhớ và bộ đệm dịch địa chỉ; tổ chức bộ nhớ đệm; giao thức kết nối TileLink; cơ chế truy cập bộ nhớ trực tiếp; vào/ra ánh xạ bộ nhớ cùng các thiết bị ngoại vi; và các công nghệ nền tảng web được sử dụng.

Phần khảo sát các công cụ mô phỏng liên quan, bảng so sánh chức năng (Bảng 1.1) và phân tích khoảng trống nghiên cứu đã được trình bày ở Chương 1 và không lặp lại ở đây; khi cần, chương này chỉ tham chiếu ngắn tới các kết quả đó. Cuối mỗi tiểu mục lý thuyết có một đến hai câu liên hệ trực tiếp với hệ thống nhằm chỉ rõ phần kiến thức được vận dụng như thế nào và ở phạm vi nào; các chi tiết hiện thực cụ thể được dành cho Chương 4.

## 2.1. Hệ thống trên chip (SoC)

### 2.1.1. Khái niệm và đặc điểm

Hệ thống trên chip (System-on-Chip – SoC) là một mạch tích hợp tập hợp phần lớn hoặc toàn bộ các khối chức năng của một hệ thống tính toán vào trong một vi mạch duy nhất [11]. Khác với mô hình máy tính cổ điển, nơi bộ xử lý, bộ nhớ và các bộ điều khiển vào/ra là những vi mạch riêng biệt nối với nhau qua bo mạch chủ, một SoC tích hợp các khối này cùng hệ thống kết nối nội bộ trên cùng một đế bán dẫn. Cách tổ chức này giúp giảm kích thước, giảm tiêu thụ năng lượng và rút ngắn đường truyền tín hiệu giữa các khối, do đó được sử dụng rộng rãi trong các thiết bị nhúng, thiết bị di động và nhiều hệ thống chuyên dụng.

Một đặc điểm quan trọng của SoC, xét từ góc độ kiến trúc, là sự hiện diện đồng thời của nhiều thành phần hoạt động tương đối độc lập nhưng phải phối hợp trao đổi dữ liệu qua một hạ tầng kết nối chung. Bộ xử lý không còn là thành phần duy nhất khởi tạo truy cập bộ nhớ; các thành phần khác như bộ điều khiển truy cập bộ nhớ trực tiếp cũng có thể chủ động phát yêu cầu trên hệ thống kết nối. Vì vậy, việc hiểu một SoC không chỉ dừng lại ở việc hiểu tập lệnh của bộ xử lý, mà còn đòi hỏi nắm được cách các thành phần chia sẻ không gian địa chỉ, cách hệ thống bus điều phối các yêu cầu và cách dữ liệu di chuyển giữa bộ nhớ và thiết bị ngoại vi.

*Liên hệ đề tài:* Đề tài xây dựng một mô hình SoC ở mức phần mềm, trong đó mỗi khối phần cứng điển hình được tái hiện thành một mô-đun và được lắp ghép thành một hệ thống hoàn chỉnh có không gian địa chỉ chung và hạ tầng kết nối nội bộ (xem source: `src/js/soc.js`). Trọng tâm của hệ thống là minh họa sự phối hợp ở mức hệ thống giữa các thành phần, chứ không phải tái tạo một SoC thương mại cụ thể.

### 2.1.2. Các thành phần điển hình và vai trò

Một SoC điển hình bao gồm các nhóm thành phần sau, được minh họa khái quát ở Hình 2.1.

**Bộ xử lý trung tâm (Central Processing Unit – CPU).** CPU là thành phần thực thi chương trình, thực hiện chu trình nạp lệnh, giải mã và thực thi (fetch – decode – execute). Bên trong CPU có tệp thanh ghi để lưu trạng thái tính toán và đơn vị số học – luận lý (Arithmetic Logic Unit – ALU) để thực hiện các phép tính số nguyên; nếu hỗ trợ số thực, CPU còn có đơn vị dấu phẩy động (Floating-Point Unit – FPU) cùng tệp thanh ghi dấu phẩy động riêng. CPU là thành phần chủ động (master) khởi tạo phần lớn các truy cập bộ nhớ trong hệ thống.

**Bộ nhớ (memory).** Bộ nhớ lưu trữ mã lệnh và dữ liệu. Trong thực tế, bộ nhớ được tổ chức thành nhiều cấp với đặc tính dung lượng – tốc độ khác nhau, từ các thanh ghi và bộ nhớ đệm tốc độ cao nằm gần CPU đến bộ nhớ chính (RAM) có dung lượng lớn nhưng độ trễ truy cập cao hơn [11], [12]. Tổ chức phân cấp này được trình bày chi tiết hơn ở các mục 2.4 và 2.5.

**Hệ thống kết nối (interconnect/bus).** Đây là hạ tầng truyền tải các yêu cầu đọc/ghi và phản hồi giữa các thành phần. Hệ thống kết nối định tuyến một yêu cầu từ thành phần chủ động đến thành phần đích dựa trên địa chỉ, đồng thời điều phối khi có nhiều thành phần cùng muốn truy cập tài nguyên chung. Giao thức kết nối quy định khuôn dạng giao dịch, các loại thao tác được phép và cách bắt tay giữa hai phía. Giao thức TileLink được sử dụng trong đề tài được trình bày ở mục 2.6.

**Bộ điều khiển truy cập bộ nhớ trực tiếp (Direct Memory Access – DMA).** DMA là một thành phần chuyên trách việc vận chuyển khối dữ liệu giữa các vùng nhớ hoặc giữa bộ nhớ và thiết bị ngoại vi mà không cần CPU thực hiện từng thao tác đọc/ghi. Khi hoạt động, DMA đóng vai trò là một thành phần chủ động trên hệ thống kết nối, tương tự CPU. Cơ chế DMA được trình bày ở mục 2.7.

**Thiết bị ngoại vi (peripheral).** Các thiết bị ngoại vi đảm nhận chức năng giao tiếp giữa hệ thống và môi trường bên ngoài, ví dụ giao tiếp nối tiếp, hiển thị hoặc nhận tín hiệu đầu vào từ người dùng. Các thiết bị này thường được điều khiển thông qua các thanh ghi được ánh xạ vào không gian địa chỉ bộ nhớ (mục 2.8).

[Hình 2.1: Sơ đồ khối của một hệ thống trên chip điển hình — CPU (kèm ALU/FPU), phân cấp bộ nhớ, hệ thống kết nối, bộ điều khiển DMA và các thiết bị ngoại vi cùng chia sẻ một không gian địa chỉ chung]

*Liên hệ đề tài:* Hệ thống mô phỏng tái hiện đầy đủ năm nhóm thành phần nêu trên: lõi xử lý RISC-V, phân cấp bộ nhớ (bộ nhớ chính, bộ nhớ đệm), hệ thống kết nối TileLink, bộ điều khiển DMA và các thiết bị ngoại vi. Vai trò mô phỏng cụ thể của từng mô-đun phần mềm tương ứng được trình bày ở Chương 3 và Chương 4.

## 2.2. Các mức mô phỏng và vị trí của đề tài

Việc mô phỏng một hệ thống tính toán có thể được thực hiện ở nhiều mức trừu tượng khác nhau, mỗi mức đánh đổi giữa độ chi tiết và tốc độ mô phỏng [12]. Phân biệt các mức này giúp xác định rõ những gì một trình mô phỏng tái hiện và những gì nằm ngoài phạm vi của nó.

**Mô phỏng mức tập lệnh (Instruction Set Architecture – ISA).** Ở mức này, trình mô phỏng chỉ tái hiện trạng thái kiến trúc nhìn thấy được từ phần mềm — tệp thanh ghi, bộ đếm chương trình và bộ nhớ — và ngữ nghĩa của từng lệnh. Mỗi lệnh được thực thi cho ra kết quả đúng theo đặc tả, nhưng trình mô phỏng không quan tâm đến cách lệnh được thực hiện bên trong vi kiến trúc. Cách tiếp cận này cho tốc độ cao và đủ để kiểm chứng tính đúng đắn về mặt chức năng của chương trình.

**Mô phỏng mức hành vi/chức năng (functional/behavioral).** Mức này mở rộng mô phỏng ISA bằng cách mô hình hóa hành vi của các thành phần ngoài lõi xử lý — bộ nhớ đệm, đơn vị quản lý bộ nhớ, hệ thống bus, DMA, thiết bị ngoại vi — và quá trình các thành phần trao đổi giao dịch với nhau. Mức này có thể gắn các giá trị độ trễ ở dạng số chu kỳ cho từng loại thao tác nhằm phản ánh tương quan chi phí giữa chúng (ví dụ truy cập bộ nhớ chính tốn nhiều chu kỳ hơn truy cập bộ nhớ đệm), nhưng không mô tả chi tiết cấu trúc vi kiến trúc bên trong.

**Mô phỏng chính xác theo chu kỳ (cycle-accurate).** Ở mức này, trình mô phỏng tái hiện hoạt động của vi kiến trúc theo từng chu kỳ đồng hồ, bao gồm các tầng của đường ống lệnh (pipeline), hiện tượng xung đột (hazard) và cơ chế chuyển tiếp dữ liệu. Mức này cho thông tin định thời chính xác hơn nhưng phức tạp và chậm hơn đáng kể. Ở mức chi tiết nhất là mô phỏng tại mức truyền thanh ghi (Register-Transfer Level – RTL) hoặc mức cổng logic, thường phục vụ cho thiết kế và kiểm chứng phần cứng.

Ngoài cách phân loại theo độ chi tiết của lõi xử lý, người ta còn nói đến **mô phỏng ở mức hệ thống (system-level)** khi đối tượng mô phỏng là toàn bộ SoC — bao gồm CPU, bộ nhớ, bus và ngoại vi — thường ở mức giao dịch hoặc mức hành vi, nhằm quan sát sự tương tác giữa nhiều thành phần.

*Liên hệ đề tài:* Hệ thống của đề tài thuộc nhóm mô phỏng ở mức hành vi/chức năng và ở phạm vi toàn hệ thống (system-level). Hệ thống sử dụng một mô hình tiến triển theo chu kỳ rời rạc, trong đó mỗi bước mô phỏng tương ứng một chu kỳ và mỗi loại thao tác bộ nhớ/bus được gán một giá trị độ trễ theo số chu kỳ để minh họa tương quan chi phí (xem source: `src/js/soc.js`). Tuy vậy, hệ thống không phải là một trình mô phỏng chính xác theo chu kỳ: nó không mô hình hóa chi tiết đường ống lệnh hay vi kiến trúc, và như đã nêu ở mục 1.3.2, không mô phỏng các đặc tính định thời vật lý theo công nghệ chế tạo hay mức tiêu thụ năng lượng. Vị trí này — nằm giữa mô phỏng ISA thuần túy và mô phỏng chính xác theo chu kỳ — phù hợp với mục tiêu giáo dục là quan sát trực quan sự phối hợp giữa các thành phần ở mức hệ thống.

## 2.3. Kiến trúc tập lệnh RISC-V

### 2.3.1. Tổng quan và triết lý mô-đun hóa ISA

Kiến trúc tập lệnh (Instruction Set Architecture – ISA) là lớp giao tiếp trừu tượng giữa phần mềm và phần cứng: nó định nghĩa tập các lệnh, tập thanh ghi, các kiểu dữ liệu, mô hình bộ nhớ và quy ước mã hóa lệnh mà bộ xử lý phải tuân theo. RISC-V là một ISA theo trường phái máy tính với tập lệnh rút gọn (Reduced Instruction Set Computer – RISC), trong đó các lệnh có khuôn dạng đều đặn và đa số thao tác tính toán chỉ làm việc trên thanh ghi, tách biệt với các lệnh truy cập bộ nhớ (mô hình nạp – lưu, hay load–store) [1]. Đặc điểm này khác với trường phái máy tính với tập lệnh phức tạp (Complex Instruction Set Computer – CISC), nơi một lệnh có thể vừa truy cập bộ nhớ vừa thực hiện tính toán và có độ dài thay đổi.

Điểm nổi bật trong triết lý thiết kế của RISC-V là tính mô-đun [1]. Thay vì định nghĩa một tập lệnh lớn cố định, RISC-V quy định một **tập lệnh cơ sở** nhỏ gọn bắt buộc và một loạt **phần mở rộng** tùy chọn, mỗi phần bổ sung một nhóm chức năng. Tập cơ sở cho kiến trúc 32-bit là RV32I (Base Integer). Các phần mở rộng tiêu biểu gồm: M cho phép nhân/chia số nguyên, A cho thao tác nguyên tử trên bộ nhớ, F cho số thực dấu phẩy động độ chính xác đơn, D cho độ chính xác kép, C cho lệnh nén 16-bit, cùng nhiều phần khác. Tên một biến thể được ghép từ chiều rộng thanh ghi và danh sách phần mở rộng; ví dụ "RV32IMF" chỉ kiến trúc 32-bit gồm tập cơ sở I và hai phần mở rộng M, F. Cách tổ chức mô-đun này cho phép một hệ thống chỉ hiện thực đúng những phần cần thiết, đồng thời thuận tiện cho việc trình bày từng lớp khái niệm một cách tuần tự.

Bảng 2.1 tóm tắt các phần mở rộng RISC-V liên quan đến đề tài và phạm vi được hỗ trợ.

**Bảng 2.1. Các phần mở rộng RISC-V và phạm vi trong đề tài**

| Ký hiệu | Tên đầy đủ | Nội dung chính | Phạm vi trong đề tài |
|---|---|---|---|
| I | Base Integer Instruction Set | Tập lệnh số nguyên cơ sở: tính toán, nạp/lưu, rẽ nhánh, nhảy | Có (tập con ở chế độ người dùng) |
| M | Standard Extension for Integer Multiplication and Division | Nhân và chia số nguyên có dấu/không dấu | Có |
| F | Standard Extension for Single-Precision Floating-Point | Số thực độ chính xác đơn theo IEEE 754 | Có (tập con, chưa có FCSR/fflags/frm) |
| A | Standard Extension for Atomic Instructions | Thao tác đọc–sửa–ghi nguyên tử trên bộ nhớ | Một phần (chỉ `AMOADD.W`) — ngoài tên đề tài |
| Các phần khác (D, C, …) | — | Số thực kép, lệnh nén, … | Ngoài phạm vi |

*Ghi chú: Tên đề tài là RV32IMF; phần mở rộng A được liệt kê vì hệ thống có hiện thực một lệnh nguyên tử minh họa, được trình bày ở mục 2.3.5.*

*Liên hệ đề tài:* Hệ thống hỗ trợ tập con của RV32IMF phục vụ các chương trình ở chế độ người dùng. Như đã nêu ở mục 1.3.2, các lệnh truy cập thanh ghi điều khiển và trạng thái (CSR) cũng như các lệnh thuộc chế độ đặc quyền nằm ngoài phạm vi hiện thực (xem source: `src/js/cpu.js`, `src/js/assembler.js`).

### 2.3.2. Tập lệnh cơ sở RV32I

Tập lệnh cơ sở RV32I định nghĩa 32 thanh ghi số nguyên rộng 32 bit, ký hiệu x0 đến x31, cùng một bộ đếm chương trình (Program Counter – PC) trỏ tới lệnh đang thực thi [1]. Thanh ghi x0 được nối cứng giá trị 0: mọi thao tác đọc x0 đều trả về 0 và mọi thao tác ghi vào x0 đều không có hiệu lực; đặc điểm này được dùng để biểu diễn nhiều thao tác thông dụng một cách gọn gàng. Các thanh ghi còn lại có công dụng chung, với quy ước sử dụng (lưu địa chỉ trả về, con trỏ ngăn xếp, tham số hàm…) được quy định bởi giao diện nhị phân ứng dụng (ABI); ánh xạ tên thanh ghi theo ABI được trình bày ở Chương 4.

Các lệnh RV32I có chiều dài cố định 32 bit và được tổ chức theo một số khuôn dạng (format) thống nhất, giúp việc giải mã trở nên đơn giản và đều đặn. Sáu khuôn dạng cơ bản gồm R, I, S, B, U và J, khác nhau ở cách bố trí các trường thanh ghi và trường giá trị tức thời (immediate), được minh họa ở Hình 2.2:

- **Khuôn dạng R** dùng cho các lệnh tính toán thanh ghi – thanh ghi (hai toán hạng nguồn `rs1`, `rs2`, một đích `rd`), với các trường `funct3` và `funct7` xác định cụ thể phép toán.
- **Khuôn dạng I** dùng cho các lệnh có một toán hạng tức thời 12 bit, gồm lệnh tính toán với hằng số, lệnh nạp dữ liệu và lệnh nhảy gián tiếp `JALR`.
- **Khuôn dạng S** dùng cho lệnh lưu dữ liệu, trong đó giá trị tức thời bị tách thành hai phần để giữ nguyên vị trí các trường thanh ghi.
- **Khuôn dạng B** là biến thể của S dùng cho rẽ nhánh có điều kiện, với giá trị tức thời mã hóa độ dịch địa chỉ đích (là bội của 2).
- **Khuôn dạng U** dùng cho các lệnh mang giá trị tức thời 20 bit ở phần cao (`LUI`, `AUIPC`).
- **Khuôn dạng J** dùng cho lệnh nhảy `JAL`, với giá trị tức thời mã hóa độ dịch tương đối so với PC.

[Hình 2.2: Sáu khuôn dạng lệnh RV32I (R/I/S/B/U/J) với bố trí các trường opcode, rd, funct3, rs1, rs2, funct7 và các trường giá trị tức thời tương ứng]

Về chức năng, các lệnh RV32I được chia thành các nhóm chính như tổng hợp ở Bảng 2.2. Riêng lệnh `FENCE` dùng để đặt ràng buộc thứ tự cho các truy cập bộ nhớ; trong các hệ thống đơn lõi đơn giản, thao tác này thường không tạo ra hiệu ứng quan sát được.

**Bảng 2.2. Các nhóm lệnh của tập cơ sở RV32I**

| Nhóm lệnh | Khuôn dạng | Lệnh tiêu biểu | Ý nghĩa |
|---|---|---|---|
| Tính toán thanh ghi – thanh ghi | R | `ADD`, `SUB`, `AND`, `OR`, `XOR`, `SLT`, `SLTU`, `SLL`, `SRL`, `SRA` | Phép số học, luận lý, so sánh và dịch bit giữa hai thanh ghi |
| Tính toán với hằng số | I | `ADDI`, `ANDI`, `ORI`, `XORI`, `SLTI`, `SLTIU`, `SLLI`, `SRLI`, `SRAI` | Như trên nhưng một toán hạng là giá trị tức thời |
| Nạp dữ liệu (load) | I | `LB`, `LH`, `LW`, `LBU`, `LHU` | Đọc byte/nửa từ/từ từ bộ nhớ vào thanh ghi |
| Lưu dữ liệu (store) | S | `SB`, `SH`, `SW` | Ghi byte/nửa từ/từ từ thanh ghi xuống bộ nhớ |
| Rẽ nhánh có điều kiện | B | `BEQ`, `BNE`, `BLT`, `BGE`, `BLTU`, `BGEU` | Thay đổi luồng thực thi theo điều kiện so sánh |
| Nhảy vô điều kiện | J, I | `JAL`, `JALR` | Nhảy và lưu địa chỉ trả về (gọi/trả về chương trình con) |
| Nạp hằng số lớn | U | `LUI`, `AUIPC` | Nạp 20 bit cao của hằng số / tính địa chỉ tương đối PC |
| Lệnh hệ thống | I | `ECALL`, `EBREAK` | Gọi dịch vụ hệ thống / điểm dừng gỡ lỗi |
| Đồng bộ bộ nhớ | I | `FENCE` | Đặt ràng buộc thứ tự truy cập bộ nhớ |

*Liên hệ đề tài:* Hệ thống hiện thực các nhóm lệnh RV32I nêu trên trong khối giải mã – thực thi của lõi xử lý (xem source: `src/js/cpu.js`) và bảng mã hóa của trình biên dịch hợp ngữ (xem source: `src/js/assembler.js`). Lệnh `ECALL` được dùng để gọi các dịch vụ hệ thống mô phỏng (in dữ liệu, kết thúc chương trình, điều khiển ánh xạ bộ nhớ); chi tiết các dịch vụ này được trình bày ở Chương 4. Riêng lệnh `FENCE` được trình biên dịch mã hóa nhưng chưa được lõi xử lý thực thi như một thao tác có hiệu lực (xem mục 1.3.2; source: `src/js/assembler.js`, `src/js/cpu.js`).

### 2.3.3. Mở rộng nhân/chia số nguyên RV32M

Phần mở rộng M bổ sung cho RV32I tám lệnh nhân và chia số nguyên, vốn không có trong tập cơ sở [1]. Nhóm nhân gồm `MUL` lấy 32 bit thấp của tích, và ba lệnh lấy 32 bit cao của tích là `MULH` (cả hai toán hạng có dấu), `MULHU` (cả hai không dấu) và `MULHSU` (một có dấu, một không dấu) — việc tách phần cao/phần thấp cho phép thu được kết quả nhân đầy đủ 64 bit từ hai thanh ghi 32 bit. Nhóm chia gồm `DIV` và `DIVU` (chia có dấu và không dấu) cùng `REM` và `REMU` (lấy phần dư tương ứng).

Đặc tả RISC-V quy định rõ hành vi cho các trường hợp biên mà không sinh ngoại lệ phần cứng: khi chia cho 0, lệnh chia trả về giá trị toàn bit 1 (tức −1 với phép có dấu) và lệnh lấy dư trả về chính số bị chia; khi xảy ra tràn trong phép chia có dấu (số bị chia là giá trị âm nhỏ nhất biểu diễn được chia cho −1), thương trả về chính số bị chia còn phần dư bằng 0 [1]. Việc quy định tường minh các trường hợp này giúp kết quả là xác định và nhất quán giữa các hiện thực.

*Liên hệ đề tài:* Hệ thống hiện thực đầy đủ tám lệnh của RV32M, trong đó các lệnh lấy phần cao của tích được tính bằng số nguyên lớn (BigInt) để bảo đảm độ chính xác 64 bit, và các trường hợp biên (chia cho 0, tràn) được xử lý theo đúng đặc tả (xem source: `src/js/cpu.js`). Danh sách lệnh RV32M được liệt kê cùng RV32F trong Bảng 2.3.

### 2.3.4. Mở rộng dấu phẩy động RV32F và chuẩn IEEE 754

Phần mở rộng F bổ sung khả năng tính toán trên số thực dấu phẩy động độ chính xác đơn và một tệp thanh ghi dấu phẩy động riêng gồm 32 thanh ghi f0 đến f31 [1]. Việc tách riêng tệp thanh ghi số thực khỏi tệp thanh ghi số nguyên cho phép thực hiện đồng thời các thao tác trên hai miền dữ liệu và phản ánh sự tồn tại của một đơn vị dấu phẩy động độc lập.

**Chuẩn IEEE 754.** Cách biểu diễn và quy tắc tính toán số thực trong RISC-V tuân theo chuẩn IEEE 754 về số học dấu phẩy động [10]. Với độ chính xác đơn, một số thực được biểu diễn bằng 32 bit gồm ba trường: 1 bit dấu, 8 bit số mũ (lưu theo dạng lệch với độ lệch 127) và 23 bit phần định trị (fraction). Chuẩn này định nghĩa một số giá trị đặc biệt ngoài các số chuẩn tắc: số 0 có dấu (+0 và −0), vô cùng có dấu (±∞), các số dưới chuẩn tắc (subnormal) cho phép biểu diễn các giá trị rất nhỏ gần 0, và giá trị "không phải số" (Not-a-Number – NaN) dùng cho các kết quả không xác định, được phân biệt thành NaN báo hiệu (signaling) và NaN im lặng (quiet). Chuẩn cũng quy định năm chế độ làm tròn — trong đó thông dụng là làm tròn tới giá trị gần nhất, lấy chẵn khi ở giữa (round to nearest, ties to even) và làm tròn về 0 (round toward zero) — cùng năm cờ ngoại lệ ghi nhận các tình huống như chia cho 0, tràn trên, tràn dưới, kết quả không chính xác và thao tác không hợp lệ.

Trong RISC-V, chế độ làm tròn và các cờ ngoại lệ nói trên được quản lý qua thanh ghi điều khiển và trạng thái dấu phẩy động (Floating-point Control and Status Register – FCSR), gồm trường chọn chế độ làm tròn động (frm) và trường cờ ngoại lệ tích lũy (fflags) [1]. Mỗi lệnh dấu phẩy động cũng có một trường chỉ định chế độ làm tròn tĩnh ngay trong mã lệnh.

**Các nhóm lệnh RV32F.** Phần mở rộng F cung cấp nhiều nhóm lệnh: nạp/lưu số thực (`FLW`, `FSW`); số học cơ bản (`FADD.S`, `FSUB.S`, `FMUL.S`, `FDIV.S`, `FSQRT.S`); nhân–cộng kết hợp (`FMADD.S`, `FMSUB.S`, `FNMSUB.S`, `FNMADD.S`); cực trị (`FMIN.S`, `FMAX.S`); thao tác trên bit dấu (`FSGNJ.S`, `FSGNJN.S`, `FSGNJX.S`); so sánh (`FEQ.S`, `FLT.S`, `FLE.S`); phân loại giá trị (`FCLASS.S`); chuyển đổi giữa số thực và số nguyên (`FCVT.W.S`, `FCVT.WU.S`, `FCVT.S.W`, `FCVT.S.WU`); và di chuyển bit giữa hai tệp thanh ghi (`FMV.X.W`, `FMV.W.X`). Các nhóm RV32M và RV32F được tổng hợp ở Bảng 2.3.

**Bảng 2.3. Các nhóm lệnh RV32M và RV32F được hỗ trợ**

| Phần mở rộng | Nhóm chức năng | Lệnh |
|---|---|---|
| RV32M | Nhân | `MUL`, `MULH`, `MULHSU`, `MULHU` |
| RV32M | Chia và lấy dư | `DIV`, `DIVU`, `REM`, `REMU` |
| RV32F | Nạp/lưu | `FLW`, `FSW` |
| RV32F | Số học | `FADD.S`, `FSUB.S`, `FMUL.S`, `FDIV.S`, `FSQRT.S` |
| RV32F | Nhân–cộng kết hợp | `FMADD.S`, `FMSUB.S`, `FNMSUB.S`, `FNMADD.S` |
| RV32F | Cực trị | `FMIN.S`, `FMAX.S` |
| RV32F | Thao tác bit dấu | `FSGNJ.S`, `FSGNJN.S`, `FSGNJX.S` |
| RV32F | So sánh | `FEQ.S`, `FLT.S`, `FLE.S` |
| RV32F | Phân loại | `FCLASS.S` |
| RV32F | Chuyển đổi | `FCVT.W.S`, `FCVT.WU.S`, `FCVT.S.W`, `FCVT.S.WU` |
| RV32F | Di chuyển bit | `FMV.X.W`, `FMV.W.X` |

*Liên hệ đề tài:* Hệ thống hiện thực tệp thanh ghi 32 thanh ghi số thực và các nhóm lệnh RV32F nêu trên, sử dụng kiểu dữ liệu số thực 32-bit của JavaScript để biểu diễn giá trị theo chuẩn IEEE 754 độ chính xác đơn (xem source: `src/js/cpu.js`). Tuy nhiên, như đã nêu ở mục 1.3.2, hệ thống chưa hiện thực thanh ghi FCSR cùng các cờ ngoại lệ (fflags) và việc chọn chế độ làm tròn động (frm): chế độ làm tròn được lấy từ trường tĩnh trong mã lệnh và hiện chỉ phân biệt hai chế độ thông dụng là làm tròn tới giá trị gần nhất và làm tròn về 0, các chế độ còn lại được quy về làm tròn tới gần nhất (xem source: `src/js/cpu.js`). Do đó kết quả dấu phẩy động chưa được kiểm chứng tương đương bit ở mọi trường hợp biên (xem mục 7 trong phân tích phạm vi). Đây là giới hạn được nêu trung thực và để ngỏ cho hướng phát triển ở Chương 6.

### 2.3.5. Thao tác nguyên tử RV32A (mở rộng ngoài tên đề tài)

Phần mở rộng A bổ sung các lệnh thao tác nguyên tử trên bộ nhớ, phục vụ cho việc đồng bộ giữa nhiều thành phần cùng truy cập một vùng nhớ chung [1]. Nhóm lệnh tiêu biểu là các thao tác bộ nhớ nguyên tử (Atomic Memory Operation – AMO), trong đó một lệnh thực hiện trọn vẹn chuỗi đọc giá trị hiện có, tính toán với một toán hạng, rồi ghi kết quả trở lại — toàn bộ chuỗi này được bảo đảm không bị xen kẽ bởi truy cập khác. Ví dụ, `AMOADD.W` đọc một từ 32-bit từ bộ nhớ, cộng với giá trị trong thanh ghi và ghi tổng trở lại địa chỉ đó, đồng thời trả về giá trị cũ. Trên hệ thống kết nối, thao tác này tương ứng với giao dịch số học nguyên tử (mục 2.6).

*Liên hệ đề tài:* Hệ thống có hiện thực lệnh `AMOADD.W` cùng giao dịch số học nguyên tử tương ứng trên hệ thống kết nối (xem source: `src/js/cpu.js`, `src/js/tilelink.js`). Vì phần mở rộng A nằm ngoài tên đề tài RV32IMF nên lệnh này chỉ được trình bày như một mở rộng minh họa, không thuộc trọng tâm của báo cáo.

## 2.4. Quản lý bộ nhớ và đơn vị quản lý bộ nhớ (MMU)

Trong các hệ thống hiện đại, chương trình không truy cập trực tiếp bộ nhớ vật lý mà làm việc trên một không gian **địa chỉ ảo** (virtual address – VA). Một thành phần phần cứng gọi là **đơn vị quản lý bộ nhớ** (Memory Management Unit – MMU) chịu trách nhiệm dịch mỗi địa chỉ ảo thành **địa chỉ vật lý** (physical address – PA) tương ứng trước khi truy cập bộ nhớ thực [11]. Cơ chế này tạo nên một lớp trừu tượng giữa khung nhìn bộ nhớ của chương trình và bố trí bộ nhớ vật lý, mang lại nhiều lợi ích như cô lập không gian nhớ giữa các tiến trình, kiểm soát quyền truy cập và cho phép bố trí bộ nhớ linh hoạt.

Kỹ thuật phổ biến để tổ chức dịch địa chỉ là **phân trang** (paging). Không gian địa chỉ được chia thành các **trang** (page) có kích thước cố định, thường là 4 KiB. Tương ứng, bộ nhớ vật lý được chia thành các **khung trang** (page frame) cùng kích thước. Khi đó, một địa chỉ ảo được tách thành hai phần: **số hiệu trang ảo** (Virtual Page Number – VPN) ở phần cao và **độ dịch trong trang** (page offset) ở phần thấp. Việc dịch địa chỉ chỉ thay thế VPN bằng **số hiệu khung trang vật lý** (Physical Page Number – PPN) tương ứng, còn độ dịch trong trang được giữ nguyên (Hình 2.3). Ánh xạ từ VPN sang PPN được lưu trong **bảng trang** (page table); mỗi mục của bảng, gọi là **mục bảng trang** (Page Table Entry – PTE), chứa số hiệu khung trang vật lý cùng các bit quyền truy cập.

Các bit quyền trong PTE cho phép kiểm soát thao tác nào được phép trên mỗi trang, thông thường gồm quyền đọc (R), ghi (W) và thực thi (X). Khi một truy cập vi phạm quyền (ví dụ ghi vào trang chỉ đọc), MMU phát hiện và báo lỗi thay vì cho phép truy cập. Ngoài ra, mỗi vùng địa chỉ còn được gắn thuộc tính cho biết có được phép lưu vào bộ nhớ đệm hay không: vùng **có thể lưu đệm** (cacheable) — điển hình là bộ nhớ chính — cho phép sao chép tạm vào bộ nhớ đệm để tăng tốc; ngược lại, vùng **không lưu đệm** (non-cacheable) — điển hình là vùng thanh ghi của thiết bị ngoại vi — phải được truy cập trực tiếp vì mỗi lần đọc/ghi có thể gây ra hiệu ứng phụ (mục 2.8).

Việc tra bảng trang cho mỗi truy cập bộ nhớ sẽ rất tốn kém nếu phải thực hiện đầy đủ mỗi lần. Để khắc phục, MMU sử dụng một bộ nhớ đệm chuyên dụng cho kết quả dịch địa chỉ gần đây gọi là **bộ đệm dịch địa chỉ** (Translation Lookaside Buffer – TLB). TLB khai thác **nguyên lý cục bộ** (locality) — xu hướng chương trình truy cập lặp lại một số trang trong khoảng thời gian gần nhau — nên phần lớn các lần dịch có thể được phục vụ nhanh từ TLB mà không cần tra bảng trang. TLB thường được tổ chức theo kiểu kết hợp tập (set-associative), tương tự bộ nhớ đệm dữ liệu được trình bày ở mục 2.5.

[Hình 2.3: Cơ chế dịch địa chỉ ảo sang vật lý — địa chỉ ảo được tách thành VPN và độ dịch; VPN được tra trong TLB, nếu trượt thì tra bảng trang để lấy PPN; PPN ghép với độ dịch tạo thành địa chỉ vật lý, kèm kiểm tra quyền truy cập]

*Liên hệ đề tài:* Hệ thống hiện thực một MMU với kích thước trang 4096 byte, bảng trang lưu ánh xạ VPN–PPN, một TLB tổ chức theo kiểu kết hợp tập với chính sách thay thế dùng lâu nhất chưa dùng (mục 2.5), cùng cơ chế kiểm tra quyền đọc/ghi/thực thi và thuộc tính có thể lưu đệm cho từng vùng; khi không có ánh xạ tường minh, hệ thống áp dụng ánh xạ đồng nhất (địa chỉ ảo bằng địa chỉ vật lý) làm phương án mặc định (xem source: `src/js/mmu.js`). Các tham số cấu hình cụ thể của MMU và TLB được trình bày ở Chương 4.

## 2.5. Bộ nhớ đệm (cache)

**Bộ nhớ đệm** (cache) là một bộ nhớ dung lượng nhỏ nhưng tốc độ cao, đặt giữa bộ xử lý và bộ nhớ chính, nhằm thu hẹp khoảng cách lớn về tốc độ truy cập giữa hai thành phần này [11], [12]. Hiệu quả của bộ nhớ đệm dựa trên nguyên lý cục bộ, gồm **cục bộ theo thời gian** (một ô nhớ vừa được truy cập có nhiều khả năng sẽ được truy cập lại trong tương lai gần) và **cục bộ theo không gian** (các ô nhớ lân cận một ô vừa truy cập có nhiều khả năng được truy cập kế tiếp). Nhờ đó, việc giữ lại bản sao của dữ liệu được dùng gần đây — và nạp theo từng khối liền kề — giúp phần lớn các truy cập sau được phục vụ nhanh từ bộ nhớ đệm.

**Tổ chức kết hợp tập.** Dữ liệu trong bộ nhớ đệm được quản lý theo đơn vị **khối** (block, hay dòng – line), mỗi khối gồm một số byte liền kề trong bộ nhớ. Tổ chức phổ biến là **kết hợp tập** (set-associative): bộ nhớ đệm được chia thành nhiều **tập** (set), mỗi tập gồm một số **đường** (way) có thể chứa khối. Để xác định vị trí của một địa chỉ, địa chỉ được tách thành ba phần (Hình 2.4): **độ dịch trong khối** (block offset) chọn byte bên trong khối; **chỉ số tập** (index) chọn tập; và **thẻ** (tag) được lưu kèm và so sánh với phần thẻ của các đường trong tập để xác định có khối cần tìm hay không. Khi dữ liệu cần tìm có trong bộ nhớ đệm thì gọi là **trúng** (hit); ngược lại là **trượt** (miss), khi đó khối tương ứng được nạp từ cấp bộ nhớ thấp hơn, thường mất nhiều chu kỳ hơn đáng kể.

**Chính sách ghi.** Khi bộ xử lý ghi dữ liệu, có hai chính sách cập nhật chính. Với **ghi xuyên** (write-through), dữ liệu được ghi đồng thời vào bộ nhớ đệm và cấp bộ nhớ thấp hơn, giúp giữ nhất quán đơn giản nhưng tạo nhiều lưu lượng ghi. Với **ghi trả sau** (write-back), dữ liệu chỉ được ghi vào bộ nhớ đệm và khối được đánh dấu "bẩn" (dirty); việc cập nhật xuống bộ nhớ chính chỉ diễn ra khi khối bị thay thế, giúp giảm lưu lượng ghi nhưng cần thêm cơ chế theo dõi trạng thái.

**Chính sách thay thế.** Khi cần nạp khối mới vào một tập đã đầy, một khối hiện có phải bị thay thế. Một chính sách thường dùng là **thay thế khối dùng lâu nhất chưa dùng** (Least Recently Used – LRU), tức loại bỏ khối có lần truy cập gần nhất xa nhất trong quá khứ, dựa trên giả định về cục bộ theo thời gian.

**Phân cấp bộ nhớ đệm.** Để cân bằng giữa tốc độ và dung lượng, bộ nhớ đệm thường được tổ chức thành nhiều cấp. Cấp một (L1) nhỏ và nhanh nhất, thường tách riêng phần chứa lệnh (L1I) và phần chứa dữ liệu (L1D); cấp hai (L2) lớn hơn và chậm hơn, đóng vai trò đệm chung phía sau L1. Một truy cập trượt ở L1 sẽ tìm tiếp ở L2 trước khi xuống bộ nhớ chính. Riêng các vùng được đánh dấu không lưu đệm — điển hình là vùng vào/ra ánh xạ bộ nhớ — được truy cập bỏ qua (bypass) bộ nhớ đệm để bảo đảm mỗi thao tác đọc/ghi tác động trực tiếp lên thiết bị.

[Hình 2.4: Tổ chức bộ nhớ đệm kết hợp tập — địa chỉ được tách thành thẻ, chỉ số tập và độ dịch trong khối; chỉ số tập chọn một tập, thẻ được so sánh song song trên các đường của tập để xác định trúng/trượt]

*Liên hệ đề tài:* Hệ thống hiện thực phân cấp bộ nhớ đệm hai cấp với chính sách ghi xuyên và thay thế LRU. Bộ nhớ đệm cấp một (L1I và L1D) có 16 tập, mỗi tập 4 đường, khối 64 byte (tổng dung lượng 4 KiB); bộ nhớ đệm cấp hai có 64 tập, 4 đường, khối 64 byte (16 KiB) (xem source: `src/js/SimpleCache.js`, `src/js/soc.js`). Hệ thống gán các giá trị độ trễ theo chu kỳ cho trúng và trượt ở từng cấp để minh họa tương quan chi phí, đồng thời bỏ qua bộ nhớ đệm đối với các vùng không lưu đệm. Cấu hình tham số chi tiết và cơ chế nạp khối được trình bày ở Chương 4.

## 2.6. Giao thức kết nối TileLink

### 2.6.1. Vai trò interconnect và ba cấp độ TileLink

Trong một SoC có nhiều thành phần cùng truy cập tài nguyên chung, **hệ thống kết nối** (interconnect) đảm nhận việc truyền tải các yêu cầu và phản hồi giữa chúng theo một **giao thức** thống nhất. Giao thức kết nối quy định khuôn dạng của một giao dịch, tập các thao tác được phép, cách định tuyến yêu cầu tới đúng thành phần đích theo địa chỉ, và quy tắc bắt tay (handshake) bảo đảm hai phía đồng bộ khi trao đổi. **TileLink** là một giao thức kết nối được công bố công khai, sử dụng trong nhiều thiết kế dựa trên RISC-V, với mô hình bộ nhớ chia sẻ và không gian địa chỉ phẳng [2].

TileLink định nghĩa ba cấp độ tuân thủ, tăng dần về mức độ phức tạp và tập thao tác hỗ trợ [2]:

- **TileLink Uncached Lightweight (TL-UL)** là cấp độ đơn giản nhất, chỉ hỗ trợ các thao tác đọc và ghi đơn lẻ, mỗi giao dịch truyền một đơn vị dữ liệu. Cấp độ này phù hợp cho các thành phần đơn giản như thanh ghi điều khiển của thiết bị ngoại vi.
- **TileLink Uncached Heavyweight (TL-UH)** mở rộng TL-UL bằng cách bổ sung khả năng truyền theo chuỗi nhiều đơn vị dữ liệu (burst), các thao tác nguyên tử (số học và luận lý) và các lệnh gợi ý (hint). Cấp độ này phù hợp cho truy cập bộ nhớ khối lượng lớn.
- **TileLink Cached (TL-C)** là cấp độ đầy đủ nhất, bổ sung cơ chế bảo đảm **nhất quán bộ nhớ đệm** (cache coherence) giữa nhiều thành phần có bộ nhớ đệm riêng, thông qua các thao tác xin quyền và thu hồi quyền sở hữu khối dữ liệu.

Bảng 2.4 so sánh ba cấp độ này theo tập thao tác và số kênh truyền sử dụng (khái niệm kênh được trình bày ở mục 2.6.2).

**Bảng 2.4. So sánh ba cấp độ của giao thức TileLink**

| Đặc điểm | TL-UL | TL-UH | TL-C |
|---|---|---|---|
| Đọc/ghi đơn lẻ | Có | Có | Có |
| Truyền chuỗi (burst) | Không | Có | Có |
| Thao tác nguyên tử (số học/luận lý) | Không | Có | Có |
| Lệnh gợi ý (hint) | Tùy chọn | Có | Có |
| Nhất quán bộ nhớ đệm (coherence) | Không | Không | Có |
| Các kênh sử dụng | A, D | A, D | A, B, C, D, E |

*Liên hệ đề tài:* Hệ thống sử dụng hai cấp độ TL-UL và TL-UH; cấp độ TL-C cùng cơ chế nhất quán bộ nhớ đệm nằm ngoài phạm vi (xem mục 2.6.3). Việc lựa chọn hai cấp độ này phản ánh nhu cầu của hệ thống: một bus cho truy cập bộ nhớ và DMA (cần burst và thao tác nguyên tử), và một bus cho thiết bị ngoại vi đơn giản.

### 2.6.2. Mô hình master/slave và các kênh truyền

TileLink hoạt động theo mô hình **chủ động – bị động** (master–slave). Một **thành phần chủ động** (master) là bên khởi tạo giao dịch bằng cách phát yêu cầu (ví dụ CPU hoặc DMA); một **thành phần bị động** (slave) là bên tiếp nhận và phục vụ yêu cầu rồi trả phản hồi (ví dụ bộ nhớ hoặc thiết bị ngoại vi). Mỗi giao dịch gồm một yêu cầu đi từ master đến slave và một phản hồi đi theo chiều ngược lại.

Giao thức tổ chức việc truyền tin trên tối đa **năm kênh** một chiều, ký hiệu A đến E, với vai trò như sau [2]:

- **Kênh A** mang yêu cầu từ master đến slave (đọc, ghi, thao tác nguyên tử, gợi ý). Đây là kênh khởi tạo giao dịch.
- **Kênh B** mang yêu cầu từ slave đến master, dùng trong cơ chế nhất quán để dò/thu hồi khối (chỉ có ở TL-C).
- **Kênh C** mang phản hồi của master cho kênh B, ví dụ trả lại hoặc ghi xuống khối bị thu hồi (chỉ có ở TL-C).
- **Kênh D** mang phản hồi từ slave về master cho yêu cầu trên kênh A (báo nhận, dữ liệu trả về…).
- **Kênh E** mang xác nhận cuối cùng của master để hoàn tất một giao dịch cấp quyền (chỉ có ở TL-C).

Như vậy, các cấp độ không nhất quán (TL-UL, TL-UH) chỉ cần hai kênh A và D, còn cấp độ nhất quán (TL-C) cần đủ năm kênh. Mỗi giao dịch trên kênh A và D mang một **mã thao tác** (opcode) xác định loại thao tác. Hình 2.5 minh họa một giao dịch cơ bản trên hai kênh A và D giữa master và slave, và Bảng 2.5 liệt kê các opcode của hai kênh này. Ngoài opcode, kênh A còn dùng một **mặt nạ byte** (byte mask) để chỉ định những byte nào trong một từ thực sự được ghi, phục vụ các thao tác ghi một phần.

[Hình 2.5: Mô hình giao dịch TileLink trên hai kênh A và D — master phát yêu cầu (opcode, địa chỉ, mặt nạ, dữ liệu) trên kênh A; slave xử lý và trả phản hồi (opcode, dữ liệu) trên kênh D]

**Bảng 2.5. Mã thao tác (opcode) trên kênh A và kênh D của TileLink**

| Kênh | Opcode | Mã số | Ý nghĩa | Phạm vi đề tài |
|---|---|---|---|---|
| A | `PutFullData` | 0 | Ghi đầy đủ một khối dữ liệu | Có (UL, UH) |
| A | `PutPartialData` | 1 | Ghi một phần, dùng mặt nạ byte | Có (UL, UH) |
| A | `ArithmeticData` | 2 | Thao tác số học nguyên tử (MIN/MAX/ADD…) | Có (UH) |
| A | `LogicalData` | 3 | Thao tác luận lý nguyên tử (XOR/OR/AND/SWAP) | Có (UH) |
| A | `Get` | 4 | Đọc dữ liệu | Có (UL, UH) |
| A | `Intent` | 5 | Lệnh gợi ý/đặt trước (hint) | Có (UL, UH) |
| D | `AccessAck` | 0 | Báo nhận cho thao tác ghi (không kèm dữ liệu) | Có |
| D | `AccessAckData` | 1 | Báo nhận kèm dữ liệu (cho đọc/nguyên tử) | Có |
| D | `HintAck` | 2 | Báo nhận cho lệnh gợi ý | Có |
| D | `Grant` / `GrantData` | 4 / 5 | Cấp quyền sở hữu khối (kèm/không kèm dữ liệu) | Ngoài phạm vi (TL-C) |
| D | `ReleaseAck` | 6 | Báo nhận thao tác thu hồi khối | Ngoài phạm vi (TL-C) |

*Ghi chú: Mã số opcode theo định nghĩa trong source `src/js/tilelink.js`, nhất quán với đặc tả TileLink [2]. Các opcode kênh D thuộc nhóm cấp quyền (`Grant`/`GrantData`/`ReleaseAck`) liên quan đến cơ chế nhất quán của TL-C, được định nghĩa để tham chiếu nhưng không được sử dụng trong luồng giao dịch của hệ thống.*

*Liên hệ đề tài:* Hệ thống định nghĩa và sử dụng các opcode kênh A và kênh D nêu trên cho luồng giao dịch đọc/ghi/nguyên tử/gợi ý, cùng cơ chế tính mặt nạ byte (xem source: `src/js/tilelink.js`). Các opcode được dùng làm cơ sở cho việc định tuyến và trực quan hóa giao dịch, sẽ trình bày ở Chương 4.

### 2.6.3. Tập con TileLink được sử dụng trong đề tài

Để bảo đảm tính chính xác khi trình bày, cần nêu rõ phần giao thức TileLink mà hệ thống thực sự hiện thực. Hệ thống mô phỏng ở **mức giao dịch** trên **hai kênh A và D**, tương ứng hai cấp độ **TL-UL và TL-UH**. Hệ thống **không** hiện thực ba kênh B, C, E cùng các luồng dò/thu hồi/cấp quyền, và do đó **không** bảo đảm nhất quán bộ nhớ đệm theo cấp độ TL-C (xem mục 7 trong phân tích phạm vi; source: `src/js/tilelink.js`). Về điều phối truy cập, cơ chế được mô hình hóa ở mức hàng đợi yêu cầu với một giao dịch được xử lý tại một thời điểm; trên cơ sở đó, hệ thống thể hiện việc nhiều thành phần (CPU và DMA) cùng đóng vai trò master phát yêu cầu, nhưng đây chưa phải là một cơ chế phân xử (arbitration) đa master đầy đủ (xem source: `src/js/tilelink_base.js`).

*Liên hệ đề tài:* Việc giới hạn ở tập con A/D và hai cấp độ UL/UH là một lựa chọn thiết kế phù hợp với mục tiêu minh họa ở mức hệ thống; những thành phần chưa hiện thực của giao thức (kênh B/C/E, nhất quán bộ nhớ đệm, phân xử đa master đầy đủ) được nêu trung thực và để ngỏ cho hướng phát triển ở Chương 6.

## 2.7. Truy cập bộ nhớ trực tiếp (DMA)

Khi cần di chuyển một khối lượng lớn dữ liệu giữa hai vùng nhớ hoặc giữa bộ nhớ và thiết bị ngoại vi, việc để CPU thực hiện từng cặp lệnh nạp – lưu là không hiệu quả: CPU bị chiếm dụng hoàn toàn cho thao tác sao chép và không thể làm việc khác trong suốt quá trình đó. **Truy cập bộ nhớ trực tiếp** (Direct Memory Access – DMA) giải quyết vấn đề này bằng cách giao việc vận chuyển dữ liệu cho một bộ điều khiển chuyên trách [11]. CPU chỉ cần thiết lập thông số cho lần truyền rồi tiếp tục thực thi công việc khác, trong khi bộ điều khiển DMA tự thực hiện việc đọc và ghi dữ liệu với vai trò một thành phần chủ động (master) trên hệ thống kết nối. Nhờ đó, việc di chuyển dữ liệu có thể diễn ra song song với tính toán của CPU, giúp giảm tải cho CPU.

**Mô tả truyền.** Thông số của một lần truyền thường được tổ chức thành một cấu trúc gọi là **mô tả truyền** (descriptor), bao gồm địa chỉ nguồn, địa chỉ đích, số lượng dữ liệu cần truyền và các tham số cấu hình khác. Bộ điều khiển đọc mô tả này để biết cần truyền gì và truyền như thế nào.

**Chế độ địa chỉ.** Trong quá trình truyền, địa chỉ nguồn và địa chỉ đích có thể được xử lý theo các chế độ khác nhau. Với **địa chỉ cố định**, mỗi phần tử được đọc từ hoặc ghi vào cùng một địa chỉ — phù hợp khi một đầu của lần truyền là một thanh ghi dữ liệu của thiết bị ngoại vi. Với **địa chỉ tăng dần**, địa chỉ được tăng sau mỗi phần tử — phù hợp khi đầu kia là một vùng đệm liên tục trong bộ nhớ.

**Nhận biết hoàn tất.** Phần mềm cần biết khi nào lần truyền kết thúc. Có hai cách phổ biến: **đọc thăm dò** (polling), trong đó CPU đọc lặp một thanh ghi trạng thái cho đến khi thấy cờ báo hoàn tất; và **ngắt** (interrupt), trong đó bộ điều khiển chủ động phát tín hiệu báo cho CPU khi hoàn tất, giúp CPU không phải chờ. Hình 2.6 đối chiếu luồng dữ liệu khi sao chép bằng CPU và khi sao chép bằng DMA.

[Hình 2.6: So sánh luồng sao chép dữ liệu — (a) CPU-copy: CPU lần lượt đọc từ nguồn rồi ghi sang đích cho từng phần tử, bị chiếm dụng toàn bộ; (b) DMA-copy: CPU thiết lập mô tả truyền rồi làm việc khác, DMA tự thực hiện đọc–ghi và báo hoàn tất]

*Liên hệ đề tài:* Hệ thống hiện thực một bộ điều khiển DMA dùng mô tả truyền gồm địa chỉ nguồn, địa chỉ đích và một từ cấu hình (chứa số phần tử, chế độ địa chỉ nguồn/đích và tùy chọn đảo byte), có hàng đợi mô tả và điều khiển qua các thanh ghi ánh xạ bộ nhớ; DMA đóng vai trò master trên cả bus bộ nhớ và bus ngoại vi (xem source: `src/js/dma.js`, `src/js/soc.js`). Như đã nêu ở mục 1.3.2, hệ thống nhận biết hoàn tất bằng cơ chế đọc thăm dò thanh ghi trạng thái; chưa có đường tín hiệu ngắt tới CPU. Chi tiết cấu trúc thanh ghi và quy trình truyền được trình bày ở Chương 4.

## 2.8. Vào/ra ánh xạ bộ nhớ (MMIO) và thiết bị ngoại vi

**Vào/ra ánh xạ bộ nhớ** (Memory-Mapped I/O – MMIO) là phương thức điều khiển thiết bị ngoại vi bằng cách ánh xạ các thanh ghi điều khiển và dữ liệu của thiết bị vào cùng không gian địa chỉ với bộ nhớ [11]. Khi đó, bộ xử lý không cần một tập lệnh vào/ra riêng: việc đọc hoặc ghi tới một địa chỉ thuộc vùng của thiết bị sẽ tác động trực tiếp lên thanh ghi tương ứng của thiết bị, sử dụng chính các lệnh nạp/lưu thông thường. Cách tiếp cận này đơn giản hóa kiến trúc tập lệnh và thống nhất cơ chế truy cập bộ nhớ với truy cập thiết bị.

Một đặc điểm quan trọng của vùng MMIO là các truy cập tới nó thường có **hiệu ứng phụ** (side effect): chẳng hạn, đọc một thanh ghi dữ liệu có thể lấy đi một ký tự khỏi bộ đệm nhận của thiết bị, hoặc ghi một thanh ghi có thể kích hoạt một hành động. Vì vậy, các vùng MMIO phải được đánh dấu **không lưu đệm** (mục 2.4, 2.5) để mọi thao tác đọc/ghi đều tác động trực tiếp lên thiết bị thay vì lên một bản sao trong bộ nhớ đệm. Việc giao tiếp với thiết bị qua MMIO cũng có thể theo kiểu đọc thăm dò hoặc theo kiểu hướng ngắt, tương tự như đã trình bày ở mục 2.7.

Ở mức khái niệm, hệ thống của đề tài có năm thiết bị ngoại vi, mỗi thiết bị chiếm một vùng địa chỉ MMIO riêng:

- **Bộ thu phát không đồng bộ đa năng (Universal Asynchronous Receiver/Transmitter – UART):** thiết bị giao tiếp nối tiếp, dùng làm cổng console để truyền và nhận dữ liệu dạng ký tự, có thể cấu hình tốc độ truyền (baud).
- **Bộ điều khiển mạng CAN (Controller Area Network – CAN):** ngoại vi giáo dục tối thiểu ở mức frame/message qua MMIO, có standard ID 11-bit, DLC 0..8, payload 8 byte, một TX mailbox, một RX mailbox và loopback; không có physical layer, bit stuffing, CRC, ACK hoặc arbitration bit-level.
- **Ma trận đèn (Light-Emitting Diode – LED):** thiết bị hiển thị dạng lưới điểm ảnh, trạng thái các điểm ảnh được lưu trong một vùng bộ nhớ hiển thị (video memory) được ánh xạ vào không gian địa chỉ.
- **Bàn phím (keyboard):** thiết bị nhập, dùng một bộ đệm để lưu các ký tự gõ vào theo thứ tự, phần mềm đọc lần lượt qua thanh ghi dữ liệu.
- **Chuột (mouse):** thiết bị nhập, cung cấp tọa độ con trỏ và trạng thái nút nhấn qua các thanh ghi tương ứng.

*Liên hệ đề tài:* Cả năm thiết bị ngoại vi nêu trên được gắn vào bus ngoại vi TL-UL và được điều khiển qua các thanh ghi MMIO không lưu đệm (xem source: `src/js/soc.js`, `src/js/uart.js`, `src/js/can.js`, `src/js/led_matrix.js`, `src/js/keyboard.js`, `src/js/mouse.js`). Phù hợp với mục 2.7, trạng thái thiết bị được nhận biết qua đọc thăm dò. Bản đồ địa chỉ tổng thể được trình bày ở Chương 3, còn chi tiết bản đồ thanh ghi của từng thiết bị được trình bày ở Chương 4.

## 2.9. Công nghệ nền tảng web

Hệ thống được hiện thực dưới dạng một ứng dụng web tĩnh nhằm bảo đảm khả năng tiếp cận không cần cài đặt, như đã nêu trong mục tiêu ở Chương 1. Phần này giới thiệu ngắn gọn các công nghệ nền tảng được sử dụng, ở mức đủ để hiểu các lựa chọn hiện thực.

**HTML, CSS và JavaScript.** Ba công nghệ này là nền tảng của ứng dụng web phía trình duyệt [13]: HTML (HyperText Markup Language) mô tả cấu trúc nội dung; CSS (Cascading Style Sheets) quy định trình bày và bố cục; còn JavaScript là ngôn ngữ lập trình thực thi logic trong trình duyệt. JavaScript chạy theo **mô hình đơn luồng** dựa trên vòng lặp sự kiện (event loop): các tác vụ được xử lý tuần tự trên một luồng chính, do đó việc cập nhật giao diện theo từng bước mô phỏng cần được tổ chức hợp lý để không chặn luồng này. Để cập nhật hiển thị mượt mà theo khung hình, trình duyệt cung cấp cơ chế đăng ký vẽ lại đồng bộ với chu kỳ làm tươi màn hình (`requestAnimationFrame`).

**Mô-đun ES (ES modules).** Phiên bản hiện đại của JavaScript hỗ trợ cơ chế mô-đun chuẩn hóa (ECMAScript modules), cho phép tách mã nguồn thành nhiều tệp độc lập và khai báo quan hệ phụ thuộc qua các câu lệnh nhập/xuất (`import`/`export`) [13]. Cơ chế này hỗ trợ tổ chức mã theo hướng mô-đun, trong đó mỗi đơn vị chức năng được đóng gói riêng.

**Phần tử canvas.** HTML cung cấp phần tử `canvas` cho phép vẽ đồ họa điểm ảnh hai chiều bằng JavaScript [13]. Phần tử này phù hợp để hiển thị các nội dung thay đổi liên tục theo trạng thái, chẳng hạn một lưới điểm ảnh được cập nhật theo nội dung vùng bộ nhớ hiển thị.

**Thư viện soạn thảo CodeMirror.** CodeMirror là một thư viện soạn thảo mã nguồn chạy trong trình duyệt, cung cấp các tính năng như tô màu cú pháp theo ngôn ngữ, hiển thị số dòng và hỗ trợ gợi ý khi nhập [14]. Thư viện này thường được dùng để xây dựng vùng nhập mã trong các công cụ lập trình trên nền web.

*Liên hệ đề tài:* Hệ thống được tổ chức theo mô hình mô-đun ES, trong đó mỗi thành phần phần cứng mô phỏng là một mô-đun JavaScript riêng và được lắp ghép tại một thành phần khởi tạo trung tâm (xem source: `src/js/soc.js`, `src/index.html`). Vùng nhập hợp ngữ sử dụng thư viện CodeMirror với chế độ tô màu cú pháp cho RISC-V, thiết bị ma trận LED được vẽ bằng phần tử canvas, và vòng lặp chạy mô phỏng được điều phối qua cơ chế vẽ lại theo khung hình (xem source: `src/index.html`, `src/js/javascript.js`, `src/js/led_matrix.js`). Chi tiết về giao diện và vòng điều khiển thực thi được trình bày ở Chương 3 và Chương 4.

---

## Tài liệu tham khảo (trích dẫn trong Chương 2)

> *Ghi chú: Danh sách dưới đây liệt kê các tài liệu được trích dẫn trong Chương 2, trình bày theo chuẩn IEEE và đánh số theo thứ tự xuất hiện trong toàn báo cáo; danh sách này được hợp nhất vào mục Tài liệu tham khảo chung ở cuối báo cáo.*

[1] A. Waterman và K. Asanović (chủ biên), "The RISC-V Instruction Set Manual, Volume I: Unprivileged ISA, Document Version 20191213," RISC-V Foundation, tháng 12/2019. [Trực tuyến]. Có tại: https://riscv.org/technical/specifications/

[2] SiFive, Inc., "SiFive TileLink Specification, Version 1.8.1," 2020. [Trực tuyến]. Có tại: https://www.sifive.com/documentation/tilelink/

[10] "IEEE Standard for Floating-Point Arithmetic," IEEE Std 754-2019 (bản sửa đổi của IEEE Std 754-2008), trang 1–84, tháng 7/2019.

[11] D. A. Patterson và J. L. Hennessy, Computer Organization and Design: The Hardware/Software Interface, RISC-V Edition, tái bản lần 2. Cambridge, MA, Hoa Kỳ: Morgan Kaufmann, 2020.

[12] J. L. Hennessy và D. A. Patterson, Computer Architecture: A Quantitative Approach, tái bản lần 6. Cambridge, MA, Hoa Kỳ: Morgan Kaufmann, 2019.

[13] Mozilla, "MDN Web Docs." [Trực tuyến]. Có tại: https://developer.mozilla.org/ (truy cập: 19/01/2026).

[14] M. Haverbeke, "CodeMirror — thư viện soạn thảo mã trên nền web." [Trực tuyến]. Có tại: https://codemirror.net/ (truy cập: 19/01/2026).
