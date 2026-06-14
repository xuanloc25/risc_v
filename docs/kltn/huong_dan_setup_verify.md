# Hướng dẫn cài đặt môi trường kiểm chứng: riscv-tests · GNU toolchain · Spike

> Tài liệu này hướng dẫn **cài lại từ đầu** ba công cụ chuẩn của hệ sinh thái RISC-V để kiểm chứng
> trình mô phỏng SoC của đề tài, và **giải thích tác dụng** của từng công cụ. Dùng để trình bày trước
> hội đồng và hướng dẫn đồng đội. Môi trường khuyến nghị: **WSL Ubuntu** (Windows) hoặc Ubuntu/Linux.
>
> Nguồn tham khảo chính thức:
> - riscv-tests — https://github.com/riscv-software-src/riscv-tests
> - riscv-gnu-toolchain — https://github.com/riscv-collab/riscv-gnu-toolchain
> - Spike (riscv-isa-sim) — https://github.com/riscv-software-src/riscv-isa-sim

---

## 1. Bức tranh tổng thể — ba công cụ làm gì

Đề tài kiểm chứng theo **ba lớp**. Hai lớp ngoài cùng dùng đúng các công cụ "của quốc tế" để chứng minh
một cách khách quan rằng trình mô phỏng làm đúng chuẩn — không phải "tự viết test rồi tự đúng".

| Công cụ | Bản chất | Cài để làm gì trong đề tài |
|---|---|---|
| **riscv-gnu-toolchain** | Bộ biên dịch chéo chính thức: `gcc`, assembler `as`, linker `ld`, `objdump`, `objcopy` + thư viện C (newlib) | **(a)** Biên dịch mã nguồn `riscv-tests` thành file ELF để Spike chạy. **(b)** Là **"thước đo vàng"** cho assembler của đề tài: script đối chiếu lấy mã máy do `as`/`objdump` của GNU sinh ra rồi so từng lệnh 32-bit với mã do assembler đề tài sinh — trùng khớp nghĩa là phần mã hóa đúng. |
| **riscv-tests** | Bộ chương trình kiểm thử ISA **chính thức của cộng đồng RISC-V** (rv32ui số nguyên, rv32um nhân/chia, rv32uf dấu phẩy động…) | Cung cấp **dữ liệu kiểm thử chuẩn, độc lập** (không do nhóm tự viết) làm đầu vào cho cả hai phép đối chiếu bên dưới. Dùng test "của người ta" để kết quả thuyết phục hơn. |
| **Spike (riscv-isa-sim)** | **Trình mô phỏng ISA tham chiếu chính thức** của RISC-V ("golden model") | Chạy các ELF `riscv-tests` để xác nhận **hành vi thực thi đúng**: mỗi bài test tự kiểm tra và báo pass/fail. Đây là "mô hình đúng" để đối chiếu hành vi thực thi của đề tài. |

**Ánh xạ tới ba lớp kiểm chứng:**
- **Lớp 1 — Unit/khối:** chạy script Node trong `test/` (không cần ba công cụ trên).
- **Lớp 2 — Đối chiếu mã hóa:** `riscv-gnu-toolchain` (as/objdump) + `riscv-tests` → `test/verify_rv32imf_against_gnu.mjs`.
- **Lớp 3 — Đối chiếu thực thi:** `Spike` + `riscv-tests` → `test/verify_riscv_tests_spike.mjs`.

**Thứ tự cài (quan trọng):** `toolchain` → `riscv-tests` → `Spike`.
*Vì sao:* `riscv-tests` cần `gcc` của toolchain để build ELF; còn Spike độc lập nhưng cần để chạy chính các ELF đó.

---

## 2. Chuẩn bị (Ubuntu / WSL Ubuntu)

```bash
sudo apt update
sudo apt install -y autoconf automake autotools-dev curl python3 python3-pip \
  libmpc-dev libmpfr-dev libgmp-dev gawk build-essential bison flex texinfo \
  gperf libtool patchutils bc zlib1g-dev libexpat-dev ninja-build git cmake \
  libglib2.0-dev libslirp-dev device-tree-compiler
```

Đặt sẵn thư mục đích và biến môi trường (thêm vào cuối `~/.bashrc` để dùng lại mọi phiên):
```bash
echo 'export RISCV=$HOME/riscv'        >> ~/.bashrc
echo 'export PATH=$RISCV/bin:$PATH'    >> ~/.bashrc
source ~/.bashrc
```
> `$RISCV` là nơi cài toolchain + Spike; thêm `$RISCV/bin` vào `PATH` để gọi `riscv64-unknown-elf-gcc`, `spike`… ở mọi nơi.

---

## 3. Bước 1 — riscv-gnu-toolchain (bộ biên dịch chéo)

> **Tác dụng:** vừa là trình biên dịch để tạo ELF cho `riscv-tests`, vừa là thước đo vàng cho assembler.

```bash
git clone https://github.com/riscv-collab/riscv-gnu-toolchain
cd riscv-gnu-toolchain
# Cấu hình cho đúng phạm vi đề tài: RV32IMF, ABI ilp32f (có dấu phẩy động single)
./configure --prefix=$RISCV --with-arch=rv32imf --with-abi=ilp32f
make            # build bản Newlib (bare-metal) — KHÔNG dùng "make linux"
```
- Quá trình build lâu (vài chục phút đến hơn 1 giờ tùy máy) vì nó biên dịch cả gcc + newlib.
- Kết quả: `$RISCV/bin/riscv64-unknown-elf-{gcc,as,ld,objdump,objcopy,...}` (tên có "64" là mặc định, vẫn sinh mã RV32 theo `--with-arch`).
- Kiểm tra: `riscv64-unknown-elf-gcc --version`

**Lối tắt — nếu chỉ cần Lớp 2 (đối chiếu mã hóa), không cần build cả gcc:**
```bash
sudo apt install -y binutils-riscv64-unknown-elf
```
Gói này cung cấp ngay `as`/`objdump`/`objcopy` ở `/usr/bin` (đủ cho `verify_rv32imf_against_gnu.mjs`), **nhưng không có `gcc`** nên **không build được `riscv-tests`**. Muốn đủ cả 3 lớp thì vẫn phải build toolchain đầy đủ ở trên.

---

## 4. Bước 2 — riscv-tests (bộ test ISA chuẩn)

> **Tác dụng:** dữ liệu kiểm thử chuẩn quốc tế; sau khi build sẽ có các ELF trong thư mục `isa/`.
> Cần `riscv64-unknown-elf-gcc` đã có trong `PATH` (từ Bước 1).

```bash
# Clone KÈM submodule (--recursive): riscv-tests phụ thuộc submodule "env" chứa macro/linker của test
git clone --recursive https://github.com/riscv-software-src/riscv-tests
cd riscv-tests
autoconf
./configure --prefix=$RISCV/target
make isa XLEN=32          # chỉ build bộ ISA test cho 32-bit (đủ cho đề tài)
```
- `make isa XLEN=32` tạo các file ELF trong `riscv-tests/isa/`, ví dụ `rv32ui-p-add`, `rv32um-p-mul`, `rv32uf-p-fadd`…
- **`-p-`** = bài test bare-metal chạy ở machine mode, tự kiểm tra qua cơ chế `tohost` (đây là loại đề tài dùng). `-v-` = bản chạy có bộ nhớ ảo (không dùng).
- Kiểm tra: `ls isa | grep -E '^rv32u[imf]-p-' | wc -l` → kỳ vọng **61** file.

> ⚠️ Với đề tài, các script Node đọc thẳng ELF ở **`<repo>/riscv-tests/isa/`**. Nếu bạn clone `riscv-tests` ở nơi khác, hãy copy/symlink thư mục `isa/` (hoặc cả `riscv-tests/`) vào thư mục gốc của repo trình mô phỏng.

---

## 5. Bước 3 — Spike (riscv-isa-sim, trình mô phỏng tham chiếu)

> **Tác dụng:** chạy các ELF `riscv-tests` để xác nhận hành vi thực thi đúng (golden model).

```bash
git clone https://github.com/riscv-software-src/riscv-isa-sim
cd riscv-isa-sim
mkdir build && cd build
../configure --prefix=$RISCV
make -j$(nproc)
make install            # cài "spike" vào $RISCV/bin
```
- Phụ thuộc `device-tree-compiler` (đã cài ở mục 2).
- Kiểm tra: `spike --help | head -1` (Spike không có `--version`).
- **Không cần `riscv-pk` (proxy kernel `pk`)** cho các bài `-p-`: chúng tự chứa, chạy thẳng `spike --isa=rv32imf <elf>`. (`pk` chỉ cần khi chạy chương trình user/newlib thông thường.)

---

## 6. Bước 4 — Chạy kiểm chứng và kết quả kỳ vọng

Từ thư mục gốc repo trình mô phỏng:

```bash
# Lớp 2 — đối chiếu mã hóa với GNU binutils trên riscv-tests
node test/verify_rv32imf_against_gnu.mjs
# Kỳ vọng:
#   - Local developer corpus: PASS (7 groups, 83 instruction words)
#   - riscv-tests artifacts: PASS (61 ELF file(s), 17978 supported instruction word(s), 1456 skipped)

# Lớp 3 — đối chiếu thực thi với Spike trên riscv-tests
node test/verify_riscv_tests_spike.mjs
# Kỳ vọng:
#   - riscv-tests Spike: PASS (61/61 ELF pass)
```

> **Trên Windows:** không cần làm gì thêm — hai script tự phát hiện Windows và gọi sang **WSL** (`spawnSync('wsl', ['bash','-lc',…])`, tự đổi `D:\…` → `/mnt/d/…`). Script Spike tự dò `spike` theo thứ tự: biến môi trường `SPIKE` → `PATH` → `$HOME/riscv-tools/bin/spike` → `/opt/riscv/bin/spike`. Có thể chỉ định tay: `SPIKE=/duong/dan/spike node test/verify_riscv_tests_spike.mjs`.

---

## 7. Kiểm tra nhanh "đã cài đủ chưa" (trên máy hiện tại)

```bash
riscv64-unknown-elf-as --version | head -1     # binutils (Lớp 2)
riscv64-unknown-elf-gcc --version | head -1    # gcc (build riscv-tests) — có thể ở $RISCV/bin
spike --help | head -1                          # Spike (Lớp 3); hoặc: ls $HOME/riscv-tools/bin/spike
ls riscv-tests/isa | grep -E '^rv32u[imf]-p-' | wc -l   # = 61 nếu đã build ELF
```

---

## 8. Sự cố thường gặp

| Triệu chứng | Nguyên nhân & cách xử lý |
|---|---|
| `Missing required RISC-V GNU tool(s)` | `as/objdump/objcopy` chưa trong PATH của WSL → `sudo apt install binutils-riscv64-unknown-elf` hoặc thêm `$RISCV/bin` vào PATH. |
| `Không tìm thấy Spike` | `spike` không ở PATH lẫn các vị trí dò → đặt `SPIKE=/duong/dan/spike` hoặc `make install` Spike vào `$RISCV/bin`. |
| `riscv-tests artifacts: SKIP` | Chưa build ELF → `cd riscv-tests && make isa XLEN=32` (cần gcc trong PATH). |
| `make isa` báo thiếu macro/linker | Quên `--recursive` khi clone → `git submodule update --init --recursive`. |
| Chạy trên Windows nhưng không thấy WSL | Cài/khởi động WSL: `wsl --install -d Ubuntu`, rồi mở Ubuntu một lần. |

---

## 9. Tóm tắt một câu cho mỗi công cụ (để trả lời hội đồng)

- **riscv-gnu-toolchain** — trình biên dịch chính thức; vừa tạo ELF cho test, vừa là *thước đo vàng* để đối chiếu mã hóa của assembler đề tài.
- **riscv-tests** — bộ test ISA *chuẩn của cộng đồng RISC-V*; dữ liệu khách quan để kiểm chứng, không do nhóm tự viết.
- **Spike** — *mô phỏng tham chiếu chính thức*; "đáp án đúng" về hành vi thực thi để đối chiếu.
