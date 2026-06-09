# Chương 4. HIỆN THỰC HỆ THỐNG

Chương 3 đã trình bày kiến trúc tổng quan của trình mô phỏng, bản đồ địa chỉ, mô hình tiến triển theo chu kỳ và lớp trừu tượng cổng kết nối ở mức thiết kế. Chương này đi vào hiện thực chi tiết bên trong từng mô-đun: các cấu trúc dữ liệu, giải thuật, bảng mã hóa lệnh, bản đồ thanh ghi của từng thiết bị, các máy trạng thái và tham số cấu hình — tức là những nội dung đã được Chương 3 hẹn "trình bày chi tiết ở Chương 4". Để tránh trùng lặp, chương này không nhắc lại lý thuyết nền (kiến trúc tập lệnh RISC-V, MMU, bộ nhớ đệm, TileLink, DMA, vào/ra ánh xạ bộ nhớ) vốn đã trình bày ở Chương 2, mà chỉ tham chiếu ngắn tới mục tương ứng khi cần; chương cũng không mô tả lại sơ đồ kiến trúc tổng quan, bản đồ địa chỉ hay mô hình tick ở mức khái niệm vốn đã trình bày ở Chương 3, mà đi thẳng vào cách mỗi mô-đun được hiện thực bên trong. Phần kiểm thử chi tiết thuộc Chương 5; ở đây chỉ nhắc tới các điểm nối kiểm thử khi liên quan trực tiếp đến thiết kế.

Nhất quán với Chương 1–3, mỗi đoạn mô tả kỹ thuật đều được ánh xạ tới tệp mã nguồn tương ứng qua chú thích "(xem source: …)", và các giới hạn của từng mô-đun được nêu trung thực ngay tại chỗ thay vì khẳng định quá mức.

Trình mô phỏng được hiện thực hoàn toàn bằng JavaScript theo mô hình mô-đun ES (ES modules): mỗi thành phần phần cứng là một mô-đun độc lập, được nạp trực tiếp bởi trình duyệt qua thuộc tính `type="module"` mà không qua bước biên dịch hay đóng gói. Hệ thống không sử dụng một khung làm việc (framework) dạng ứng dụng trang đơn (SPA); thao tác cập nhật giao diện được viết trực tiếp trên mô hình tài liệu (DOM). Chỉ một số thư viện được nạp qua mạng phân phối nội dung (CDN): CodeMirror cho trình soạn thảo mã [14] và Material Components Web cùng bộ biểu tượng Material Icons cho các thành phần giao diện [15]; ma trận LED được vẽ bằng phần tử `canvas` của HTML [13]. Vì không có bước build, hệ thống được chạy bằng cách phục vụ thư mục mã nguồn qua một máy chủ HTTP tĩnh (ví dụ `python -m http.server`) và truy cập đường dẫn `src/` (xem source: `README.md`); việc chạy qua máy chủ HTTP là cần thiết do trình duyệt áp dụng chính sách an toàn cho việc nạp mô-đun ES. Các mô-đun lõi mô phỏng không phụ thuộc vào đối tượng trình duyệt nên còn có thể nạp và kiểm thử ở chế độ dòng lệnh bằng Node.js thông qua các kịch bản `.mjs` trong thư mục `test/` (xem source: `test/`); phần lý thuyết về các công nghệ nền tảng web đã được trình bày ở mục 2.9. Hai bảng dưới đây tóm tắt cấu trúc thư mục `src/` và `test/`.

**Cấu trúc thư mục mã nguồn `src/`**

| Tệp / thư mục | Vai trò |
|---|---|
| `src/index.html` | Vỏ giao diện: thanh bên, các khung nhìn, thanh công cụ, vùng I/O, terminal nhật ký; khai báo các thư viện CDN |
| `src/style.css` | Định kiểu giao diện |
| `src/js/javascript.js` | Bộ điều khiển giao diện: vòng điều khiển thực thi, vẽ lại trạng thái, định nghĩa chế độ tô màu CodeMirror |
| `src/js/soc.js` | Thành phần khởi tạo trung tâm: khởi tạo mô-đun, lập bản đồ địa chỉ, nối cổng, điều phối tick |
| `src/js/cpu.js` | Lõi xử lý RV32IMF: giải mã, thực thi, tệp thanh ghi, xử lý dịch vụ hệ thống |
| `src/js/assembler.js`, `editor_hint.js` | Trình biên dịch hợp ngữ hai lượt; gợi ý nhập cho trình soạn thảo |
| `src/js/mem.js`, `mmu.js`, `SimpleCache.js` | Bộ nhớ chính; đơn vị quản lý bộ nhớ và TLB; bộ nhớ đệm |
| `src/js/tilelink.js`, `tilelink_base.js`, `tilelink_UH.js`, `tilelink_UL.js`, `tilelink_bridge.js`, `port_link.js` | Lõi giao thức TileLink; hạ tầng bus; hai phân hệ UH/UL; cầu nối; lớp cổng |
| `src/js/dma.js` | Bộ điều khiển DMA |
| `src/js/uart.js`, `led_matrix.js`, `keyboard.js`, `mouse.js` | Bốn thiết bị ngoại vi |
| `src/js/soc_diagram.js`, `system_log_bootstrap.js` | Sơ đồ SoC động; bắt và phân loại nhật ký hệ thống |

**Cấu trúc thư mục kiểm thử `test/`**

| Nhóm | Tệp tiêu biểu | Vai trò |
|---|---|---|
| Kiểm thử đơn vị/khói (Node.js) | `assembler_verify.mjs`, `asm_programs_verify.mjs`, `mmu_basic_verify.mjs`, `tilelink_verify.mjs`, `dma_verify.mjs`, `syscall_output_verify.mjs`, `mmu_syscall_verify.mjs`, `log_filter_verify.mjs` | Kiểm tra cục bộ từng mô-đun và tích hợp nhẹ |
| Đối chiếu tham chiếu | `verify_rv32imf_against_gnu.mjs`, `verify_project_assembler_spike.mjs`, `verify_riscv_tests_spike.mjs` | Đối chiếu mã hóa với GNU binutils và thực thi với Spike trên `riscv-tests` |
| Bộ chạy mô phỏng | `run_demo.mjs`, `mmu_demo.mjs` | Chạy chương trình mẫu ở chế độ dòng lệnh |
| Chương trình minh họa | `bus_demo.asm`, `demo_uart.asm`, `dma_demo.asm`, `dma_led_demo.asm`, `led_demo.asm`, `test_fpu.asm`, `test_cache.asm`, `test_keyboard.asm`, `mouse_demo.asm`, `soc_full_demo.asm`, … | Chương trình hợp ngữ minh họa từng khối/ngoại vi |
| Tài liệu | `README_rv32imf_verification.md` | Mô tả môi trường và quy trình kiểm chứng |

Chi tiết quy trình và kết quả kiểm thử được trình bày ở Chương 5.

## 4.1. Trình biên dịch hợp ngữ (Assembler)

Trình biên dịch hợp ngữ được hiện thực như một đối tượng đơn `assembler` mang toàn bộ trạng thái biên dịch và các hàm xử lý, biên dịch mã hợp ngữ RV32IMF thành mã máy theo quy trình hai lượt (xem source: `src/js/assembler.js`).

### 4.1.1. Kiến trúc hai lượt (two-pass)

Trạng thái biên dịch gồm: ảnh bộ nhớ `memory` (ánh xạ địa chỉ byte sang giá trị byte), bảng nhãn `labels`, bảng hằng số `equValues` do chỉ thị `.eqv` định nghĩa, con trỏ địa chỉ hiện hành `currentAddress`, danh sách thông tin từng dòng `instructionLines`, và danh sách mã máy đã sinh `binaryCode`. Hai địa chỉ nền mặc định được quy ước: vùng mã `.text` bắt đầu tại `0x00400000` và vùng dữ liệu `.data` bắt đầu tại `0x10010000` (xem source: `src/js/assembler.js`). Hàm điều phối `assemble` lần lượt gọi `_reset`, `_pass1`, `_pass2`, rồi xác định địa chỉ bắt đầu thực thi.

**Lượt một (`_pass1`).** Lượt một duyệt mã nguồn theo từng dòng. Với mỗi dòng, trình biên dịch cắt bỏ chú thích (ký tự `#` đến hết dòng), tách nhãn ở đầu dòng (mẫu `tên:`) và ghi nhãn đó vào bảng nhãn với địa chỉ hiện hành cùng loại (`instruction` nếu đang ở vùng mã, `data` nếu đang ở vùng dữ liệu). Phần còn lại của dòng được tách thành mnemonic và danh sách toán hạng bằng một bộ phân tích có nhận biết dấu ngoặc và chuỗi (`_parseOperandsSmart`), nhờ đó toán hạng dạng `offset(base)` hay chuỗi chứa dấu phẩy không bị tách sai. Tùy theo dòng là chỉ thị, lệnh thật hay lệnh giả, lượt một tính kích thước byte tương ứng và tăng `currentAddress`: mỗi lệnh RV32 chiếm 4 byte, riêng lệnh giả có thể chiếm 4 hoặc 8 byte và được ước lượng trước bởi `_estimatePseudoInstructionSize`. Mục tiêu của lượt một là dựng đầy đủ bảng nhãn và bố trí địa chỉ trước khi mã hóa, để các tham chiếu tiến (forward reference) tới nhãn nằm phía sau vẫn giải được ở lượt hai.

**Lượt hai (`_pass2`).** Lượt hai duyệt lại danh sách dòng đã ghi nhận, bỏ qua các dòng không phải lệnh, và mã hóa từng lệnh thành chuỗi nhị phân 32 bit. Lệnh thật được mã hóa trực tiếp bởi `_encodeInstruction`; lệnh giả được khai triển thành một hoặc nhiều lệnh thật rồi mã hóa bởi `_expandAndEncodePseudo`. Mỗi từ lệnh 32 bit được ghi vào ảnh bộ nhớ theo thứ tự byte nhỏ trước (little-endian) bằng hàm `_writeBinaryToMemory`, đồng thời được thêm vào `binaryCode` kèm biểu diễn thập lục phân để hiển thị. Lỗi cú pháp hoặc lỗi mã hóa được bắt và ném lại kèm số dòng và nội dung dòng gốc, nhờ đó thông báo lỗi chỉ đúng vị trí dòng để người học sửa.

**Xác định địa chỉ bắt đầu.** Sau hai lượt, trình biên dịch ưu tiên nhãn `_start` (nếu tồn tại và nằm trong vùng `.text`) làm địa chỉ bắt đầu; nếu không có, nó lấy lệnh đầu tiên trong vùng mã, mặc định là `0x00400000`. Kết quả trả về là một gói gồm ảnh bộ nhớ, địa chỉ bắt đầu và danh sách lệnh đã mã hóa (xem source: `src/js/assembler.js`).

Hình 4.1 tóm tắt quy trình hai lượt của trình biên dịch.

[Hình 4.1: Sơ đồ hoạt động của trình biên dịch hai lượt. Bắt đầu ở "Mã nguồn hợp ngữ". Mũi tên xuống tới khối "Lượt 1: _pass1" chứa các bước nối tiếp: "Tách chú thích/nhãn" → "Phân tích mnemonic + toán hạng" → nút quyết định "Là chỉ thị?": nhánh CÓ → "Gọi handler directive (cập nhật section/địa chỉ/dữ liệu)"; nhánh KHÔNG → "Tính kích thước lệnh (4B; lệnh giả 4/8B)" → "currentAddress += size" → "Ghi nhãn & lineInfo". Vòng lặp quay lại đầu cho dòng tiếp theo; kết thúc lượt 1 cho ra "Bảng nhãn + danh sách dòng + bố trí địa chỉ". Mũi tên xuống tới khối "Lượt 2: _pass2": "Duyệt từng dòng lệnh" → nút quyết định "Lệnh giả?": nhánh CÓ → "_expandAndEncodePseudo (khai triển → lệnh thật)"; nhánh KHÔNG → "_encodeInstruction"; cả hai hợp lại tại "Ghi little-endian vào ảnh bộ nhớ" → "Thêm vào binaryCode". Kết thúc tại "Xác định startAddress (_start hoặc lệnh đầu .text)" → "Gói kết quả {memory, startAddress, instructions}". Một nhánh phụ từ cả hai lượt dẫn tới khối "Báo lỗi theo dòng" khi có ngoại lệ.] (xem source: `src/js/assembler.js`)

### 4.1.2. Chỉ thị và lệnh giả

Trình biên dịch điều phối các chỉ thị (directive) qua một bảng ánh xạ tên chỉ thị sang hàm xử lý. Bảng 4.1 liệt kê các chỉ thị được hỗ trợ; trong đó `.single` là tên gọi khác của `.float`, `.string` là tên gọi khác của `.asciiz`, và `.global` là tên gọi khác của `.globl` (cùng dùng chung một hàm xử lý) (xem source: `src/js/assembler.js`).

**Bảng 4.1. Các chỉ thị được hỗ trợ**

| Chỉ thị | Chức năng |
|---|---|
| `.text [addr]` | Chuyển sang vùng mã; đặt địa chỉ nếu có tham số |
| `.data [addr]` | Chuyển sang vùng dữ liệu; mặc định `0x10010000` |
| `.section <tên>` | Chuyển section theo tên (hỗ trợ `.text`, `.data`, `.rodata`, `.bss`, `.text.init`…) |
| `.word`, `.half`, `.byte` | Lưu giá trị 4/2/1 byte (kèm căn lề tương ứng cho word/half) |
| `.float` (`.single`) | Lưu số thực đơn IEEE 754 (4 byte, little-endian) |
| `.ascii` | Lưu chuỗi, không có ký tự kết thúc |
| `.asciiz` (`.string`) | Lưu chuỗi, có ký tự null kết thúc |
| `.space <n>` | Cấp phát `n` byte giá trị 0 |
| `.align <n>` | Căn lề địa chỉ hiện hành theo `2^n` byte |
| `.globl` (`.global`) | Đánh dấu nhãn là toàn cục |
| `.extern` | Khai báo ký hiệu ngoài (tương thích đầu vào) |
| `.eqv <tên>, <giá trị>` | Định nghĩa hằng số ký hiệu |
| `.org <addr>` | Đặt địa chỉ biên dịch hiện hành |

Các chỉ thị lưu dữ liệu tự động chuyển sang vùng dữ liệu nếu cần (`_ensureDataSection`) và căn lề trước khi ghi; chỉ thị `.byte` còn nhận ký tự dạng `'A'`; chỉ thị `.float` dùng `DataView.setFloat32` (little-endian) để biểu diễn IEEE 754; xử lý chuỗi có giải mã các chuỗi thoát (`\n`, `\t`, `\"`, …) (xem source: `src/js/assembler.js`).

Lệnh giả (pseudo-instruction) được khai triển thành lệnh thật ở lượt hai. Bảng 4.2 liệt kê 13 lệnh giả và quy tắc khai triển tương ứng (xem source: `src/js/assembler.js`).

**Bảng 4.2. Lệnh giả và quy tắc khai triển**

| Lệnh giả | Khai triển |
|---|---|
| `nop` | `addi x0, x0, 0` |
| `mv rd, rs` | `addi rd, rs, 0` |
| `li rd, imm` | `addi` (khi `imm` trong `[-2048, 2047]`); ngược lại `lui` + `addi` (hoặc chỉ `lui` khi phần thấp bằng 0) |
| `la rd, sym` | `auipc rd, %hi'(sym−PC)` + `addi rd, rd, %lo'(sym−PC)` (luôn sinh đủ 8 byte) |
| `call sym` | `auipc ra, hi` + `jalr ra, ra, lo` |
| `j label` | `jal x0, label` |
| `jr rs` | `jalr x0, rs, 0` |
| `ret` | `jalr x0, ra, 0` |
| `bnez rs, label` | `bne rs, x0, label` |
| `beqz rs, label` | `beq rs, x0, label` |
| `fmv.s fd, fs` | `fsgnj.s fd, fs, fs` |
| `fabs.s fd, fs` | `fsgnjx.s fd, fs, fs` |
| `fneg.s fd, fs` | `fsgnjn.s fd, fs, fs` |

Hai lệnh giả `li` và `la` cần xử lý đặc biệt vì kích thước phụ thuộc giá trị/khoảng cách. Với `li`, khi hằng số nằm trong dải 12 bit có dấu thì chỉ cần một lệnh `addi`; ngược lại trình biên dịch tách hằng số thành phần cao 20 bit (`lui`) và phần thấp 12 bit có dấu (`addi`), áp dụng quy tắc làm tròn lên (cộng `0x800` trước khi dịch phải 12 bit) để bù khi bit 11 của phần thấp bằng 1. Với `la`, trình biên dịch tính khoảng cách tương đối giữa nhãn đích và địa chỉ lệnh rồi sinh cặp `auipc` + `addi`; vì lượt một đã dành sẵn 8 byte cho `la`, lượt hai luôn phát đủ cả hai lệnh kể cả khi phần thấp bằng 0, tránh để lại khoảng trống 4 byte mà lõi xử lý có thể nạp nhầm thành lệnh không hợp lệ (xem source: `src/js/assembler.js`).

### 4.1.3. Mã hóa lệnh và ánh xạ thanh ghi

Bảng `opcodes` lưu thông tin mã hóa của từng lệnh: mã thao tác (`opcode`), trường `funct3`/`funct7` (khi có), và loại định dạng (`type`). Hàm `_encodeInstruction` chọn nhánh mã hóa theo loại định dạng và ghép các trường bit thành chuỗi 32 ký tự nhị phân; bước cuối kiểm tra độ dài đúng 32 bit trước khi trả về. Bảng dưới đây tóm tắt các loại định dạng và cách ghép trường; bảng mã hóa đầy đủ cho từng lệnh (opcode/funct3/funct7) được đặt ở Phụ lục A.

**Các loại định dạng lệnh và cách ghép trường bit (từ bit 31 về bit 0)**

| Loại | Áp dụng cho | Bố cục trường (cao → thấp) |
|---|---|---|
| R | ALU reg–reg, RV32M | `funct7 · rs2 · rs1 · funct3 · rd · opcode` |
| I | ALU reg–imm, load, `jalr`, `ecall`/`ebreak` | `imm[11:0] · rs1 · funct3 · rd · opcode` |
| I-shamt | `slli`/`srli`/`srai` | `funct7 · shamt[4:0] · rs1 · funct3 · rd · opcode` |
| S | store | `imm[11:5] · rs2 · rs1 · funct3 · imm[4:0] · opcode` |
| B | branch | `imm[12] · imm[10:5] · rs2 · rs1 · funct3 · imm[4:1] · imm[11] · opcode` |
| U | `lui`, `auipc` | `imm[31:12] · rd · opcode` |
| J | `jal` | `imm[20] · imm[10:1] · imm[11] · imm[19:12] · rd · opcode` |
| R-FP | số học FP hai toán hạng | `funct7 · rs2 · rs1 · rm · rd · opcode` |
| R4-FP | FMA bốn thanh ghi | `rs3 · fmt · rs2 · rs1 · rm · rd · opcode` |
| R-FP-CVT | chuyển đổi/khai căn/di chuyển bit | `funct7 · rs2_subfield · rs1 · rm · rd · opcode` |
| R-FP-CMP | so sánh (`feq`/`flt`/`fle`) | `funct7 · rs2 · rs1 · funct3 · rd · opcode` |
| I-FP / S-FP | `flw` / `fsw` | như I / như S |

Các trường immediate tương đối với PC (nhánh B và J) được kiểm tra căn lề và phạm vi bởi `_validatePCRelativeImmediate` trước khi cắt ghép bit. Toán hạng dạng bộ nhớ `offset(base)` được phân tích bởi `_parseMemoryOperand`. Trình biên dịch hỗ trợ hai bộ định vị (relocation) `%hi(sym)` và `%lo(sym)` cho phép nạp địa chỉ 32 bit bằng cặp `lui`/`addi`: phần cao được tính bằng cách làm tròn lên `roundedUpper = ⌊(sym + 0x800) / 0x1000⌋` và phần thấp là `sym − roundedUpper·0x1000`, bảo đảm tổng hai phần khôi phục đúng giá trị gốc khi phần thấp được mở rộng dấu (xem source: `src/js/assembler.js`).

Với các lệnh dấu phẩy động, chế độ làm tròn (rounding mode) được mã hóa vào trường `rm`: nếu lệnh có `funct3` cố định thì dùng giá trị đó, ngược lại đọc toán hạng chế độ làm tròn tùy chọn (`rne`/`rtz`/`rdn`/`rup`/`rmm`/`dyn`, mặc định `dyn`). Lệnh `fence` được mã hóa với hai tập quyền hạn (predecessor/successor) qua `_encodeFenceSet`; tuy vậy, đúng như giới hạn đã nêu ở mục 1.3.2, `fence` chỉ được mã hóa chứ chưa được lõi xử lý thực thi.

Trình biên dịch chấp nhận nhiều cách viết tên thanh ghi và quy về tên chuẩn qua bảng `registerMapping`: tên ABI (ví dụ `sp`, `a0`, `t0`), tên kiểu MIPS có tiền tố `$`, và tên dạng chỉ số (`x0`–`x31`, `f0`–`f31`). Bảng 4.3 trình bày ánh xạ tên ABI của 32 thanh ghi số nguyên và 32 thanh ghi dấu phẩy động (xem source: `src/js/assembler.js`, `src/js/editor_hint.js`).

**Bảng 4.3. Ánh xạ tên thanh ghi ABI**

| Số nguyên | ABI | Vai trò quy ước | | Dấu phẩy động | ABI |
|---|---|---|---|---|---|
| x0 | `zero` | hằng số 0 | | f0–f7 | `ft0`–`ft7` (tạm) |
| x1 | `ra` | địa chỉ trả về | | f8–f9 | `fs0`–`fs1` (được giữ) |
| x2 | `sp` | con trỏ ngăn xếp | | f10–f11 | `fa0`–`fa1` (đối số/trả về) |
| x3 | `gp` | con trỏ toàn cục | | f12–f17 | `fa2`–`fa7` (đối số) |
| x4 | `tp` | con trỏ luồng | | f18–f27 | `fs2`–`fs11` (được giữ) |
| x5–x7 | `t0`–`t2` | tạm | | f28–f31 | `ft8`–`ft11` (tạm) |
| x8–x9 | `s0`/`fp`, `s1` | được giữ / con trỏ khung | | | |
| x10–x17 | `a0`–`a7` | đối số/trả về (a7 = mã syscall) | | | |
| x18–x27 | `s2`–`s11` | được giữ | | | |
| x28–x31 | `t3`–`t6` | tạm | | | |

### 4.1.4. Hỗ trợ soạn thảo

Trình soạn thảo dựa trên thư viện CodeMirror [14]. Việc tô màu cú pháp được định nghĩa bằng một chế độ (mode) đơn giản tên `riscv` qua `CodeMirror.defineSimpleMode`, phân loại các phần tử của một dòng hợp ngữ thành: chú thích (`#…`), chuỗi, từ khóa chỉ thị (`.text`, `.data`, `.word`, …), một số mnemonic thường gặp, tên thanh ghi (`x0`–`x31`, `f0`–`f31` và tên ABI), nhãn (`tên:`) và hằng số (thập lục phân hoặc thập phân/thực) (xem source: `src/js/javascript.js`).

Hỗ trợ gợi ý nhập (autocompletion) được hiện thực trong mô-đun riêng `editor_hint.js` qua tiện ích `show-hint` của CodeMirror. Mô-đun này dựng một từ điển gợi ý từ chính bảng `opcodes` và bảng `directives` của trình biên dịch (nhờ đó danh sách gợi ý luôn đồng bộ với tập lệnh được hỗ trợ), kèm theo danh mục thanh ghi số nguyên/dấu phẩy động, chế độ làm tròn, tập quyền hạn của `fence`, và các trợ giúp immediate (`%hi`, `%lo`, mẫu `offset(base)`). Gợi ý có nhận biết ngữ cảnh: ở đầu câu lệnh, hệ thống gợi ý mnemonic hoặc chỉ thị; ở vị trí toán hạng, hệ thống suy ra loại toán hạng mong đợi (thanh ghi số nguyên, thanh ghi dấu phẩy động, nhãn, chế độ làm tròn, toán hạng bộ nhớ…) dựa trên loại định dạng của lệnh và chỉ số toán hạng. Hệ thống còn tự dò các nhãn và hằng số `.eqv` do người dùng định nghĩa trong mã để đưa vào danh sách gợi ý, và không kích hoạt gợi ý khi con trỏ nằm trong chú thích hoặc chuỗi (xem source: `src/js/editor_hint.js`).

Hình 4.2 minh họa cơ chế gợi ý cú pháp trong trình soạn thảo.

[Hình 4.2: Minh họa gợi ý cú pháp trong trình soạn thảo. Khung soạn thảo CodeMirror với mã hợp ngữ được tô màu (chú thích xám, chỉ thị và mnemonic khác màu, thanh ghi và số khác màu). Con trỏ đặt sau `addi t0,` và một danh sách thả xuống hiển thị các mục gợi ý, mỗi mục gồm: nhãn (ví dụ `t1`), một huy hiệu loại (`reg`), dòng mô tả ngắn ("temporary register"), và dòng cú pháp/ví dụ. Bên trái mỗi dòng có biểu tượng loại gợi ý. Cột số dòng và cột đặt điểm dừng hiển thị bên trái khung soạn thảo.] (xem source: `src/js/editor_hint.js`, `src/js/javascript.js`)

## 4.2. Bộ xử lý CPU RV32IMF

Lõi xử lý được hiện thực trong lớp `CPU` (xem source: `src/js/cpu.js`). Phần này trình bày tổ chức trạng thái, chu trình thực thi cùng mô hình truy cập bộ nhớ bất đồng bộ, cách hiện thực ba nhóm lệnh I/M/F, và việc xử lý dịch vụ hệ thống.

### 4.2.1. Tổ chức thanh ghi và trạng thái

Tệp thanh ghi số nguyên được biểu diễn bằng `Int32Array(32)` (x0–x31), tệp thanh ghi dấu phẩy động bằng `Float32Array(32)` (f0–f31); việc dùng `Float32Array` khiến mỗi giá trị tự động được lưu ở độ chính xác đơn IEEE 754 [10] mà không cần cắt xén thủ công. Bộ đếm chương trình là `pc`. Ngoài ra, lõi xử lý giữ bộ đếm số lệnh đã hoàn tất `instructionCount`, một trường giới hạn an toàn `maxSteps` (mặc định 1.000.000), cờ trạng thái chạy `isRunning`, và hai cổng kết nối: cổng trên (`upperPort`) và cổng dưới (`lowerPort`) — cổng dưới là đường phát yêu cầu xuống đơn vị quản lý bộ nhớ (xem source: `src/js/cpu.js`). Thanh ghi x0 luôn được giữ bằng 0: mọi nhánh ghi kết quả đều kiểm tra `rd !== 0` trước khi ghi.

Để phục vụ mô hình truy cập bộ nhớ bất đồng bộ (mục 4.2.2), lõi xử lý còn mang một nhóm trường trạng thái chờ: `fetchWaiting`/`fetchPending` cho việc nạp lệnh, `waitingRequest`/`pendingResponse` cho yêu cầu dữ liệu đang chờ và phản hồi đã về, và `replayInstruction` lưu lệnh cần thực hiện lại. Việc xuất kết quả vào/ra của dịch vụ hệ thống được tách rời khỏi lõi xử lý qua ba hàm gọi lại có thể gắn từ bên ngoài: `onSyscallOutput`, `onSyscallExit`, `onSyscallError` (xem source: `src/js/cpu.js`).

Hình 4.3 minh họa tổ chức bên trong của lõi xử lý.

[Hình 4.3: Kiến trúc bên trong lõi xử lý RV32IMF. Khối lớn "CPU" chứa, từ trái sang phải, ba khối chức năng nối tiếp: "Fetch (readInstructionAsync)" → "Decode (giải mã opcode/funct3/funct7/imm)" → "Execute (theo nhóm I/M/F)". Phía dưới là hai tệp thanh ghi đặt cạnh nhau: "Integer Register File: Int32Array(32) x0–x31" và "FP Register File: Float32Array(32) f0–f31"; khối Execute có mũi tên đọc/ghi hai chiều tới cả hai tệp thanh ghi. Một ô "PC" và ô "instructionCount" nằm cạnh khối Fetch/Execute. Bên dưới CPU là khối trạng thái chờ "fetchWaiting/fetchPending · waitingRequest/pendingResponse · replayInstruction". Phía dưới cùng, một cổng "lowerPort" đi ra khỏi CPU bằng mũi tên xuống có nhãn "sendRequest (Get/Put/Arithmetic)" hướng tới khối ngoài "MMU → Cache → Bus"; chiều ngược lại là mũi tên lên có nhãn "receiveResponse (AccessAck/AccessAckData)". Bên phải, ba mũi tên đứt nét đi ra ngoài có nhãn "onSyscallOutput / onSyscallExit / onSyscallError" nối tới "Console/UART".] (xem source: `src/js/cpu.js`)

### 4.2.2. Chu trình nạp–giải mã–thực thi và truy cập bộ nhớ bất đồng bộ

Như đã nêu ở mục 3.3.1, mỗi chu kỳ mô phỏng tương ứng một lần gọi `tick` của lõi xử lý. Tuy nhiên, do lõi xử lý truy cập bộ nhớ qua bus với độ trễ nhiều chu kỳ, một lệnh có truy cập bộ nhớ không thể hoàn tất trong một chu kỳ. Hệ thống giải quyết điều này bằng một mô hình **yêu cầu – chờ – phản hồi – thực hiện lại** (request–wait–response–replay) được điều khiển bởi các trường trạng thái nêu ở mục 4.2.1.

Giải mã (`decode`) trích các trường `opcode`, `rd`, `funct3`, `rs1`, `rs2`, `funct7`, và với lệnh dấu phẩy động còn trích `rs3` và `fmt`. Việc nhận dạng tên lệnh được thực hiện bằng cách so khớp tổ hợp `opcode`/`funct3`/`funct7` (và các trường con như `rs2_subfield`, `fmt`) với một bảng định dạng nội bộ; sau đó immediate được tái tạo theo từng loại định dạng, kể cả việc mở rộng dấu cho các định dạng I/S/B/J (xem source: `src/js/cpu.js`).

Thực thi (`execute`) trả về địa chỉ lệnh kế tiếp. Với lệnh số học/logic và rẽ nhánh, lệnh hoàn tất ngay trong một chu kỳ. Với lệnh nạp/lưu và lệnh nguyên tử, hàm thực thi hoạt động theo hai pha trong hai lần gọi khác nhau:

- **Pha phát yêu cầu.** Khi chưa có yêu cầu nào đang chờ (`!waitingRequest && !pendingResponse`), lõi xử lý tính địa chỉ hiệu dụng, phát một yêu cầu xuống cổng dưới (ví dụ `Get` cho nạp, `PutFullData`/`PutPartialData` cho lưu), đặt `waitingRequest`, rồi trả về `nextPc = pc` để giữ nguyên bộ đếm chương trình.
- **Pha hoàn tất.** Khi phản hồi đã về (`pendingResponse` khác rỗng), lõi xử lý lấy dữ liệu, thực hiện mở rộng dấu/cắt byte theo loại lệnh (ví dụ `LB` mở rộng dấu 8 bit, `LBU` mở rộng số 0), ghi vào thanh ghi đích, xóa các cờ chờ và để bộ đếm chương trình tiến tới lệnh kế.

Hàm `tick` điều phối toàn bộ máy trạng thái này (xem source: `src/js/cpu.js`):

```
nếu (waitingRequest và chưa có pendingResponse) → dừng chu kỳ này (chờ phản hồi dữ liệu)
shouldReplay = (waitingRequest và pendingResponse và replayInstruction)
nếu (không replay):
    nếu (chưa phát fetch và chưa có fetchPending) → phát readInstructionAsync(pc); dừng
    nếu (chưa có fetchPending) → dừng (chờ phản hồi nạp lệnh)
inst = (replay ? replayInstruction : fetchPending)
decoded = decode(inst);  execute(decoded)
nếu (vẫn waitingRequest) → replayInstruction = {pc, inst}   // lệnh sẽ chạy lại
ngược lại → replayInstruction = null;  instructionCount++    // lệnh hoàn tất
cập nhật pc (nextPc nếu có, ngược lại pc += 4)
```

Phản hồi từ phía dưới được nhận qua `receiveResponse`: phản hồi của nạp lệnh được định tuyến vào `fetchPending`, các phản hồi còn lại vào `pendingResponse`. Nhờ mô hình này, một lệnh nạp dữ liệu có thể trải dài qua nhiều chu kỳ — phát yêu cầu ở chu kỳ N, dữ liệu lan qua MMU/cache/bus/bộ nhớ rồi quay về sau một số chu kỳ tương ứng độ trễ — trong khi bộ đếm chương trình bị "đóng băng" cho đến khi lệnh hoàn tất, đúng với mô hình tiến chu kỳ đã mô tả ở mục 3.3.1.

Hình 4.4 mô tả máy trạng thái truy cập bộ nhớ nói trên.

[Hình 4.4: Máy trạng thái truy cập bộ nhớ của lõi xử lý. Bốn trạng thái hình tròn/chữ nhật bo góc: "FETCH" (nạp lệnh), "DECODE/EXEC" (giải mã & thực thi), "WAIT" (chờ phản hồi dữ liệu), "REPLAY" (thực hiện lại lệnh). Cung chuyển: từ FETCH, khi có fetchPending → DECODE/EXEC. Tại DECODE/EXEC, nếu lệnh không truy cập bộ nhớ → nhánh "hoàn tất: instructionCount++, pc ← nextPc/pc+4" quay về FETCH cho lệnh kế. Nếu lệnh là load/store/atomic → phát yêu cầu (sendRequest), đặt waitingRequest, ghi replayInstruction, chuyển sang WAIT; nhãn cung "pc giữ nguyên (stall)". Tại WAIT, vòng tự lặp "chưa có pendingResponse → dừng chu kỳ"; khi receiveResponse đặt pendingResponse → chuyển sang REPLAY. Tại REPLAY, "decode lại cùng lệnh; pha hoàn tất: lấy dữ liệu, ghi rd, xóa waitingRequest/pendingResponse, instructionCount++" → quay về FETCH. Mũi tên ngoài có nhãn "receiveResponse(AccessAckData)" trỏ vào trạng thái WAIT→REPLAY.] (xem source: `src/js/cpu.js`)

### 4.2.3. Hiện thực các nhóm lệnh I/M/F

**Nhóm số nguyên cơ sở (I).** Các phép ALU được hiện thực bằng toán tử JavaScript trên số nguyên 32 bit có dấu, với toán tử `| 0` để ép kết quả về 32 bit có dấu sau mỗi phép tính (mô phỏng tràn vòng của số học 32 bit). Phép dịch dùng `<<`, `>>` (số học) và `>>>` (logic) với lượng dịch lấy 5 bit thấp; so sánh không dấu dùng `>>> 0` để diễn giải toán hạng như số không dấu. Các lệnh `lui`/`auipc` xử lý immediate 20 bit cao; rẽ nhánh và nhảy tính địa chỉ đích tương đối PC. Lệnh `ecall` chuyển sang xử lý dịch vụ hệ thống (mục 4.2.4); `ebreak` dừng lõi xử lý.

**Nhóm nhân/chia số nguyên (M).** Phép nhân thấp `mul` dùng `Math.imul` để lấy 32 bit thấp đúng theo ngữ nghĩa nhân 32 bit. Ba lệnh lấy phần cao `mulh`/`mulhsu`/`mulhu` được hiện thực bằng số nguyên lớn `BigInt`: tích 64 bit được tính rồi dịch phải 32 bit (`>> 32n`), với việc chuyển toán hạng sang miền có dấu hoặc không dấu phù hợp từng biến thể. Phép chia/lấy dư tuân theo đặc tả RISC-V [1] cho các trường hợp biên: chia cho 0 trả về toàn bit 1 (tức `−1`) cho `div`/`divu`, và trả về số bị chia cho `rem`/`remu`; trường hợp tràn `INT_MIN / (−1)` trả về `INT_MIN` cho `div` và `0` cho `rem` (xem source: `src/js/cpu.js`).

```
MULH:  (BigInt(rs1) * BigInt(rs2)) >> 32n            // có dấu × có dấu
DIV:   rs2 == 0 → −1;  rs1==INT_MIN && rs2==−1 → INT_MIN;  ngược lại ⌊rs1/rs2⌋
```

**Nhóm dấu phẩy động đơn (F).** Các phép số học cơ bản (`fadd.s`, `fsub.s`, `fmul.s`, `fdiv.s`) dùng trực tiếp toán tử số học JavaScript, kết quả tự được rút về độ chính xác đơn khi ghi vào `Float32Array`; phép chia cho 0 trả về `±∞` hoặc `NaN` theo dấu của tử số. Các lệnh nhân–cộng hợp nhất (`fmadd.s`, `fmsub.s`, `fnmsub.s`, `fnmadd.s`) tính theo công thức tương ứng. Các thao tác trên bit (dấu, di chuyển bit, phân loại) dùng `ArrayBuffer` + `DataView` để truy cập biểu diễn nhị phân 32 bit của số thực: nhóm `fsgnj.s`/`fsgnjn.s`/`fsgnjx.s` ghép bit dấu của toán hạng thứ hai vào phần độ lớn của toán hạng thứ nhất; `fmv.x.w`/`fmv.w.x` sao chép nguyên trạng 32 bit giữa thanh ghi số nguyên và thanh ghi dấu phẩy động. Lệnh phân loại `fclass.s` trả về một trong 10 lớp (mỗi lớp ứng một bit trong kết quả): `−∞`, số âm chuẩn, số âm dưới chuẩn, `−0`, `+0`, số dương dưới chuẩn, số dương chuẩn, `+∞`, NaN báo hiệu (signaling) và NaN im lặng (quiet), được xác định từ trường mũ và phần định trị của biểu diễn IEEE 754. Các lệnh so sánh `feq.s`/`flt.s`/`fle.s` trả về 0 khi có toán hạng là NaN; `fmin.s`/`fmax.s` xử lý NaN bằng cách trả về toán hạng không-NaN còn lại (xem source: `src/js/cpu.js`).

Các lệnh chuyển đổi `fcvt.w.s`/`fcvt.wu.s` (số thực → số nguyên) áp dụng chế độ làm tròn theo trường `rm`: chế độ làm tròn về số chẵn gần nhất (`rne`) dùng `Math.round` và chế độ làm tròn về 0 (`rtz`) dùng `Math.trunc`; các chế độ còn lại quy về `rne`. Kết quả còn được kẹp (saturate) vào dải số nguyên hợp lệ khi nguồn là NaN hoặc vượt biên. Chiều ngược lại `fcvt.s.w`/`fcvt.s.wu` chuyển số nguyên có dấu/không dấu sang số thực.

Cần nêu rõ các giới hạn của hiện thực dấu phẩy động, nhất quán với mục 1.3.2: hệ thống chưa hiện thực thanh ghi điều khiển/trạng thái dấu phẩy động (FCSR), các cờ ngoại lệ (fflags) và việc chọn chế độ làm tròn động (frm); việc làm tròn chỉ phân biệt hai chế độ `rne` và `rtz` (các chế độ khác quy về `rne`), và tính tương thích bit-exact với chuẩn IEEE 754 [10] ở mọi trường hợp biên chưa được kiểm chứng đầy đủ. Lệnh `amoadd.w` (cộng nguyên tử, thuộc mở rộng RV32A) cũng được hiện thực như một mở rộng minh họa nằm ngoài tên đề tài RV32IMF (xem source: `src/js/cpu.js`); cơ chế nguyên tử ở tầng bus được trình bày ở mục 4.4.

### 4.2.4. Xử lý dịch vụ hệ thống (syscall)

Lệnh `ecall` gọi tới `handleSyscall`, trong đó mã dịch vụ được lấy từ thanh ghi `a7` (x17) và các đối số từ `a0`–`a2` (x10–x12), theo quy ước tương thích với môi trường RARS [16]. Bảng 4.4 liệt kê các dịch vụ được hỗ trợ (xem source: `src/js/cpu.js`).

**Bảng 4.4. Các dịch vụ hệ thống được hỗ trợ (`a7` chọn dịch vụ)**

| `a7` | Dịch vụ | Đối số | Hành vi |
|---|---|---|---|
| 1 | In số nguyên | `a0` = giá trị | Xuất giá trị số nguyên ra console |
| 4 | In chuỗi | `a0` = địa chỉ chuỗi | Đọc chuỗi kết thúc null từ bộ nhớ và xuất ra console |
| 64 | Ghi ra mô tả tệp | `a0`=fd, `a1`=địa chỉ đệm, `a2`=số byte | Khi `fd`=1 (stdout): xuất `a2` byte ra console; trả số byte đã ghi vào `a0` |
| 93 | Kết thúc | `a0` = mã thoát | Dừng lõi xử lý, phát mã thoát qua `onSyscallExit` |
| 0 | Halt ngầm | — | Dừng lõi xử lý |
| 100 | MMU – ánh xạ trang | `a0`=VA, `a1`=PA, `a2`=cờ quyền | Gọi `mapPage` (bit 0=R, 1=W, 2=X, 3=cacheable) |
| 101 | MMU – hủy ánh xạ | `a0`=VA | Gọi `unmapPage` |
| 102 | MMU – xóa ánh xạ | — | Gọi `clearMappings` |

Các dịch vụ in/ghi không tác động trực tiếp lên giao diện mà phát chuỗi kết quả qua hàm gọi lại `onSyscallOutput`; lớp giao diện gắn hàm này để đưa kết quả vào khung console (mục 4.8). Ba dịch vụ 100/101/102 cho phép chương trình hợp ngữ điều khiển bảng ánh xạ của đơn vị quản lý bộ nhớ ngay trong lúc chạy: lõi xử lý truy cập đối tượng MMU qua tham chiếu `lowerPort.lower` và gọi các phương thức `mapPage`/`unmapPage`/`clearMappings` tương ứng (mục 4.3.2). Mã dịch vụ không hỗ trợ sẽ phát thông báo lỗi qua `onSyscallError` và dừng lõi xử lý (xem source: `src/js/cpu.js`, `src/js/javascript.js`).

## 4.3. Hệ thống bộ nhớ

Hệ thống bộ nhớ gồm ba lớp hiện thực độc lập: bộ nhớ chính, đơn vị quản lý bộ nhớ kèm TLB, và phân cấp bộ nhớ đệm. Các lớp này trao đổi qua giao diện yêu cầu/phản hồi thống nhất đã mô tả ở mục 3.3.2.

### 4.3.1. Bộ nhớ chính

Bộ nhớ chính được hiện thực trong lớp `Mem` (xem source: `src/js/mem.js`). Vùng lưu trữ là một đối tượng JavaScript ánh xạ địa chỉ byte sang giá trị byte (`mem = {}`), tức lưu trữ **thưa** (sparse): chỉ những byte thực sự được ghi mới tồn tại trong đối tượng, nhờ đó không gian địa chỉ 32 bit được mô phỏng mà không cần cấp phát toàn bộ. Hàm tiện ích `readSizedValue`/`writeSizedValue` đọc/ghi 1/2/4 byte theo thứ tự little-endian (xem source: `src/js/tilelink.js`).

Để biểu diễn chi phí truy cập bộ nhớ vật lý, `Mem` mang một độ trễ cấu hình được (`latency`); trong cấu hình SoC, độ trễ này được đặt bằng 20 chu kỳ (xem source: `src/js/soc.js`). Khi nhận một yêu cầu, bộ nhớ ghi nhận thời điểm sẵn sàng `readyCycle = cycle + latency`; mỗi `tick` chỉ phục vụ yêu cầu khi đã đủ độ trễ. Với yêu cầu kích thước lớn hơn 4 byte (yêu cầu lấp khối kiểu `fill` phục vụ refill của bộ nhớ đệm), bộ nhớ chuyển sang chế độ truyền chuỗi (burst): trả về dữ liệu theo từng "nhịp" (beat) 4 byte, mỗi nhịp cách nhau `burstBeatLatency` chu kỳ, kèm các trường `beatIndex`/`beatCount`/`lastBeat` để bên nhận ghép lại thành một dòng đầy đủ. Đáp ứng cho yêu cầu đọc là `AccessAckData` (kèm dữ liệu), cho yêu cầu ghi là `AccessAck`. Ngoài luồng tick, lớp `Mem` còn cung cấp `directRead`/`directWrite` cho các truy cập trực tiếp (phục vụ refill bộ nhớ đệm, cầu nối bus và các khung quan sát/gỡ lỗi) (xem source: `src/js/mem.js`).

### 4.3.2. Đơn vị quản lý bộ nhớ và TLB

Đơn vị quản lý bộ nhớ được hiện thực trong lớp `MMU` (xem source: `src/js/mmu.js`), nằm trên đường yêu cầu giữa lõi xử lý và bộ nhớ đệm. MMU không được cấp một bước tick riêng (mục 3.3.1): nó thực hiện dịch địa chỉ ngay trên đường yêu cầu đi xuống. Bảng 4.5 tóm tắt cấu hình MMU.

**Bảng 4.5. Cấu hình đơn vị quản lý bộ nhớ và TLB**

| Tham số | Giá trị mặc định | Tùy chọn cấu hình (UI) |
|---|---|---|
| Kích thước trang | 4096 byte | 1024 / 2048 / 4096 / 8192 |
| Số mục TLB | 8 | 4 / 8 / 16 / 32 |
| Số đường (way) TLB | 4 | 2 / 4 / liên kết đầy đủ (`fully`) |
| Số tập (set) TLB | 2 (= số mục / số đường) | (suy ra) |
| Chính sách thay thế TLB | LRU (theo `lastReference`) | — |
| Quyền truy cập mỗi trang | R / W / X | — |
| Thuộc tính lưu đệm | cacheable theo từng trang | — |
| Bảng trang | `Map` (phần mềm) | — |
| Lịch sử dịch địa chỉ | 32 mục gần nhất | — |

Bảng trang được biểu diễn bằng cấu trúc `Map` ánh xạ số trang ảo (VPN) sang một mục chứa địa chỉ nền vật lý cùng các quyền R/W/X và thuộc tính lưu đệm. TLB được hiện thực dạng tập–kết hợp (set-associative) với các khối vật lý cố định; chỉ số tập được tính bằng `VPN mod số_tập`, và khi một tập đầy thì khối ít được dùng gần nhất (LRU) bị thay thế. Quá trình dịch (`translateAddress`) diễn ra theo thứ tự: tra TLB trước; nếu trượt thì tra bảng trang phần mềm và nạp lại kết quả vào TLB; nếu trang chưa được ánh xạ thì áp dụng cơ chế **ánh xạ đồng nhất** (identity) trả về địa chỉ vật lý bằng địa chỉ ảo — nhờ vậy các chương trình bare-metal không thiết lập bảng trang vẫn chạy được. Phân loại quyền được suy từ loại thao tác bus: nạp lệnh kiểm tra quyền thực thi (X), tải kiểm tra quyền đọc (R), lưu và thao tác nguyên tử kiểm tra quyền ghi (W); vi phạm quyền ném lỗi và được ghi nhận vào thống kê. Thuộc tính lưu đệm của mỗi truy cập được xác định kết hợp giữa quyền lưu đệm của trang và một vị từ `cacheabilityPredicate` do SoC cung cấp (đánh dấu các vùng MMIO và vùng thanh ghi DMA là không lưu đệm) (xem source: `src/js/mmu.js`, `src/js/soc.js`).

MMU thu thập thống kê chi tiết (số lần dịch, trúng/trượt TLB, trúng bảng trang, số lần dùng ánh xạ đồng nhất, số lần nạp lại/đuổi TLB, số lỗi quyền theo từng loại) và lưu lịch sử 32 lần dịch gần nhất; cả hai phục vụ khung quan sát MMU trên giao diện. Sau khi dịch, MMU chuyển tiếp yêu cầu xuống cổng dưới với địa chỉ đã thành địa chỉ vật lý, đồng thời đính kèm địa chỉ ảo gốc để đường phản hồi trả về đúng địa chỉ mà lõi xử lý chờ. Vì MMU phục vụ hai luồng tách biệt (nạp lệnh và truy cập dữ liệu), nó giữ hai cổng dưới riêng (`instructionLowerPort`, `dataLowerPort`) tương ứng L1I và L1D (mục 3.3.2). Các tham số cấu hình (kích thước trang, kích thước/độ kết hợp TLB) được đọc từ `localStorage` của trình duyệt, cho phép thay đổi qua giao diện (xem source: `src/js/mmu.js`, `src/js/soc.js`).

Hình 4.5 minh họa cấu trúc MMU và đường dịch địa chỉ.

[Hình 4.5: Cấu trúc MMU và đường dịch địa chỉ. Bên trái là yêu cầu vào "VA (địa chỉ ảo)" được tách thành "VPN" (số trang) và "offset". VPN đi vào khối "TLB (tập–kết hợp 2 tập × 4 đường, LRU)": nút quyết định "TLB hit?": CÓ → lấy địa chỉ nền vật lý từ khối TLB; KHÔNG → đi xuống khối "Bảng trang (Map<VPN, entry>)": nút quyết định "có ánh xạ?": CÓ → nạp lại mục vào TLB rồi lấy nền vật lý; KHÔNG → khối "Ánh xạ đồng nhất (PA = VA)". Sau khi có nền vật lý, một khối "Kiểm tra quyền R/W/X" (theo loại thao tác: fetch→X, load→R, store/atomic→W) — nếu vi phạm thì rẽ sang "Lỗi quyền (ghi thống kê)". Nhánh hợp lệ ghép "nền vật lý + offset" thành "PA (địa chỉ vật lý)" kèm cờ "cacheable" (từ quyền trang ∧ cacheabilityPredicate), rồi đi ra cổng dưới (L1I cho lệnh / L1D cho dữ liệu). Bên phải có khối phụ "Thống kê & lịch sử (32 mục)" nhận tín hiệu từ quá trình dịch.] (xem source: `src/js/mmu.js`)

### 4.3.3. Phân cấp bộ nhớ đệm L1I/L1D/L2

Cả ba bộ nhớ đệm dùng chung một hiện thực trong lớp `SimpleCache`, chỉ khác nhau về tham số cấu hình (xem source: `src/js/SimpleCache.js`, `src/js/soc.js`). Bảng 4.6 trình bày cấu hình ba bộ nhớ đệm; lưu ý các giá trị độ trễ là số chu kỳ dùng để biểu diễn tương quan chi phí truy cập giữa các cấp [12], không phải số liệu định thời vật lý (mục 1.3.2).

**Bảng 4.6. Cấu hình bộ nhớ đệm L1I/L1D/L2**

| Tham số | L1I | L1D | L2 |
|---|---|---|---|
| Số tập (set) | 16 | 16 | 64 |
| Số đường (way) | 4 | 4 | 4 |
| Kích thước khối (block) | 64 byte | 64 byte | 64 byte |
| Dung lượng | 4 KB | 4 KB | 16 KB |
| Độ trễ khi trúng (hit) | 1 chu kỳ | 1 chu kỳ | 2 chu kỳ |
| Độ trễ khi trượt (miss) | 5 chu kỳ | 5 chu kỳ | 10 chu kỳ |
| Chính sách ghi | write-through | write-through | write-through |
| Chính sách thay thế | LRU | LRU | LRU |

Địa chỉ vật lý được phân rã thành ba phần theo cách quy ước: các bit thấp là độ dịch trong khối (offset, 6 bit với khối 64 byte), kế đến là chỉ số tập (4 bit với 16 tập của L1, 6 bit với 64 tập của L2), phần còn lại là thẻ (tag). Mỗi khối lưu cờ hợp lệ, cờ đã sửa đổi, thẻ, mốc tham chiếu LRU và một mảng byte dữ liệu. Khi nhận yêu cầu, nếu vùng địa chỉ không lưu đệm (vị từ `isCacheable` trả về sai, ví dụ vùng MMIO) hoặc bộ nhớ đệm bị tắt, yêu cầu được **chuyển thẳng** (bypass) xuống cấp dưới; ngược lại, bộ nhớ đệm tra khối theo tập và thẻ: nếu trúng thì phục vụ ngay với độ trễ trúng; nếu trượt thì chọn khối nạn nhân (LRU) và khởi động quá trình nạp lại (refill) (xem source: `src/js/SimpleCache.js`).

Quá trình nạp lại được hiện thực bất đồng bộ qua các trạng thái `pendingFill`/`pendingResponse`/`pendingBurstResponse` và tiến triển theo từng `tick`: bộ nhớ đệm phát một yêu cầu lấp khối xuống cấp dưới và nhận dữ liệu về theo từng nhịp 4 byte cho đến khi đủ một dòng khối (với khối 64 byte là 16 nhịp), rồi mới đánh dấu khối hợp lệ và phục vụ yêu cầu gốc. Chính sách ghi là **write-through** [11]: mỗi lần ghi trúng vừa cập nhật khối trong bộ nhớ đệm vừa ghi xuyên xuống cấp dưới; thao tác nguyên tử được phục vụ theo kiểu đọc–sửa–ghi tại chỗ rồi ghi xuyên xuống dưới. Bộ nhớ đệm thu thập thống kê số lần đọc/ghi, số lần trúng/trượt và tổng số chu kỳ, phục vụ khung quan sát Cache và việc đánh giá hiệu năng ở Chương 5 (xem source: `src/js/SimpleCache.js`).

Hình 4.6 minh họa phân cấp bộ nhớ đệm trong hệ thống.

[Hình 4.6: Phân cấp bộ nhớ đệm trong SoC. Từ trên xuống: khối "MMU" có hai mũi tên xuống tới hai khối song song "L1I (16×4×64B, hit 1/miss 5)" và "L1D (16×4×64B, hit 1/miss 5)". Cả hai khối L1 có mũi tên xuống tới khối chung "L2 (64×4×64B, hit 2/miss 10)". L2 có mũi tên xuống tới "TileLink-UH → Main Memory (latency 20)". Bên cạnh mỗi mũi tên giữa các cấp ghi nhãn "refill: 16 nhịp × 4B" cho chiều dữ liệu lên và "write-through" cho chiều ghi xuống. Một chú thích bên phải: "Vùng MMIO/không lưu đệm: bỏ qua cache (bypass) thẳng xuống bus". Mỗi khối cache có nhãn nhỏ "LRU, write-through" và ô "thống kê hit/miss".] (xem source: `src/js/SimpleCache.js`, `src/js/soc.js`)

## 4.4. Hệ thống bus TileLink

Hệ thống kết nối được hiện thực thành bốn lớp: một lõi định nghĩa dùng chung, một lớp cơ sở chứa logic định tuyến và hàng đợi, hai phân hệ bus UH/UL kế thừa lớp cơ sở, và cầu nối giữa hai bus. Phần lý thuyết giao thức TileLink đã trình bày ở mục 2.6; ở đây trình bày hiện thực bên trong.

### 4.4.1. Lõi giao thức: mã thao tác, mặt nạ và ảnh chụp kênh

Lõi giao thức (xem source: `src/js/tilelink.js`) định nghĩa mã thao tác kênh A (`TL_A_Opcode`: `PutFullData`=0, `PutPartialData`=1, `ArithmeticData`=2, `LogicalData`=3, `Get`=4, `Intent`=5) và kênh D (`TL_D_Opcode`: `AccessAck`=0, `AccessAckData`=1, `HintAck`=2, …), cùng các tham số cho thao tác số học/logic (`TL_Param_Arithmetic`, `TL_Param_Logical`). Hàm `computeTileLinkMask` sinh mặt nạ byte (byte lane mask) theo địa chỉ và kích thước truyền: 4 bit cho một từ 4 byte, hoặc một/hai bit cho truy cập byte/nửa từ tùy theo vị trí trong từ. Một nhóm hàm trợ giúp phân loại thao tác (đọc/ghi/nguyên tử), đọc/ghi giá trị theo kích thước, và áp dụng phép nguyên tử (`applyTileLinkAtomic` cho các phép cộng/min/max/and/or/xor/swap). Hai hàm `snapshotAChannel`/`snapshotDChannel` tạo ảnh chụp tức thời của hai kênh A/D dưới dạng tập tín hiệu (valid, opcode, param, size, source, address, mask, data…), phục vụ việc trực quan hóa giao dịch trên sơ đồ SoC (mục 4.7) (xem source: `src/js/tilelink.js`).

Cần nhấn mạnh, nhất quán với mục 1.3.2 và 2.6: hệ thống chỉ hiện thực mô hình giao dịch trên hai kênh A (yêu cầu) và D (phản hồi); không hiện thực các kênh B/C/E cùng cơ chế bảo đảm nhất quán bộ nhớ đệm của TileLink-C [2].

Hình 4.7 minh họa cấu trúc một giao dịch trên hai kênh A và D.

[Hình 4.7: Cấu trúc một giao dịch kênh A → kênh D. Phía trên là một "khung kênh A" (thành phần chủ động phát ra) gồm các ô trường nối tiếp: `opcode` (ví dụ Get/PutFullData/ArithmeticData), `param`, `size`, `source` (tên master), `address`, `mask` (4 bit), `data`. Mũi tên ngang sang phải có nhãn "định tuyến theo địa chỉ tới slave". Phía dưới là "khung kênh D" (thành phần bị động trả về) gồm: `opcode` (AccessAck / AccessAckData), `size`, `source` (đích = tên master), `data` (chỉ có với AccessAckData), `denied`. Mũi tên cong từ kênh D quay ngược về master. Ghi chú: "Chỉ hai kênh A/D — không có B/C/E".] (xem source: `src/js/tilelink.js`)

### 4.4.2. Định tuyến master/slave và mô hình giao dịch

Lớp cơ sở `TileLinkBase` chứa logic chung của hai bus (xem source: `src/js/tilelink_base.js`). Mỗi bus giữ: một hàng đợi yêu cầu (`requestQueue`), một giao dịch đang xử lý (`inFlight`), một hàng đợi phản hồi (`responseQueue`), một sổ đăng ký master (`masters`, ánh xạ tên sang thành phần chủ động) và một danh sách slave (`slaves`, mỗi mục gồm tên, thành phần đích và một hàm phán đoán địa chỉ `match`). Mỗi `tick` của bus xử lý **một giao dịch tại một thời điểm**: nếu chưa có giao dịch nào đang xử lý và hàng đợi yêu cầu không rỗng, bus lấy yêu cầu kế tiếp, kiểm tra tính hợp lệ của mã thao tác đối với phân hệ bus, chọn slave bằng cách tìm mục đầu tiên có `match(địa chỉ)` đúng, rồi chuyển yêu cầu tới slave đó; ở chiều phản hồi, bus lấy một phản hồi từ hàng đợi và định tuyến về đúng master theo tên đích. Giao dịch được coi là kết thúc khi phản hồi cuối cùng (`lastBeat`) đã được trả, khi đó `inFlight` được giải phóng cho giao dịch kế tiếp (xem source: `src/js/tilelink_base.js`).

Lớp cơ sở còn cung cấp các hàm truy cập trực tiếp `directRead`/`directWrite` (chọn slave theo địa chỉ rồi đọc/ghi thẳng vào đích, dùng cho refill bộ nhớ đệm và cầu nối) cùng `peek`/`poke` (truy cập phục vụ gỡ lỗi không đếm là giao dịch). Một móc nối `onTraceTransaction` được gọi tại mỗi yêu cầu/phản hồi/truy cập trực tiếp để lớp trực quan hóa ghi nhận dấu vết giao dịch (mục 4.7).

Về tính "đa master": hệ thống có hai thành phần cùng đăng ký làm master và cùng phát yêu cầu là lõi xử lý (qua đường L2 → TileLink-UH) và bộ điều khiển DMA. Tuy nhiên, đúng như đã nêu ở mục 1.3.2 và 3.2.1, cơ chế điều phối hiện được mô hình hóa ở mức **hàng đợi yêu cầu với một giao dịch được xử lý tại một thời điểm**, chưa phải là một cơ chế phân xử (arbitration) đa master đầy đủ; báo cáo trình bày đặc điểm này một cách trung thực (xem source: `src/js/tilelink_base.js`).

Hình 4.8 minh họa cấu trúc bus và mô hình giao dịch.

[Hình 4.8: Cấu trúc bus/TileLink và mô hình giao dịch. Trung tâm là khối "TileLinkBase" chứa ba thành phần xếp dọc: "requestQueue (hàng đợi yêu cầu)", ô đơn "inFlight (1 giao dịch)", "responseQueue (hàng đợi phản hồi)". Phía trên khối là vùng "Sổ đăng ký master" với hai mục "CPU (qua L2)" và "DMA", mỗi mục có mũi tên xuống "sendRequest → requestQueue". Bên trong, mũi tên từ requestQueue → inFlight có nhãn "kiểm tra opcode hợp lệ"; từ inFlight có mũi tên "match(address)" rẽ tới đúng một trong các slave ở "Danh sách slave" phía dưới: "Main Memory", "DMA Regs", "Bridge→UL" (với UH) — mỗi slave kèm điều kiện địa chỉ. Chiều phản hồi: slave → responseQueue → mũi tên "định tuyến theo tên đích" quay về đúng master phía trên. Một móc "onTraceTransaction" vẽ bằng đường đứt nét đi ra tới khối "Trực quan hóa". Ghi chú nhấn mạnh: "một giao dịch in-flight tại một thời điểm".] (xem source: `src/js/tilelink_base.js`)

### 4.4.3. Hai phân hệ bus TileLink-UH và TileLink-UL

Hai phân hệ bus kế thừa `TileLinkBase` và chỉ khác nhau ở tập mã thao tác được phép. TileLink-UH (xem source: `src/js/tilelink_UH.js`) cho phép đủ sáu mã thao tác kênh A, kể cả thao tác số học và logic nguyên tử, phục vụ truy cập bộ nhớ chính, thanh ghi DMA và cầu nối; TileLink-UL (xem source: `src/js/tilelink_UL.js`) chỉ cho phép bốn mã thao tác (đọc/ghi và lệnh gợi ý), phù hợp với các thiết bị ngoại vi đơn giản. Bảng 4.7 đối chiếu hai tập mã thao tác. Việc kiểm tra được thực hiện trong `_validateRequest` của lớp cơ sở: yêu cầu dùng mã thao tác không nằm trong tập cho phép của phân hệ bus sẽ bị từ chối kèm thông báo lỗi.

**Bảng 4.7. Mã thao tác kênh A được phép trên TileLink-UH và TileLink-UL**

| Mã thao tác kênh A | TileLink-UH | TileLink-UL |
|---|:---:|:---:|
| `PutFullData` (ghi đầy đủ) | ✔ | ✔ |
| `PutPartialData` (ghi một phần) | ✔ | ✔ |
| `Get` (đọc) | ✔ | ✔ |
| `Intent` (gợi ý) | ✔ | ✔ |
| `ArithmeticData` (nguyên tử số học) | ✔ | — |
| `LogicalData` (nguyên tử logic) | ✔ | — |

Cần lưu ý về nhãn hiển thị trên giao diện: bus UH được dán nhãn "Coherent Bus (High-Speed)" và bus UL được dán nhãn "Low-Speed/MMIO" trong khung sơ đồ (xem source: `src/index.html`). Tuy nhiên, như đã phân tích ở mục 2.6 và 3.2.1, đây là mô hình ở mức giao dịch trên hai kênh A/D, không phải bus có nhất quán bộ nhớ đệm theo nghĩa đầy đủ của TileLink-C [2]; trong báo cáo, UH được hiểu là bus hiệu năng cao (cho phép nguyên tử và truyền chuỗi) và UL là bus nhẹ cho ngoại vi.

### 4.4.4. Cầu nối UH↔UL

Cầu nối được hiện thực trong lớp `TileLinkBridge` (xem source: `src/js/tilelink_bridge.js`). Mỗi cầu nối có một bus thượng nguồn và một bus hạ nguồn; SoC tạo hai cầu nối một chiều ghép lại: một cầu UH→UL (để giao dịch từ phía bộ nhớ/lõi xử lý tới được ngoại vi) và một cầu UL→UH (để DMA trên bus UL truy cập được bộ nhớ chính). Cầu nối được đăng ký như một slave trên bus thượng nguồn: khi nhận một yêu cầu, nó **không** đẩy lại vào hàng đợi của bus hạ nguồn mà gọi trực tiếp `directRead`/`directWrite` của bus hạ nguồn để hoàn tất giao dịch ngay, rồi sinh phản hồi tương ứng (`AccessAckData` cho đọc, `AccessAck` cho ghi) trả về bus thượng nguồn. Với yêu cầu nguyên tử, cầu nối thực hiện đọc–sửa–ghi (read-modify-write) bằng cách đọc giá trị hiện tại từ bus hạ nguồn, áp dụng phép nguyên tử rồi ghi lại (xem source: `src/js/tilelink_bridge.js`).

Hình 4.9 minh họa luồng giao dịch qua cầu nối.

[Hình 4.9: Luồng giao dịch qua cầu nối UH↔UL. Bên trái là "TileLink-UH", bên phải là "TileLink-UL", ở giữa là hai khối cầu nối xếp dọc: "Bridge UH→UL" và "Bridge UL→UH". Ví dụ luồng UH→UL: mũi tên từ UH (yêu cầu tới một địa chỉ ngoại vi) vào "Bridge UH→UL"; bên trong khối ghi các bước: "receiveRequest" → nút quyết định loại thao tác: "Đọc → directRead(UL)", "Ghi → directWrite(UL)", "Nguyên tử → directRead → applyAtomic → directWrite(UL)"; → "sinh phản hồi (AccessAck/AccessAckData)"; mũi tên phản hồi quay về UH. Khối "Bridge UL→UH" có luồng đối xứng (DMA trên UL truy cập Main Memory trên UH). Ghi chú: "Cầu nối là slave trên bus thượng nguồn, truy cập trực tiếp bus hạ nguồn".] (xem source: `src/js/tilelink_bridge.js`)

## 4.5. Bộ điều khiển DMA

Bộ điều khiển truy cập bộ nhớ trực tiếp được hiện thực bằng ba lớp phối hợp: `DMADescriptor` (mô tả truyền), `DMARegisters` (mô hình thanh ghi và hàng đợi mô tả), và `DMAController` (máy trạng thái truyền) (xem source: `src/js/dma.js`).

**Mô tả truyền.** Một `DMADescriptor` gồm ba từ 32 bit: địa chỉ nguồn (`sourceAddr`), địa chỉ đích (`destAddr`) và từ cấu hình (`configWord`). Từ cấu hình đóng gói nhiều trường: số phần tử cần truyền `numElements` (24 bit thấp), cờ đảo byte `bswap` (bit 27), chế độ địa chỉ nguồn `srcMode` (bit 28–29) và chế độ địa chỉ đích `dstMode` (bit 30–31). Mỗi chế độ địa chỉ vừa quy định cách tiến địa chỉ vừa quy định kích thước phần tử: chế độ 0 (địa chỉ cố định, phần tử 1 byte), chế độ 1 (cố định, 4 byte), chế độ 2 (tăng dần theo byte, phần tử 1 byte), chế độ 3 (tăng dần theo từ, phần tử 4 byte) (xem source: `src/js/dma.js`).

**Bản đồ thanh ghi.** Bộ điều khiển trình diện hai thanh ghi ánh xạ bộ nhớ trong vùng `0xFFED0000`: thanh ghi điều khiển/trạng thái CTRL tại `0xFFED0000` và thanh ghi nạp mô tả DESC tại `0xFFED0004`. Bảng 4.8 trình bày bố cục bit. Ghi đủ ba từ liên tiếp vào DESC sẽ ghép thành một mô tả và đẩy vào hàng đợi mô tả (FIFO) sâu 8 mục; ghi CTRL với bit cho phép và bit khởi động sẽ kích hoạt truyền (xem source: `src/js/dma.js`).

**Bảng 4.8. Bản đồ thanh ghi DMA**

| Thanh ghi | Offset | Bit | Ý nghĩa |
|---|---|---|---|
| CTRL (đọc) | `0xFFED0000` | 0 | đã cho phép (enabled) |
| | | 1 | đã yêu cầu khởi động (start requested) |
| | | 2 | hoàn tất (done) |
| | | 19:16 | log2(độ sâu FIFO) |
| | | 27 | FIFO rỗng |
| | | 28 | FIFO đầy |
| | | 29 | lỗi (error) |
| | | 30 | hoàn tất (done) |
| | | 31 | đang bận (busy) |
| CTRL (ghi) | `0xFFED0000` | 0 | cho phép/tắt (tắt sẽ reset) |
| | | 1 | khởi động truyền |
| | | 27 | xác nhận và xóa cờ done/error |
| DESC (ghi) | `0xFFED0004` | 31:0 | một từ mô tả (ghi đủ 3 từ → một mô tả vào FIFO) |

**Máy trạng thái truyền.** Mỗi `tick`, nếu điều kiện khởi động thỏa (đã cho phép, không bận, FIFO không rỗng, đã yêu cầu khởi động), bộ điều khiển lấy mô tả kế tiếp khỏi FIFO, giải mã cấu hình và chuyển sang trạng thái bận. Việc truyền diễn ra theo **từng phần tử** với hai pha đọc và ghi, mỗi pha là một giao dịch bất đồng bộ trên bus (tương tự mô hình của lõi xử lý ở mục 4.2.2): với mỗi phần tử, bộ điều khiển tính địa chỉ nguồn/đích theo chế độ địa chỉ và chốt lại (`latch`); pha đọc phát một `Get` tới địa chỉ nguồn rồi chờ phản hồi, chốt dữ liệu nhận được (có đảo byte nếu cờ `bswap` bật); pha ghi phát một `Put` ghi dữ liệu đã chốt tới địa chỉ đích rồi chờ xác nhận, sau đó tăng tiến độ. Khi đã truyền đủ số phần tử, bộ điều khiển đặt cờ `done`, hạ cờ `busy` và gọi hàm gọi lại nếu có (xem source: `src/js/dma.js`).

Một điểm thiết kế đáng nêu là DMA là master trên **cả hai** phân hệ bus: với mỗi địa chỉ, một hàm chọn bus (`selectLinkForAddress`) định tuyến giao dịch sang TileLink-UL nếu địa chỉ thuộc vùng ngoại vi, ngược lại sang TileLink-UH (cho bộ nhớ chính). Nhờ vậy, một lần truyền có thể di chuyển dữ liệu giữa bộ nhớ chính (trên UH) và một thiết bị ngoại vi như ma trận LED (trên UL). Việc đọc/ghi thanh ghi điều khiển của DMA lại đến từ phía bus UH (DMA là slave trên UH cho vùng `0xFFED0000`); yêu cầu này được hoãn lại (`pendingRegReq`) và phục vụ trong `tick` kế tiếp để trả phản hồi đúng cơ chế bus (xem source: `src/js/dma.js`, `src/js/soc.js`).

Đúng như giới hạn đã nêu ở mục 1.3.2, bộ điều khiển DMA không phát tín hiệu ngắt tới lõi xử lý; chương trình nhận biết hoàn tất truyền bằng cách **đọc thăm dò** (polling) bit `done`/`busy` của thanh ghi CTRL (xem source: `src/js/dma.js`).

Hình 4.10 mô tả quy trình truyền của bộ điều khiển DMA.

[Hình 4.10: Quy trình truyền của bộ điều khiển DMA. Bắt đầu từ "Ghi 3 từ vào DESC (0xFFED0004)" → "Ghép thành DMADescriptor" → "Đẩy vào FIFO (sâu 8)". Song song, "Ghi CTRL (0xFFED0000) bit enable + bit start" → nút quyết định "canStartTransfer? (enabled ∧ !busy ∧ !FIFO rỗng ∧ start)": CÓ → "Lấy mô tả khỏi FIFO; giải mã configWord (numElements, bswap, srcMode, dstMode); busy=1". Vòng lặp theo từng phần tử: "Tính & chốt địa chỉ nguồn/đích theo chế độ" → "Pha ĐỌC: phát Get tới nguồn → chờ → chốt dữ liệu (đảo byte nếu bswap)" → "Pha GHI: phát Put tới đích → chờ xác nhận" → "tiến độ += 1" → nút quyết định "đã đủ numElements?": CHƯA → quay lại tính địa chỉ phần tử kế; RỒI → "done=1, busy=0". Hai chú thích bên: (1) "Chọn bus theo địa chỉ: UH cho RAM, UL cho ngoại vi"; (2) "Hoàn tất nhận biết bằng polling (chưa có IRQ)". Mỗi pha ĐỌC/GHI có nhãn nhỏ "giao dịch bất đồng bộ trên bus (waitingRequest/pendingResponse)".] (xem source: `src/js/dma.js`, `src/js/soc.js`)

## 4.6. Hệ thống ngoại vi và MMIO

### 4.6.1. Tổng quan kiến trúc ngoại vi

Hệ thống có bốn thiết bị ngoại vi gắn vào TileLink-UL: UART, ma trận LED, bàn phím và chuột. Mỗi thiết bị được trình diện trên bus qua một **endpoint MMIO** tạo bởi hàm `createMMIOEndpoint` (xem source: `src/js/soc.js`): endpoint này nhận yêu cầu bus, gọi hàm đọc/ghi tương ứng của thiết bị, rồi trả phản hồi `AccessAckData`/`AccessAck`. Cách bố trí này tách bạch logic thiết bị (trong từng mô-đun ngoại vi) khỏi việc đấu nối bus. Bảng 4.9 liệt kê bốn thiết bị ngoại vi cùng vùng địa chỉ; để tham chiếu đầy đủ, vùng thanh ghi DMA cũng được liệt kê dù DMA không phải thiết bị ngoại vi theo nghĩa thông thường.

**Bảng 4.9. Danh sách thiết bị ngoại vi và vùng địa chỉ**

| Thiết bị | Địa chỉ nền | Kích thước | Bus | Mô tả ngắn |
|---|---|---|---|---|
| UART | `0x10000000` | 20 byte (`0x14`) | TileLink-UL | Giao tiếp nối tiếp dạng console (TX/RX/STATUS/CTRL/BAUD) |
| Ma trận LED | `0xFF000000` | 4096 byte (32×32×4) | TileLink-UL | Hiển thị lưới 32×32 điểm ảnh từ VRAM |
| Chuột | `0xFF100000` | 20 byte (`0x14`) | TileLink-UL | Tọa độ con trỏ và trạng thái nút |
| Bàn phím | `0xFFFF0000` | 8 byte (`0x08`) | TileLink-UL | Bộ đệm ký tự nhập (đọc thăm dò) |
| *(Thanh ghi DMA)* | `0xFFED0000` | 8 byte (`0x08`) | TileLink-UH | CTRL/DESC của bộ điều khiển DMA (mục 4.5) |

Lớp giao diện nối các sự kiện đầu vào của trình duyệt vào thiết bị tương ứng: sự kiện gõ phím được chuyển thành mã ký tự đưa vào bộ đệm bàn phím; sự kiện con trỏ trên vùng canvas LED được chuyển thành tọa độ/nút cho thiết bị chuột; và kết quả truyền của UART được hiển thị ra khung console (xem source: `src/js/soc.js`, `src/js/javascript.js`).

Hình 4.11 minh họa kiến trúc ngoại vi và các đường sự kiện từ giao diện.

[Hình 4.11: Kiến trúc hệ thống ngoại vi và đường sự kiện từ giao diện. Trung tâm là khối bus ngang "TileLink-UL". Từ bus tỏa xuống bốn khối ngoại vi: "UART (0x10000000)", "LED Matrix (0xFF000000)", "Mouse (0xFF100000)", "Keyboard (0xFFFF0000)", mỗi khối nối với bus qua một ô nhỏ "MMIO endpoint (createMMIOEndpoint)". Phía trên bus UL, một mũi tên hai chiều "Bridge ↔ TileLink-UH" thể hiện UL nối lên bus UH. Bên phải là một cột "Giao diện web (sự kiện trình duyệt)" với ba mũi tên đứt nét đi vào các ngoại vi: "keydown → keyboard.pressKey()" tới Keyboard; "pointer trên canvas → mouse.reportEvent()" tới Mouse; và một mũi tên đứt nét đi ra từ UART "uart.onTransmit → khung Console" tới ô "Console UART". Ghi nhãn ở mỗi đường nối bus: "0x00RRGGBB" cho LED, "TX/RX/STATUS/CTRL/BAUD" cho UART, "CTRL/DATA" cho Keyboard, "X/Y/BTN/STATUS/CTRL" cho Mouse.] (xem source: `src/js/soc.js`, `src/js/javascript.js`)

### 4.6.2. UART

Thiết bị UART (xem source: `src/js/uart.js`) trình diện năm thanh ghi trong vùng 20 byte kể từ địa chỉ nền `0x10000000`. Bảng 4.10 trình bày bản đồ thanh ghi.

**Bảng 4.10. Bản đồ thanh ghi UART**

| Thanh ghi | Offset | Quyền | Ý nghĩa |
|---|---|---|---|
| TX | `0x00` | Ghi | Ghi một ký tự để truyền đi |
| RX | `0x04` | Đọc | Đọc và tiêu thụ một ký tự từ bộ đệm nhận |
| STATUS | `0x08` | Đọc | Bit 0: TX sẵn sàng; bit 1: RX có dữ liệu; bit 2: cho phép ngắt TX; bit 3: cho phép ngắt RX |
| CTRL | `0x0C` | Đọc/Ghi | Bit 0: cho phép ngắt TX; bit 1: cho phép ngắt RX |
| BAUD | `0x10` | Đọc/Ghi | Hệ số chia (divisor) tốc độ truyền |

Việc truyền được mô hình hóa có tính tới tốc độ baud: thanh ghi BAUD lưu hệ số chia, và tốc độ baud được tính bằng `tần_số_ngoại_vi / (lấy_mẫu_vượt × hệ_số_chia)`, với tần số ngoại vi 48 MHz và hệ số lấy mẫu vượt (oversampling) 16 — hệ số chia mặc định 26 cho tốc độ xấp xỉ 115200 baud. Khi chương trình ghi một ký tự vào TX, thiết bị đặt cờ TX-bận và tính số chu kỳ cần để truyền xong một khung (mười bit: một bit start, tám bit dữ liệu, một bit stop) dựa trên tần số CPU 100 MHz; cờ TX-sẵn-sàng chỉ được dựng lại sau khi đếm hết số chu kỳ này trong các lần `tick`. Nhờ đó, mô hình phản ánh được việc UART không thể truyền tức thời mà tốn thời gian tỉ lệ nghịch với tốc độ baud (xem source: `src/js/uart.js`). Các bit cho phép ngắt trong thanh ghi CTRL/STATUS hiện chỉ tồn tại ở mức cờ trạng thái; hệ thống chưa có đường ngắt thực sự tới lõi xử lý (mục 1.3.2), nên chương trình giao tiếp UART theo cơ chế đọc thăm dò thanh ghi STATUS.

### 4.6.3. Ma trận LED

Ma trận LED (xem source: `src/js/led_matrix.js`) mô phỏng một bảng 32×32 điểm ảnh với bộ nhớ hiển thị riêng (VRAM) là một mảng `Uint32Array` 1024 phần tử, ánh xạ vào vùng 4096 byte kể từ địa chỉ nền `0xFF000000`. Mỗi điểm ảnh chiếm 4 byte và lưu màu theo định dạng `0x00RRGGBB`. Khi nhận một thao tác ghi từ (`writeWord`), thiết bị chuẩn hóa địa chỉ về dạng không dấu, tính độ dịch so với địa chỉ nền, suy ra chỉ số điểm ảnh `pixelIndex = offset / 4`, rồi từ đó tính tọa độ `x = pixelIndex mod 32` và `y = ⌊pixelIndex / 32⌋`; giá trị màu được tách thành ba thành phần R/G/B và vẽ lên phần tử `canvas`. Để hiệu quả, thiết bị chỉ vẽ lại đúng điểm ảnh vừa thay đổi (cập nhật từng phần) thay vì vẽ lại toàn bộ; điểm ảnh sáng được vẽ kèm hiệu ứng phát sáng (glow) qua thuộc tính bóng đổ của canvas (xem source: `src/js/led_matrix.js`).

Hình 4.12 minh họa ánh xạ giữa VRAM và điểm ảnh.

[Hình 4.12: Ánh xạ VRAM sang điểm ảnh LED. Bên trái là một dải bộ nhớ tuyến tính bắt đầu tại `0xFF000000`, chia thành các ô 4 byte, ô thứ k chứa giá trị màu `0x00RRGGBB`. Một mũi tên có nhãn "pixelIndex = (addr − 0xFF000000) / 4" trỏ từ ô bộ nhớ sang lưới 2D 32×32 bên phải. Trên lưới, một công thức ghi "x = pixelIndex mod 32; y = ⌊pixelIndex / 32⌋" và một ô (x, y) được tô sáng tương ứng với ô bộ nhớ nguồn. Bên cạnh ô màu có chú thích tách thành phần "R = bit23..16, G = bit15..8, B = bit7..0". Khung lưới được vẽ trên nền canvas, với ô sáng có quầng glow.] (xem source: `src/js/led_matrix.js`)

### 4.6.4. Bàn phím và chuột

Thiết bị bàn phím (xem source: `src/js/keyboard.js`) tuân theo quy ước MMIO của môi trường RARS [16], trình diện hai thanh ghi chỉ-đọc trong vùng 8 byte kể từ `0xFFFF0000`: thanh ghi điều khiển CTRL tại offset `0x00` (bit 0 báo "có dữ liệu", bằng 1 khi bộ đệm không rỗng) và thanh ghi dữ liệu DATA tại offset `0x04` (đọc sẽ lấy ký tự cũ nhất khỏi bộ đệm). Sự kiện gõ phím trên giao diện đẩy mã ký tự vào bộ đệm; chương trình đọc thăm dò CTRL chờ bit sẵn sàng rồi đọc DATA. Thiết bị chuột (xem source: `src/js/mouse.js`) trình diện năm thanh ghi trong vùng 20 byte kể từ `0xFF100000`. Bảng 4.11 trình bày bản đồ thanh ghi của cả hai thiết bị.

**Bảng 4.11. Bản đồ thanh ghi bàn phím và chuột**

| Thiết bị | Thanh ghi | Offset | Quyền | Ý nghĩa |
|---|---|---|---|---|
| Bàn phím | CTRL | `0x00` | Đọc | Bit 0: bộ đệm có dữ liệu (sẵn sàng) |
| | DATA | `0x04` | Đọc | Lấy mã ASCII ký tự cũ nhất khỏi bộ đệm |
| Chuột | X | `0x00` | Đọc | Tọa độ X gần nhất (theo điểm ảnh canvas) |
| | Y | `0x04` | Đọc | Tọa độ Y gần nhất |
| | BTN | `0x08` | Đọc | Bitmap nút: bit 0 trái, bit 1 phải, bit 2 giữa |
| | STATUS | `0x0C` | Đọc/Ghi | Bit 0: có sự kiện di chuyển; bit 1: có nhấp/đổi nút (ghi để xóa cờ) |
| | CTRL | `0x10` | Đọc/Ghi | Dành riêng (cho phép ngắt trong tương lai) |

Thiết bị chuột nhận tọa độ và trạng thái nút từ sự kiện con trỏ trên vùng canvas LED (qua `reportEvent`): tọa độ được cắt về 16 bit, mặt nạ nút lấy ba bit thấp, và cờ trạng thái được dựng theo loại sự kiện (di chuyển hoặc nhấp). Việc ghi vào thanh ghi STATUS có ngữ nghĩa **ghi-1-để-xóa** (xóa đúng các bit được đặt trong giá trị ghi), cho phép chương trình xác nhận đã xử lý sự kiện. Cũng như các ngoại vi khác, bàn phím và chuột được giao tiếp theo cơ chế đọc thăm dò (xem source: `src/js/keyboard.js`, `src/js/mouse.js`).

Về thiết bị truyền thông CAN: tuy được nhắc tới trong định hướng ban đầu, hệ thống hiện chưa có mô-đun/mã nguồn cho CAN — đây là nội dung chưa xác định từ source hiện tại và chỉ được để ngỏ cho hướng phát triển (Chương 6).

## 4.7. Trực quan hóa và gỡ lỗi

### 4.7.1. Sơ đồ SoC động

Sơ đồ SoC động được hiện thực trong mô-đun `soc_diagram.js` (xem source: `src/js/soc_diagram.js`). Cấu trúc sơ đồ được mô tả khai báo bằng hai bảng dữ liệu: danh sách nút (`SOC_NODES`, mỗi nút gồm tên, tọa độ, kích thước, nhóm màu, biểu tượng, mô tả, chú giải bay (tooltip) và liên kết tới khung nhìn tương ứng) và danh sách cạnh (`SOC_EDGES`, mỗi cạnh gồm điểm đầu/cuối theo dạng `nút:cổng`, nhóm bus và các điểm gãy để định tuyến). Sơ đồ được kết xuất thành SVG với khung nhìn (`viewBox`) cố định; mỗi khối được vẽ bằng phần tử `foreignObject` chứa biểu tượng và nhãn trạng thái, và mỗi cạnh được vẽ bằng một đường gấp khúc trực giao (orthogonal) sinh bởi hàm `generateOrthogonalPath` (ghép các đoạn ngang/dọc qua các điểm gãy) (xem source: `src/js/soc_diagram.js`).

Khi mô phỏng chạy, lớp khởi tạo trung tâm ghi nhận dấu vết giao dịch trên các đường nối (qua móc `onTraceTransaction` ở mục 4.4.2 và lớp bao cổng), lưu vào một cấu trúc `trace` gồm danh sách đường đang hoạt động (mỗi đường có thời điểm hết hiệu lực) và hàng đợi giao dịch gần nhất. Hàm `updateSocTraceHighlights` đọc cấu trúc này để làm nổi bật các đường đang có giao dịch: đường được tô lớp `active` (và `active-write` nếu là giao dịch ghi), đồng thời một chấm tròn chạy dọc theo đường (hiệu ứng "pulse" bằng `animateMotion`, kéo dài 0,65 giây và được tiết chế tần suất để tránh quá dày) minh họa hướng di chuyển của giao dịch. Mỗi khối còn hiển thị trạng thái tóm tắt (ví dụ bộ đếm chương trình của lõi xử lý, tỉ lệ trúng của bộ nhớ đệm) và có chú giải bay khi trỏ tới (xem source: `src/js/soc_diagram.js`, `src/js/javascript.js`). Lưu ý nhãn chú giải của nút bus UH ghi "high-speed coherent bus" mang tính mô tả giao diện; bản chất là mô hình giao dịch như đã nêu ở mục 4.4.3.

Hình 4.13 minh họa khung nhìn sơ đồ SoC khi có giao dịch trên bus.

[Hình 4.13: Khung nhìn sơ đồ SoC với làm nổi bật giao dịch. Sơ đồ khối SVG bố trí theo bốn lớp (như Hình 3.2): lớp tính toán (RISC-V Core, DMA Controller) trên cùng; lớp bộ nhớ–dịch (MMU, L1I, L1D, L2); lớp bus (TileLink-UH, TileLink-UL); lớp bộ nhớ và ngoại vi (Main Memory, UART, LED Matrix, Keyboard, Mouse). Một số đường nối được tô đậm (lớp "active") thể hiện đang có giao dịch — ví dụ đường L2 → TileLink-UH → Main Memory được tô sáng với một chấm tròn "pulse" đang chạy dọc đường; đường ghi được tô màu khác (active-write). Mỗi khối hiển thị biểu tượng và một dòng trạng thái nhỏ (ví dụ "PC: 0x00400010", "Hit Rate: 98%"). Một thẻ chú giải bay hiện cạnh khối được trỏ tới.] (xem source: `src/js/soc_diagram.js`)

### 4.7.2. Nhật ký hệ thống và các khung quan sát trạng thái

Nhật ký hệ thống được hiện thực bằng cách thay thế (wrap) các hàm `console.log`/`warn`/`error`/`info` để mọi thông điệp nhật ký do các mô-đun phát ra đều được bắt lại, gắn nhãn rồi đưa vào một kho nhật ký (xem source: `src/js/system_log_bootstrap.js`). Mỗi dòng nhật ký được phân loại vào một hoặc nhiều nhóm trong số chín nhóm bằng hàm `inferLogModules`, dựa trên nhãn trong ngoặc vuông ở đầu dòng và nội dung văn bản; nhóm chính của dòng là nhóm không phải "khác" đầu tiên. Bảng 4.12 liệt kê chín nhóm và tiêu chí phân loại.

**Bảng 4.12. Các nhóm nhật ký và tiêu chí phân loại**

| Nhóm | Tiêu chí phân loại (rút gọn) |
|---|---|
| `cpu` | Dòng bắt đầu bằng `[Cycle …]` hoặc chứa từ khóa "cpu" |
| `mmu` | Chứa "mmu" |
| `cache` | Chứa "cache" hoặc dạng `L1I/L1D/L2 cache` |
| `tilelink` | Chứa "tilelink" (kể cả `tilelink-uh/-ul`) |
| `dma` | Chứa "dma" |
| `memory` | Chứa "main memory" |
| `io` | Chứa "uart"/"keyboard"/"mouse"/"led matrix"/"io map" |
| `system` | Reset, "simulation halted", lỗi assemble/run/step, hoặc liên quan syscall/arch/ui |
| `other` | Không khớp nhóm nào ở trên |

Kho nhật ký hỗ trợ cơ chế đăng ký (subscribe) để giao diện cập nhật tăng dần, cùng các thao tác chụp nhanh, xóa và xuất văn bản; lịch sử được giới hạn (cắt bớt khi vượt ngưỡng) để kiểm soát bộ nhớ. Trên giao diện, terminal nhật ký cho phép lọc theo nhóm mô-đun, theo mức (log/warn/error) và theo chuỗi tìm kiếm; để giữ hiệu năng khi số dòng lớn, giao diện giới hạn số dòng hiển thị trong DOM và nạp theo từng đợt qua cơ chế vẽ lại theo khung hình (xem source: `src/js/javascript.js`, `src/index.html`).

Ngoài terminal nhật ký, giao diện còn có hai khung quan sát chuyên biệt phản ánh trạng thái nội bộ của hệ thống bộ nhớ: khung MMU (hiển thị tổng quan và cấu hình, bản đồ địa chỉ, bảng trang phần mềm, bảng TLB và lịch sử dịch địa chỉ) và khung Cache (hiển thị trạng thái từng tập/đường cùng thống kê trúng/trượt của L1I, L1D, L2). Hai khung này lấy dữ liệu trực tiếp từ các đối tượng `MMU` và `SimpleCache` đã trình bày ở mục 4.3 (xem source: `src/js/javascript.js`).

Hình 4.14 minh họa terminal nhật ký với bộ lọc theo mô-đun.

[Hình 4.14: Terminal nhật ký hệ thống có bộ lọc theo mô-đun. Phần trên là thanh công cụ lọc: một ô tìm kiếm theo chuỗi, một danh sách thả xuống chọn mức (All/Log/Warn/Error), và một hàng các hộp kiểm nhóm mô-đun ("cpu", "mmu", "cache", "tilelink", "dma", "memory", "io", "system", "other") với một nút "Reset bộ lọc". Phần thân là vùng cuộn hiển thị các dòng nhật ký, mỗi dòng có màu/biểu tượng theo mức và một nhãn nhóm ở đầu; các dòng cảnh báo/lỗi được tô khác màu. Góc dưới hiển thị thống kê số dòng (đã lọc/tổng) và nút xuất nhật ký. Một số dòng thuộc nhóm không được chọn bị ẩn để minh họa bộ lọc đang hoạt động.] (xem source: `src/js/system_log_bootstrap.js`, `src/js/javascript.js`)

## 4.8. Vòng điều khiển thực thi trên giao diện

Toàn bộ tương tác điều khiển thực thi được hiện thực trong mô-đun giao diện `javascript.js`, đóng vai trò cầu nối giữa các nút điều khiển và lõi mô phỏng (xem source: `src/js/javascript.js`). Trạng thái chạy được giữ trong đối tượng `runState` (gồm các cờ đang chạy/tạm dừng, định danh khung hình, bộ đếm chu kỳ, giới hạn chu kỳ tối đa 500.000, bảng địa chỉ điểm dừng, và các biến đo tốc độ).

**Các thao tác điều khiển.** `handleAssemble` khởi tạo lại SoC, thiết lập các hàm gọi lại dịch vụ hệ thống và UART, gọi trình biên dịch rồi nạp chương trình; `handleRun` bắt đầu chạy liên tục; `handlePause` tạm dừng/tiếp tục; `handleStop` dừng hẳn; `handleStep` tiến đúng một lệnh; `handleReset` đưa hệ thống về trạng thái đầu nhưng giữ nguyên mã nguồn trong trình soạn thảo (xem source: `src/js/javascript.js`).

**Vòng lặp chạy liên tục.** Chế độ chạy liên tục dùng cơ chế vẽ lại theo khung hình của trình duyệt (`requestAnimationFrame`): hàm `runLoop` được gọi mỗi khung hình và thực thi một số chu kỳ nhất định. Số chu kỳ mỗi khung hình (`cyclesPerFrame`) lấy theo giá trị thanh trượt tốc độ (1–99); riêng vị trí cao nhất của thanh trượt (giá trị 100) được ánh xạ thành 1000 chu kỳ mỗi khung hình để cho phép chạy nhanh. Trong vòng lặp nội bộ của mỗi khung hình, trước mỗi chu kỳ hệ thống kiểm tra điều kiện dừng: gặp điểm dừng tại địa chỉ hiện hành, lõi xử lý dừng, hoặc vượt giới hạn chu kỳ tối đa. Sau mỗi khung hình, hệ thống cập nhật toàn bộ giao diện và lên lịch khung hình kế tiếp (xem source: `src/js/javascript.js`).

**Điểm dừng.** Người học đặt điểm dừng theo dòng trên cột đặt điểm dừng của trình soạn thảo (gutter của CodeMirror). Khi bắt đầu chạy, hàm `collectBreakpointAddresses` chuyển tập dòng có điểm dừng thành tập **địa chỉ lệnh** (dựa trên bố trí địa chỉ của trình biên dịch), nhờ đó vòng lặp chỉ cần kiểm tra bộ đếm chương trình hiện hành có nằm trong tập địa chỉ điểm dừng hay không (xem source: `src/js/javascript.js`).

**Đo tốc độ thực thi.** Hệ thống tích lũy số chu kỳ đã thực thi và, mỗi khi khoảng thời gian thực trôi qua đạt ít nhất 500 ms, tính tốc độ thực thi ước lượng bằng số chu kỳ chia cho thời gian thực rồi quy về mỗi giây, hiển thị ở chỉ số IPS trên thanh công cụ (đơn vị Hz). Chỉ số này phản ánh số chu kỳ mô phỏng thực thi trên mỗi giây thời gian thực, dùng làm thước đo tương đối của tốc độ tương tác (xem source: `src/js/javascript.js`).

**Cập nhật giao diện có làm nổi bật thay đổi.** Hàm `updateUIGlobally` vẽ lại các khung quan sát (thanh ghi số nguyên/dấu phẩy động, bộ nhớ lệnh, vùng dữ liệu, Cache, MMU, sơ đồ SoC). Khi một ô thanh ghi có giá trị khác lần vẽ trước, ô đó được gán lớp làm nổi bật (highlight) và lớp này được gỡ sau khoảng 500 ms, giúp người học dễ nhận ra thay đổi sau mỗi bước thực thi. Khi dừng chạy, nếu DMA còn giao dịch dở dang, hệ thống tiếp tục tiến chu kỳ cho đến khi DMA hoàn tất trước khi cập nhật giao diện lần cuối (xem source: `src/js/javascript.js`).

Hình 4.15 minh họa vòng lặp chạy mô phỏng trên giao diện.

[Hình 4.15: Sơ đồ vòng lặp chạy mô phỏng trên trình duyệt. Bắt đầu ở "handleRun" → "Thu thập địa chỉ điểm dừng từ các dòng đã đặt" → "scheduleRunLoop (requestAnimationFrame)". Khối "runLoop (mỗi khung hình)": nút quyết định "CPU dừng hoặc vượt maxCycles?": CÓ → "finishRun (rút cạn DMA, cập nhật UI cuối)" → "End"; KHÔNG → "cyclesPerFrame ← thanh tốc độ (1–99; 100→1000)". Vòng lặp nội bộ "lặp cyclesPerFrame lần": nút "PC ∈ tập điểm dừng?": CÓ → "finishRun (báo điểm dừng)"; nút "CPU đã dừng?": CÓ → finishRun; ngược lại → "simulator.tick(); cycle++". Sau vòng lặp nội bộ: "Tích lũy số chu kỳ" → nút "đã ≥ 500 ms?": CÓ → "Tính & hiển thị IPS (Hz)"; → "updateUIGlobally (tô sáng ô thay đổi)" → "scheduleRunLoop" quay lại đầu khung hình. Các nút điều khiển bên: "handlePause/handleStop" tác động vào cờ trạng thái; "handleStep" gọi stepInstruction một lần rồi updateUIGlobally.] (xem source: `src/js/javascript.js`)

## 4.9. Một số thách thức hiện thực và cách xử lý

Mục này tổng hợp một số vấn đề kỹ thuật phát sinh khi hiện thực và cách hệ thống đã giải quyết; các giới hạn về phạm vi đã được nêu trực tiếp tại từng mô-đun ở trên và được tổng hợp ở Chương 5–6.

- **Nhân 64 bit để lấy phần cao.** JavaScript không có kiểu số nguyên 64 bit gốc và số thực 64 bit không biểu diễn chính xác tích của hai số 32 bit. Hệ thống dùng `BigInt` để tính tích chính xác rồi dịch phải 32 bit cho nhóm lệnh `mulh*`, đồng thời dùng `Math.imul` cho phần thấp `mul` (mục 4.2.3).
- **Mô hình bộ nhớ bất đồng bộ giữ nguyên PC.** Vì một truy cập bộ nhớ trải dài nhiều chu kỳ, lõi xử lý và bộ điều khiển DMA dùng chung mô hình yêu cầu–chờ–phản hồi–thực hiện lại: lệnh/giao dịch chưa hoàn tất giữ nguyên con trỏ chương trình (hoặc tiến độ) và được "thực hiện lại" khi phản hồi về (mục 4.2.2, 4.5).
- **Tính mặt nạ byte cho ghi một phần.** Ghi byte/nửa từ cần xác định đúng các làn byte (byte lane) bị tác động; hàm `computeTileLinkMask` sinh mặt nạ theo địa chỉ và kích thước để mô hình ghi một phần đúng vị trí (mục 4.4.1).
- **Ghi little-endian nhất quán.** Trình biên dịch ghi mã máy, bộ nhớ và các thiết bị đều thống nhất thứ tự byte nhỏ trước, qua các hàm đọc/ghi theo kích thước dùng chung (mục 4.1.1, 4.3.1).
- **Biểu diễn IEEE 754 bằng `Float32Array`/`DataView`.** Việc dùng `Float32Array` cho tệp thanh ghi dấu phẩy động bảo đảm độ chính xác đơn, còn `ArrayBuffer`/`DataView` cho phép thao tác trực tiếp trên bit để hiện thực các lệnh sao chép dấu, di chuyển bit và phân loại (mục 4.2.3).
- **Mô phỏng đơn luồng vẫn giữ giao diện đáp ứng.** Vòng lặp chạy chia công việc theo từng khung hình `requestAnimationFrame` và đệm nhật ký theo đợt, nhờ đó mô phỏng tiến triển mà giao diện vẫn mượt và terminal nhật ký không bị nghẽn khi khối lượng thông điệp lớn (mục 4.7.2, 4.8).

Tổng hợp lại, Chương 4 đã trình bày hiện thực chi tiết của toàn bộ các thành phần đã thiết kế ở Chương 3: trình biên dịch hợp ngữ hai lượt với bảng mã hóa và bản đồ thanh ghi; lõi xử lý RV32IMF với mô hình truy cập bộ nhớ bất đồng bộ và xử lý dịch vụ hệ thống; hệ thống bộ nhớ gồm bộ nhớ chính, MMU/TLB và phân cấp bộ nhớ đệm; hệ thống bus TileLink với lõi giao thức, định tuyến, hai phân hệ UH/UL và cầu nối; bộ điều khiển DMA; bốn thiết bị ngoại vi MMIO; các thành phần trực quan hóa và vòng điều khiển trên giao diện. Trên cơ sở hiện thực này, Chương 5 trình bày quy trình và kết quả kiểm thử, đánh giá hệ thống.

---

## Tài liệu tham khảo (trích dẫn trong Chương 4)

> *Ghi chú: Danh sách dưới đây liệt kê các tài liệu được trích dẫn trong Chương 4, trình bày theo chuẩn IEEE và đánh số theo thứ tự xuất hiện trong toàn báo cáo; danh sách này được hợp nhất vào mục Tài liệu tham khảo chung ở cuối báo cáo.*

[1] A. Waterman và K. Asanović (chủ biên), "The RISC-V Instruction Set Manual, Volume I: Unprivileged ISA, Document Version 20191213," RISC-V Foundation, tháng 12/2019. [Trực tuyến]. Có tại: https://riscv.org/technical/specifications/

[2] SiFive, Inc., "SiFive TileLink Specification, Version 1.8.1," 2020. [Trực tuyến]. Có tại: https://www.sifive.com/documentation/tilelink/

[10] "IEEE Standard for Floating-Point Arithmetic," IEEE Std 754-2019 (bản sửa đổi của IEEE Std 754-2008), trang 1–84, tháng 7/2019.

[11] D. A. Patterson và J. L. Hennessy, Computer Organization and Design: The Hardware/Software Interface, RISC-V Edition, tái bản lần 2. Cambridge, MA, Hoa Kỳ: Morgan Kaufmann, 2020.

[12] J. L. Hennessy và D. A. Patterson, Computer Architecture: A Quantitative Approach, tái bản lần 6. Cambridge, MA, Hoa Kỳ: Morgan Kaufmann, 2019.

[13] Mozilla, "MDN Web Docs." [Trực tuyến]. Có tại: https://developer.mozilla.org/ (truy cập: 19/01/2026).

[14] M. Haverbeke, "CodeMirror — thư viện soạn thảo mã trên nền web." [Trực tuyến]. Có tại: https://codemirror.net/ (truy cập: 19/01/2026).

[15] Google, "Material Components for the Web (MDC Web)." [Trực tuyến]. Có tại: https://github.com/material-components/material-components-web (truy cập: 19/01/2026).

[16] "RARS — RISC-V Assembler and Runtime Simulator (TheThirdOne/rars)," kho mã nguồn GitHub. [Trực tuyến]. Có tại: https://github.com/TheThirdOne/rars (truy cập: 19/01/2026).
