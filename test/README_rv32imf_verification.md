# Kiểm thử assembler RV32IMF

Tài liệu này mô tả plan verification chính thức cho assembler RV32IMF trong
phạm vi khóa luận. Các bằng chứng kiểm thử nên dựa trên bộ test và reference
được cộng đồng RISC-V sử dụng rộng rãi: GNU RISC-V binutils, Spike và
`riscv-tests`.

Các kiểm tra nhanh phục vụ phát triển được chạy riêng và không thuộc phạm vi
báo cáo verification chính thức.

## Chạy nhanh

Từ thư mục gốc của repo:

```bash
node test/verify_rv32imf_against_gnu.mjs
node test/verify_riscv_tests_spike.mjs
```

## Các lớp kiểm thử chính thức

### 1. So sánh encoding với GNU binutils trên artifact từ riscv-tests

Script:

```bash
node test/verify_rv32imf_against_gnu.mjs
```

Reference:

- `riscv64-unknown-elf-as`
- `riscv64-unknown-elf-objcopy`
- `riscv64-unknown-elf-objdump`

Input kiểm thử:

- Các ELF đã build trong `riscv-tests/isa` theo mẫu:
  - `rv32ui-p-*`
  - `rv32um-p-*`
  - `rv32uf-p-*`

Quy trình:

1. Disassemble từng ELF bằng `objdump -d -M no-aliases`.
2. Chuẩn hóa các lệnh PC-relative như branch và `jal` về offset tương ứng.
3. Assemble lại từng lệnh RV32IMF mà assembler của dự án hỗ trợ.
4. So sánh instruction word 32-bit do assembler sinh ra với mã máy gốc trong
   ELF của `riscv-tests`.

Các lệnh không thuộc phạm vi RV32IMF của assembler, ví dụ CSR hoặc privileged
instruction trong môi trường test, được tính là `skipped` và phải được ghi chú
trong báo cáo kết quả.

Tiêu chí pass:

- Tìm thấy ELF `rv32ui`, `rv32um`, `rv32uf` đã build từ `riscv-tests`.
- Không có mismatch ở các instruction được assembler hỗ trợ.
- Số lượng instruction được kiểm tra và số lượng instruction bị skip được ghi
  lại trong log.

### 2. Chạy ELF riscv-tests bằng Spike

Script:

```bash
node test/verify_riscv_tests_spike.mjs
```

Mục tiêu:

- Dùng Spike làm reference model thực thi.
- Chạy các ELF `rv32ui-p-*`, `rv32um-p-*`, `rv32uf-p-*` đã build từ
  `riscv-tests`.
- Xác nhận mỗi test kết thúc với exit status thành công theo cơ chế pass/fail
  của `riscv-tests`.

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

Tiêu chí pass:

- Tìm thấy Spike và các ELF `rv32ui`, `rv32um`, `rv32uf`.
- Tất cả ELF được chạy đều kết thúc thành công.
- Các lỗi timeout, signal hoặc non-zero exit status đều được xem là fail.

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

- `verify_rv32imf_against_gnu.mjs` pass: các instruction RV32IMF được hỗ trợ
  có encoding khớp với mã máy trong ELF `riscv-tests` khi đối chiếu bằng GNU
  binutils.
- `verify_riscv_tests_spike.mjs` pass: các ELF từ `riscv-tests` chạy thành
  công trên Spike với ISA được chọn.
- Trường hợp script báo `SKIP` vì chưa có ELF `riscv-tests` thì chưa được xem
  là bằng chứng pass cho verification chính thức.

Trong báo cáo khóa luận, nên trình bày rõ:

- GNU binutils được dùng để đối chiếu encoding.
- Spike được dùng làm reference model cho hành vi thực thi.
- `riscv-tests` là nguồn test chính thức cho các nhóm RV32I, RV32M và RV32F.
- Các lệnh CSR/privileged xuất hiện trong môi trường test của `riscv-tests`
  không thuộc phạm vi assembler RV32IMF hiện tại nên được tách riêng.
