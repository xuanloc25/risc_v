# Kịch bản đánh giá & kết quả kiểm chứng — KLTN Trình mô phỏng SoC RISC-V

> **Mục đích:** phục vụ tiêu chí **LO4** (*hiện thực giải pháp, hoàn thiện sản phẩm demo* + *kịch bản đánh giá, trình bày kết quả rõ ràng*) và **LO5** (*trình bày mạch lạc, dễ theo dõi*).
> **Ngày kiểm tra lại hệ thống:** 14/06/2026. **Phạm vi đợt này:** toàn hệ trừ ngoại vi **CAN** (tạm gác; chỉ quan tâm nếu hội đồng yêu cầu sau phản biện).
> **Nguồn dữ liệu:** chạy lại 14 script Node trong `test/` (tái lập trực tiếp, không lưu log); riêng đối chiếu **GNU binutils + Spike trên bộ chuẩn quốc tế `riscv-tests`** thì giữ log tại [`test-artifacts/eval_run/`](../../test-artifacts/eval_run/) làm bằng chứng. Cách cài lại toolchain/Spike/riscv-tests từ đầu: xem [huong_dan_setup_verify.md](huong_dan_setup_verify.md).

---

## 0. Tóm tắt một trang (đọc trước khi vào phòng)

**Hệ thống ở trạng thái xanh.** 14/14 script kiểm thử Node chạy lại hôm nay đều PASS; 21/21 chương trình hợp ngữ mẫu assemble thành công; phần đối chiếu mã hóa với GNU binutils đạt 17.978/17.978 lệnh trùng khớp (0 sai).

| Lớp kiểm chứng | Phạm vi | Kết quả | Tái lập |
|---|---|---|---|
| **1. Unit/khối** (Node) | assembler, CPU-F, MMU, cache, TileLink, DMA, UART, log | **PASS** 14/14 | `node test/<tên>.mjs` — chạy lại 14/06/2026 |
| **2. Đối chiếu mã hóa** GNU binutils | 61 ELF `riscv-tests` + 83 lệnh mẫu | **17.978 khớp / 0 sai** | **chạy lại 14/06/2026** (Node tự bắc cầu sang WSL) |
| **3. Đối chiếu thực thi** Spike | 61 ELF `riscv-tests` trên mô phỏng tham chiếu | **PASS 61/61 ELF** | **chạy lại 14/06/2026** (Node tự bắc cầu sang WSL) |

> ✅ **Cả 3 lớp đều đã chạy lại trực tiếp 14/06/2026** trên chính máy demo: lớp 1 bằng Node thuần (Windows), lớp 2–3 do script Node tự gọi sang **WSL Ubuntu** (đã cài GNU toolchain `riscv64-unknown-elf-*` và Spike `~/riscv-tools/bin/spike`). Không còn hạng mục "chỉ có số liệu ghi nhận".

**3 demo chính đề xuất cho buổi bảo vệ (≤ 5 phút):**
1. `soc_full_demo.asm` — **toàn cảnh SoC** trong một chương trình (CPU→MMU→cache→TileLink→bridge→UART/keyboard/mouse→DMA→LED), exit `a0=0`.
2. `demo_uart_dma.asm` — **điểm kỹ thuật lõi**: DMA đẩy 65 byte ra UART với **backpressure**, 0 byte mất.
3. `mouse_demo.asm` (hoặc `fig_4_13_socdiagram_demo.asm`) — **trực quan ấn tượng**: điểm LED đổi màu theo chuột thời gian thực / sơ đồ bus "sống".

**Câu phòng thủ phạm vi (thuộc lòng):** RV32IMF *tập con*; chưa có CSR/đặc quyền/ngắt (ngoại vi **polling**); `fence` mã hóa nhưng không thực thi; FPU chưa đủ FCSR/fflags/frm; TileLink chỉ **kênh A/D mức giao dịch** (UL+UH), không B/C/E/coherence, bus một-giao-dịch; AMOADD.W là lệnh RV32A *duy nhất* ngoài tên đề tài; MMU **tối giản** (SoC hardcode 4KB, fully-associative).

---

## 1. Phương pháp đánh giá (nói ~1 phút trên slide)

Đề tài dùng **ba lớp kiểm chứng bổ trợ nhau**, đi từ trong ra ngoài:

1. **Kiểm thử đơn vị/khối (unit/integration) bằng Node.js** — mỗi script trong `test/` dựng trực tiếp một mô-đun (assembler, MMU, cache, TileLink, DMA, UART) hoặc một cấu hình tích hợp nhỏ, rồi so kết quả với giá trị kỳ vọng bằng `assert`. Đây là lớp **tái lập được ngay trên máy demo**.
2. **Đối chiếu mã hóa lệnh với công cụ chuẩn (GNU binutils)** — lấy mã máy do assembler của đề tài sinh ra so từng từ-lệnh 32-bit với mã máy GNU tạo ra trên cùng đầu vào `riscv-tests`. Trùng khớp ⇒ phần mã hóa đúng.
3. **Đối chiếu thực thi với mô phỏng tham chiếu (Spike)** — chạy `riscv-tests` trên Spike để khẳng định hành vi thực thi.

> **Môi trường tái lập:** cả ba lớp đều **chạy lại trực tiếp 14/06/2026** trên máy demo. Lớp (1) chạy bằng Node trên Windows. Lớp (2)(3): hai script Node (`verify_rv32imf_against_gnu.mjs`, `verify_riscv_tests_spike.mjs`) **tự phát hiện Windows và gọi sang WSL Ubuntu** (`spawnSync('wsl', ['bash','-lc', ...])`, tự đổi `D:\…` → `/mnt/d/…`); toolchain GNU và Spike đã cài sẵn trong WSL. Số liệu trùng khớp đúng những gì báo cáo Chương 5 đã ghi.

---

## 2. Phần A — Kết quả kiểm tra lại hệ thống (LO4: "trình bày kết quả đánh giá rõ ràng")

### 2.1. Lớp 1 — 14 script Node (chạy lại 14/06/2026, **PASS 14/14**)

| # | Script | Mô-đun | Bằng chứng chính (số liệu thật) |
|---|---|---|---|
| 1 | `assembler_verify.mjs` | Assembler — mã hóa lệnh | `jalr` chấp nhận cả 2 cú pháp → cùng `0x000280E7`; `li` 1↔2 lệnh theo độ rộng; `fence`=`0x0FF0000F`; `.data` ghi little-endian đúng 9 byte |
| 2 | `asm_programs_verify.mjs` | 21 chương trình mẫu | **21/21** assemble OK, mọi file `start=0x400000` (soc_full=42 lệnh, demo_uart_dma=27, test_fpu_all=68) |
| 3 | `cpu_rv32f_verify.mjs` | CPU RV32F | **26** lệnh F decode đúng tên; **4** lệnh execute đúng (fadd 1.25+2.5=3.75; fmadd 2·3+4=10; fmin/fmax) |
| 4 | `mmu_basic_verify.mjs` | MMU + TLB | **6/6** hành vi: identity fallback, mapped+TLB refill, LRU eviction (vpn 0x2 bị đẩy), permission fault (W/X), request/response, attachCPU |
| 5 | `mmu_syscall_verify.mjs` | MMU qua syscall (end-to-end) | exit `a0=0x12345678`; bộ nhớ vật lý `pa=0x10010020`=`0x12345678`; 338 cycle; stats: translations=33, tlbHits=1, pageTableHits=1, refills=1 |
| 6 | `tilelink_verify.mjs` | TileLink UL/UH + bridge + cache | **12/12** ca: cache write-through (miss=1,hit=1), partial-write `0x1122AA44`, atomic ADD/OR, DMA burst, bridge UH↔UL 2 chiều, định tuyến tách bus |
| 7 | `tilelink_backpressure_verify.mjs` | Backpressure kênh A | **4** kịch bản: giữ giao dịch khi `canAccept=false` (forward đúng 1 lần), hook opt-in, gating theo địa chỉ, UL từ chối / UH chấp nhận atomic |
| 8 | `dma_verify.mjs` | DMA — 3 kịch bản | JS-API copy 16 phần tử (dst khớp src, OK), ASM ghi register + poll BUSY, byte-swap; "Transfer completed successfully" |
| 9 | `dma_datapath_verify.mjs` | DMA datapath | **6/6**: word→byte, byte→word pack, fixed-src nhân bản, fixed-dst giữ word cuối, mode-3 lỗi (không treo), byte-swap halfword |
| 10 | `dma_burst_verify.mjs` | DMA burst + latency (UH) | read/write FIFO độc lập; 4 burst × 4 beat mỗi chiều (16 beat); UH latency=2, **8** latency hits; **10/10** regression; 269 cycle |
| 11 | `dma_descriptor_chain_verify.mjs` | Descriptor FIFO | 1 start = 1 descriptor (không auto-chain); start thứ 2 kéo nốt descriptor chờ; FIFO rỗng sau cùng |
| 12 | `uart_dma_flow_verify.mjs` | DMA→UART backpressure | **65/65 byte phát, 0 byte mất**; FIFO high-water 16/16; DMA stall 15.840 cycle khi FIFO đầy; tổng 21.979 cycle |
| 13 | `log_filter_verify.mjs` | Bộ lọc log hệ thống | phân loại 6 dòng mẫu đúng đa-module; entry lưu `module` chính + `modules` đầy đủ đúng thứ tự |
| 14 | `syscall_output_verify.mjs` | Syscall in/exit | `a7=4` in đúng "Hello from syscall!\n"; `a7=93` exit code=0; CPU dừng |

**Cách tái lập tại chỗ (nếu hội đồng yêu cầu):**
```powershell
node test/assembler_verify.mjs
node test/mmu_syscall_verify.mjs
node test/dma_burst_verify.mjs
node test/uart_dma_flow_verify.mjs
# ... (14 script, tất cả exit code 0)
```

### 2.2. Lớp 2 & 3 — Đối chiếu GNU binutils & Spike (chạy lại 14/06/2026 qua WSL)

| Hạng mục | Kết quả (output thật) | Ghi chú |
|---|---|---|
| Đối chiếu mã hóa GNU binutils | **17.978/17.978** từ-lệnh RV32IMF trùng khớp, **0 mismatch**, trên **61** file ELF | 1.456 lệnh CSR/đặc quyền bỏ qua: `csrrw:693, csrrwi:379, csrrs:259, mret:61, unimp:61, fence.i:2, csrrci:1` |
| Bộ mẫu cục bộ | **PASS — 7 nhóm, 83** từ-lệnh khớp hoàn toàn | RV32I R/I/load-store/điều khiển + RV32M + RV32F + rounding-modes; minh họa Bảng 5.1 |
| Đối chiếu thực thi Spike | **PASS 61/61 ELF** (ISA `RV32IMF_zicclsm`, Spike 1.1.1-dev) | mỗi ELF ~90 ms; tham chiếu `~/riscv-tools/bin/spike` |

**Cách tái lập (chạy thẳng từ Windows — script tự bắc cầu sang WSL):**
```powershell
node test/verify_rv32imf_against_gnu.mjs   # → "61 ELF, 17978 ..., 0 mismatch" + "83 instruction words" PASS
node test/verify_riscv_tests_spike.mjs     # → "riscv-tests Spike: PASS (61/61 ELF pass)"
```
Log tươi lưu ở `test-artifacts/eval_run/verify_rv32imf_against_gnu.log` và `verify_riscv_tests_spike.log`. Yêu cầu: máy có **WSL Ubuntu** với `binutils-riscv64-unknown-elf` (cung cấp `as/objdump/objcopy` ở `/usr/bin`) và Spike ở `~/riscv-tools/bin/spike`; `riscv-tests/isa/` đã build 61 ELF (`rv32ui/rv32um/rv32uf-p-*`).

---

## 3. Phần B — Kịch bản demo trước hội đồng (LO4: "kịch bản đánh giá rõ ràng")

> **Chuẩn bị chung (làm 1 lần trước buổi):** chạy `python tools/dev_server.py` (no-cache — KHÔNG dùng `http.server` trần để Chrome không giữ JS cũ), mở `http://localhost:8000/src/`. Mở sẵn các tab: Editor, Registers/Floating Point, Cache, MMU, **SoC diagram**, và khu **I/O** (LED Matrix, UART Console). Nút điều khiển: **Assemble → (Load) → Run / Step / Pause / Stop / Reset**. Phóng to khu I/O cho hội đồng dễ nhìn. **Quay sẵn video từng demo làm dự phòng.**

### Demo 1 — `soc_full_demo.asm` · *Toàn cảnh SoC* (mở màn) — ~90 giây

**Thông điệp:** "Một chương trình RISC-V duy nhất đi qua gần như toàn bộ datapath của SoC."

| Bước | Thao tác | Quan sát kỳ vọng |
|---|---|---|
| 1 | Assemble → Step phần (1): `lw` hai lần cùng địa chỉ | Lần 1 **cache MISS** (fill từ RAM qua TileLink-UH có độ trễ), lần 2 **cache HIT**; `t1=t2=0x12345678` ⇒ rẽ `mem_ok` |
| 2 | Step phần (2) UART | Ký tự **'S'** (ASCII 83) ra UART Console; trace bus đi Core→MMU→UH→bridge→UL→UART |
| 3 | Step phần (3)(4) keyboard/mouse | Đọc polling không chặn; chưa thao tác thì đọc về 0 (giải thích trước: đúng, vì chưa có sự kiện) |
| 4 | Step phần (5) lập trình DMA + Run | DMA copy 4 word RAM→LED; **4 LED đầu sáng đỏ/lục/lam/trắng**; poll cờ DONE (mask `0x40000000`) |
| 5 | Tới `ecall` | Dừng với **`a0=0` (PASS)** |

**Trực quan nhất:** 4 ô LED sáng do DMA + panel cache đổi MISS→HIT giữa hai lần `lw`. **Hỏi/đáp:** vì sao MISS rồi HIT; DMA ra LED đi UL còn nguồn đọc UH (định tuyến theo địa chỉ); không dùng ngắt — polling.

### Demo 2 — `demo_uart_dma.asm` · *DMA → UART có backpressure* (kỹ thuật lõi) — ~90 giây

**Thông điệp:** "DMA gánh việc sao chép thay CPU, và cơ chế điều khiển luồng đảm bảo không mất byte dù DMA nhanh hơn UART."

| Bước | Thao tác | Quan sát kỳ vọng |
|---|---|---|
| 1 | Assemble → Load → Run | UART đặt baud divisor=1 (rất nhanh) để FIFO kịp đầy |
| 2 | Quan sát UART Console | Chuỗi **65 ký tự** `1234...12345` hiện dần; CPU gần như chỉ poll |
| 3 | Lọc log theo DMA/UART | Bộ ba `[DMA][FIFO] READ→MOVE→WRITE`; có giai đoạn **FIFO đầy → DMA stall → drain**; **KHÔNG** có cảnh báo "TX queue full, dropping" |
| 4 | Kết thúc | `a0=0` (PASS); đối chứng dòng lệnh: `node test/uart_dma_flow_verify.mjs` → 65/65 byte, 0 mất, high-water 16/16 |

**Hỏi/đáp:** config `0x18200041` = src word/dst byte/65 phần tử; FIFO đầy thì `a_ready=0` nên DMA giữ giao dịch (backpressure qua `canAcceptTx()`); đồng bộ bằng polling bit DONE + TX-busy.

### Demo 3 — `mouse_demo.asm` · *Tương tác thời gian thực* (trực quan) — ~60 giây

**Thông điệp:** "Ngoại vi MMIO hai chiều, phản hồi tức thời, hoàn toàn bằng polling."

| Bước | Thao tác | Quan sát kỳ vọng |
|---|---|---|
| 1 | Assemble → **Run** (không Step — vòng lặp vô hạn) | Sơ đồ SoC: mũi tên đọc Mouse / ghi LED sáng liên tục qua bridge UH→UL |
| 2 | Rê chuột trên canvas LED | Điểm sáng **xanh lá** di chuyển theo con trỏ |
| 3 | Giữ chuột **trái** / **phải** | Điểm đổi **đỏ** / **xanh dương** (theo bit BTN) |
| 4 | Bấm **Stop** để kết thúc | (Demo này không có `ecall` exit — dừng bằng Stop) |

**Lưu ý:** phải rê/bấm **đúng trên canvas**; điểm có thể "nhảy" vì lấy 5 bit thấp của tọa độ (mod 32) — giải thích trước.
**Thay thế "sơ đồ sống":** `fig_4_13_socdiagram_demo.asm` — Run, để Speed ~30–60, chuyển tab SoC: nhiều đường bus (CPU/cache/UH/UL/DMA/LED/UART) cùng active, badge đếm giao dịch tăng. (Vòng lặp vô hạn; chụp khi đang chạy.)

### Demo 4 (khi được hỏi sâu về MMU) — `mmu_test.asm` · ~45 giây

Assemble → **Step**. `ecall a7=100` map VA `0x5000`→PA `0x10010000`; `sw/lw` qua VA `0x5020`. Mở tab **MMU**: bảng TLB hiện đúng **1 dòng** `VPN=0x5 / PPN=0x10010 / V R W X C`. Log đổi từ `mode=mapped pa=0x10010020` (lần ghi: TLB miss→page-table→refill) sang `src=tlb` (lần đọc: TLB hit). *Halt bằng `a7=0`* (implicit), `a0` giữ `0x5000` — **không** phải mã PASS=0; tiêu chí đúng là `t2=0x12345678` và byte tại PA. Đối chứng: `node test/mmu_syscall_verify.mjs`.

> ⚠️ **Bẫy "a0 ≠ 0":** nhiều demo cố ý dùng `a0` làm **dữ liệu** (tổng/giá trị đọc về), không phải mã lỗi — `dma_demo` (a0=0xDE226598), `dma_led_demo` (a0=2088960), `bus_demo` (a0=0x12345678), `mmu_syscall_test` (a0=0x12345678), `test_cache` (a0=0x11223344). **Chuẩn bị câu giải thích** để hội đồng không tưởng FAIL. Còn `soc_full_demo`, `demo_uart_dma`, `demo_uart`, `led_demo` mới dùng quy ước `a0=0`=PASS.

---

## 4. Phần C — Thư viện 16 demo (bảng tra cứu nhanh)

| Demo | Vai trò | Khối phủ | Kết thúc | Mức |
|---|---|---|---|---|
| `soc_full_demo` | toàn cảnh SoC | CPU·MMU·cache·UH·bridge·UL·UART·KB·mouse·DMA·LED | `a0=0` | ★ core |
| `demo_uart_dma` | DMA→UART backpressure | CPU·DMA·UH·UL·bridge·UART | `a0=0` | ★ core |
| `mouse_demo` | tương tác chuột→LED | CPU·MMU·UH·UL·mouse·LED | Stop (vô hạn) | ★ core |
| `fig_4_13_socdiagram_demo` | sơ đồ bus "sống" | gần toàn bộ datapath | Stop (vô hạn) | ★ core |
| `led_demo` | gradient 32×32 | CPU·UH·bridge·UL·LED | `a0=0` | ★ core |
| `dma_led_demo` | DMA tô LED + CPU song song | CPU·DMA·UH·UL·LED | a0=tổng (≠0) | ★ core |
| `dma_demo` | DMA copy 16B song song | CPU·DMA·UH·RAM | a0=tổng (≠0) | ★ core |
| `demo_uart_input` | echo UART tương tác | CPU·UL·UART(RX/TX) | `a0=0` | ★ core |
| `mmu_test` | map + đọc/ghi qua VA | CPU·MMU·cache·UH | halt a7=0 | ★ core |
| `demo_uart` | DMA copy RAM→RAM 65 word | CPU·DMA·UH·RAM | `a0=0` | backup |
| `bus_demo` | round-trip ghi/đọc 1 word | CPU·MMU·cache·UH·RAM | a0=data (≠0) | backup |
| `mmu_syscall_test` | map/unmap/clear | CPU·MMU·cache·UH | a0=0x12345678 | backup |
| `test_cache` | tranh chấp 1 set + LRU | CPU·L1D·L2·UH | a0=data (≠0) | backup |
| `test_fpu` | FMA/sign/convert RV32F | CPU-F·cache·UH | ebreak | backup |
| `test_keyboard` | echo phím→UART | CPU·UL·KB·UART | vô hạn (Pause) | backup |
| `uart_baud_test` | divisor→baud→timing | CPU·UL·UART | `a0=0` | backup |

*Tên gây nhầm:* `demo_uart.asm` thực ra là **DMA copy RAM→RAM** (không chạm UART) — comment "65 bytes" sai, thực tế **65 word = 260 byte**. Nếu demo, nói rõ.

---

## 5. Phần D — Hỏi/đáp phòng thủ theo mô-đun

**Assembler.** Two-pass; pseudo `li/la/call/ret` giãn đúng; đối chiếu **GNU binutils** trên 17.978 lệnh ⇒ đáng tin. `fence` chỉ mã hóa, CPU chưa thực thi.

**CPU / RV32F.** Subset RV32IMF; 26 lệnh F decode đúng, 4 lệnh execute kiểm chứng. *Giới hạn trung thực:* chưa đủ FCSR/fflags/frm — vì thế `fcvt.w.s(6.5)→7` (Math.round) chứ không truncate; nêu thẳng, không né.

**MMU.** SoC hardcode **4KB, fully-associative TLB** (theo yêu cầu GVHD). *Câu hỏi bẫy:* "test có `tlbWays:2`?" → **class MMU** tổng quát hơn (hỗ trợ set/way để kiểm chứng LRU), nhưng **cấu hình SoC/UI** chốt fully-associative — đây là điểm cần nói rõ để khớp báo cáo. Không có CSR `satp`, không page-walk phần cứng, không trap; địa chỉ chưa map → identity (VA=PA).

**Cache.** L1I/L1D 16 set × 4 way, L2 64 set × 4 way, block 64B, **write-through**, LRU. MMIO non-cacheable (bypass). Chứng minh coherence? **Không** — bus một-giao-dịch, không TL-C.

**TileLink.** Vì sao TileLink? (đơn giản, mở, kênh A/D đủ minh họa). UL vs UH: UH có **burst đa-beat** (beat phải lũy thừa 2), bridge UH↔UL hai chiều; UL từ chối atomic, UH chấp nhận. Chỉ kênh A/D mức giao dịch — không B/C/E.

**DMA.** Descriptor 3-word (src/dst/config), FIFO sâu 8, read/write FIFO **độc lập** (32B), burst thật trên UH (latency=2), polling bit BUSY/DONE (chưa IRQ). 1 start = 1 descriptor (không auto-chain — là hợp đồng, không phải lỗi).

**UART.** Thanh ghi lưu **divisor** (kiểu STM32/ESP32), lõi suy baud; **backpressure** `canAcceptTx()` ⇒ trước đây mất ~49/65 byte, nay **0 byte mất**. Đường ghi trực tiếp của CPU không bị gate.

**AMOADD.W.** Lệnh RV32A *duy nhất*, ngoài tên đề tài, **giữ nguyên theo thống nhất GVHD** — không nhận "hỗ trợ RV32A".

**Vĩ mô.** *Đóng góp/tính mới:* SoC simulator chạy thẳng trên trình duyệt, trực quan hóa datapath (sơ đồ bus sống, log đa-module, bảng TLB/cache) — công cụ dạy/học KTMT & HĐH. *Kiểm chứng:* 3 lớp (unit chạy lại 14/06; mã hóa GNU 17.978/0-sai; thực thi Spike). *Nếu thêm 3 tháng:* IRQ, chế độ đặc quyền/CSR, TL-C coherence, mở rộng CAN (xem Ch6).

---

## 6. Phần E — Checklist ngày bảo vệ & dự phòng

**Trước khi vào phòng:**
- [ ] Chạy lại 14 script Node → xác nhận 14/14 PASS (chụp màn hình làm bằng chứng).
- [ ] Khởi động `tools/dev_server.py`, mở `http://localhost:8000/src/`, **nạp sẵn 3 demo chính** vào editor.
- [ ] Test trên **đúng máy mang đi** + thử độ phân giải máy chiếu; phóng to khu I/O.
- [ ] **Video dự phòng** từng demo + slide ảnh kết quả (đề phòng máy/canvas trục trặc).
- [ ] USB + cloud chứa: source, slides, video, log `eval_run/`.

**Trong lúc demo — quy tắc an toàn:**
- Demo vòng-lặp-vô-hạn (`mouse_demo`, `fig_4_13`, `test_keyboard`) → dùng **Run**, kết thúc bằng **Stop/Pause**, đừng chờ exit.
- Nếu tab SoC giật do log per-cycle → bật `suppressTickLogs` / giảm Speed / dùng Step.
- Nếu một demo lỗi → chuyển ngay sang **đối chứng dòng lệnh** (`node test/<...>_verify.mjs`) để vẫn chứng minh được logic.
- Luôn **Assemble trước khi Run**; chọn đúng tab I/O trước khi chạy demo đồ họa.

**Bất biến trung thực — nhắc lại để không overclaim trong lúc hưng phấn:** RV32IMF tập con · không CSR/đặc quyền/ngắt (polling) · `fence` không thực thi · FPU thiếu FCSR/fflags/frm · TileLink A/D mức giao dịch, bus một-giao-dịch · AMOADD.W ngoài tên đề tài · MMU 4KB fully-assoc · **CAN gác lại đợt này**.
