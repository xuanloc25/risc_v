# Kiểm thử assembler RV32IMF

Thư mục này chứa các script regression để kiểm tra độ đúng đắn của assembler
trong dự án.

## Chạy nhanh

Từ thư mục gốc của repo:

```bash
node test/assembler_verify.mjs
node test/verify_rv32imf_against_gnu.mjs
node test/verify_project_assembler_spike.mjs
node test/verify_riscv_tests_spike.mjs
```

## Các lớp kiểm thử

### 1. Unit test nội bộ

Script:

```bash
node test/assembler_verify.mjs
```

Mục tiêu:

- Kiểm tra các case nhỏ, dễ đọc.
- Khóa lại các lỗi đã từng phát hiện, ví dụ `jalr`, `call`, `fence`,
  rounding mode của lệnh floating-point, `fmin.s` và `fmax.s`.

### 2. So sánh encoding với GNU binutils

Script:

```bash
node test/verify_rv32imf_against_gnu.mjs
```

Reference:

- `riscv64-unknown-elf-as`
- `riscv64-unknown-elf-objcopy`
- `riscv64-unknown-elf-objdump`

Script này kiểm tra theo hai hướng:

1. Corpus tự viết:
   - Assemble các đoạn mã RV32I, RV32M, RV32F bằng assembler của dự án.
   - Assemble cùng đoạn mã bằng GNU assembler.
   - Trích section `.text` bằng `objcopy`.
   - So sánh từng instruction word 32-bit.

2. Artifact từ `riscv-tests`:
   - Tìm các ELF đã build trong `riscv-tests/isa` theo mẫu:
     - `rv32ui-p-*`
     - `rv32um-p-*`
     - `rv32uf-p-*`
   - Disassemble bằng `objdump -d -M no-aliases`.
   - Assemble lại từng lệnh mà assembler hiện hỗ trợ.
   - So sánh word 32-bit với mã máy trong ELF.

Các lệnh không thuộc phạm vi RV32IMF của assembler, ví dụ CSR hoặc `mret`,
sẽ được tính là `skipped` thay vì làm test fail.

### 3. Chạy mã máy của assembler dự án bằng Spike

Script:

```bash
node test/verify_project_assembler_spike.mjs
```

Mục tiêu:

- Lấy chính machine code do assembler của dự án sinh ra.
- Đóng gói các word 32-bit đó vào ELF bằng directive `.word`.
- Chạy ELF trên Spike.
- Test pass/fail thông qua biến `tohost`, giống cơ chế của `riscv-tests`.

Nhóm test hiện có:

- Integer/branch.
- Multiply/divide của RV32M.
- Single-precision floating-point của RV32F.

Đây là bước quan trọng để chứng minh rằng output của assembler không chỉ
khớp encoding với GNU binutils, mà còn chạy được trên reference model Spike.

### 4. Chạy ELF riscv-tests bằng Spike

Script:

```bash
node test/verify_riscv_tests_spike.mjs
```

Mục tiêu:

- Dùng Spike làm reference model thực thi.
- Chạy các ELF `rv32ui-p-*`, `rv32um-p-*`, `rv32uf-p-*` đã build từ
  `riscv-tests`.
- Xác nhận test kết thúc với exit status thành công.

Mặc định script này dùng ISA:

```text
RV32IMF_zicclsm
```

Lý do: một số ELF của `riscv-tests`, đặc biệt `rv32ui-p-ma_data`, kiểm tra
misaligned load/store. Với Spike, test này cần bật `zicclsm`; nếu chỉ chạy
`RV32IMF` thuần, Spike có thể trap `load address misaligned`.

Nếu cần chạy nghiêm ngặt với `RV32IMF` thuần:

```bash
SPIKE_ISA=RV32IMF node test/verify_riscv_tests_spike.mjs
```

Nếu Spike không nằm trong `PATH`, script sẽ tự thử các đường dẫn phổ biến như:

```text
$HOME/riscv-tools/bin/spike
/opt/riscv/bin/spike
/usr/local/bin/spike
```

Cũng có thể chỉ định trực tiếp:

```bash
SPIKE=/home/locdaihiep/riscv-tools/bin/spike node test/verify_riscv_tests_spike.mjs
```

## Build thêm test từ riscv-tests

Nếu trong `riscv-tests/isa` mới chỉ có vài ELF, có thể build thêm:

```bash
cd riscv-tests
make isa XLEN=32
```

Nếu build lỗi vì `riscv64-unknown-elf-gcc` không tìm thấy header C như
`string.h`, hãy cài thêm thư viện C bare-metal:

```bash
sudo apt install gcc-riscv64-unknown-elf binutils-riscv64-unknown-elf picolibc-riscv64-unknown-elf
```

## Cách diễn giải kết quả

- `assembler_verify.mjs` pass: các regression nhỏ đang đúng.
- `verify_rv32imf_against_gnu.mjs` pass: mã máy do assembler sinh ra khớp GNU
  binutils theo từng word 32-bit.
- `verify_project_assembler_spike.mjs` pass: machine code do assembler của dự
  án sinh ra chạy thành công trên Spike.
- `verify_riscv_tests_spike.mjs` pass: các ELF từ `riscv-tests` chạy thành
  công trên Spike với ISA được chọn.

Trong báo cáo khóa luận, nên trình bày rõ:

- GNU binutils được dùng để đối chiếu encoding.
- Spike được dùng để đối chiếu hành vi thực thi.
- Các lệnh CSR/privileged xuất hiện trong môi trường test của `riscv-tests`
  không thuộc phạm vi assembler RV32IMF hiện tại nên được tách riêng.

