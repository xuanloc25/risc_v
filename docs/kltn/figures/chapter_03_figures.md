# Hình minh họa Chương 3 (nguồn vẽ)

Tệp này chứa **bản dựng** của 7 hình trong Chương 3, sinh ra từ phần mô tả `[Hình 3.x: …]` trong
[chapter_03.md](../chapters/chapter_03.md). Năm hình sơ đồ (3.1, 3.2, 3.3, 3.4, 3.7) được dựng bằng
**Mermaid** (mã nguồn, sửa và xuất ảnh được); hai hình giao diện (3.5, 3.6) có **wireframe SVG dựng sẵn**
(`fig_3_5_ui_layout.svg`, `fig_3_6_observation_frames.svg`) kèm danh sách nhãn đã đối chiếu với `screenshot.png`,
và có thể thay bằng ảnh chụp màn hình thật khi in báo cáo.

## Cách xem và xuất ảnh

- **Xem nhanh:** mở tệp này trong VS Code (cài tiện ích *Markdown Preview Mermaid Support*) hoặc trên GitHub — các khối ```mermaid``` sẽ tự render.
- **Xuất PNG/SVG để chèn vào Word:** dán từng khối Mermaid vào https://mermaid.live rồi *Export → PNG/SVG*; hoặc lưu khối thành tệp `.mmd` và chạy `npx @mermaid-js/mermaid-cli -i hinh_3_2.mmd -o hinh_3_2.png -s 3` (tùy chọn `-s 3` để tăng độ phân giải).
- **Quy ước màu** (đồng bộ với `docs/ref/SoC.png`): khối chủ động/master = hồng, bộ nhớ & cache = xanh tím, bus TileLink = tím nhạt, ngoại vi MMIO = vàng.

> **Ghi chú trung thực:** nhãn hiển thị của giao diện gọi TileLink-UH là *"coherent bus"*, nhưng hệ thống chỉ hiện thực mức giao dịch kênh A/D (xem mục 2.6.3 và 3.2.1). Trong các hình dưới đây, TileLink-UH được chú là *"bus hiệu năng cao"* để tránh hiểu nhầm về tính nhất quán bộ nhớ đệm.

---

## Hình 3.1 — Sơ đồ use case tổng quát

*Tác nhân chính là Người học; use case "Nạp và chạy" bao hàm «include» "Biên dịch"; use case "Quan sát trạng thái" được mở rộng «extend» bởi các quan sát cụ thể.*

```mermaid
flowchart LR
  actor(("Người học")):::actor
  subgraph SYS["Trình mô phỏng SoC RISC-V"]
    direction TB
    UC1(["Soạn thảo chương trình hợp ngữ"])
    UC2(["Biên dịch chương trình"])
    UC3(["Nạp và chạy chương trình"])
    UC4(["Chạy từng bước & đặt điểm dừng"])
    UC5(["Quan sát trạng thái hệ thống"])
    UC6(["Tương tác thiết bị ngoại vi"])
    UC7(["Cấu hình tham số MMU/Cache"])
    UC8(["Tra cứu hướng dẫn (Help)"])
    UC5a(["Xem thanh ghi"])
    UC5b(["Xem bộ nhớ"])
    UC5c(["Xem bộ nhớ đệm"])
    UC5d(["Xem MMU"])
    UC5e(["Xem sơ đồ SoC & giao dịch bus"])
    UC5f(["Xem nhật ký hệ thống"])
  end
  actor --- UC1
  actor --- UC2
  actor --- UC3
  actor --- UC4
  actor --- UC5
  actor --- UC6
  actor --- UC7
  actor --- UC8
  UC3 -. "«include»" .-> UC2
  UC5a -. "«extend»" .-> UC5
  UC5b -. "«extend»" .-> UC5
  UC5c -. "«extend»" .-> UC5
  UC5d -. "«extend»" .-> UC5
  UC5e -. "«extend»" .-> UC5
  UC5f -. "«extend»" .-> UC5
  classDef actor fill:#ffffff,stroke:#333,stroke-width:2px;
```

---

## Hình 3.2 — Kiến trúc tổng quan SoC Simulator ⭐

*Chuỗi lõi xử lý → MMU → L1I/L1D → L2 → TileLink-UH → {Main Memory, thanh ghi DMA, cầu nối} → TileLink-UL → {UART, LED, Keyboard, Mouse}; DMA là master trên cả hai bus UH và UL.*

```mermaid
flowchart TD
  classDef compute fill:#f8cdcd,stroke:#c0392b,color:#111;
  classDef memory fill:#cdd0f5,stroke:#3b3f8f,color:#111;
  classDef bus fill:#e6d6f0,stroke:#6c3483,color:#111;
  classDef periph fill:#f9f7c5,stroke:#9a8a00,color:#111;

  CPU["RISC-V Core (RV32IMF)"]:::compute
  MMU["MMU (VA → PA, TLB)"]:::memory
  L1I["L1I Cache"]:::memory
  L1D["L1D Cache"]:::memory
  L2["L2 Cache (dùng chung)"]:::memory
  UH["TileLink-UH (bus hiệu năng cao)"]:::bus
  MEM["Main Memory (RAM)"]:::memory
  DMA["DMA Controller"]:::compute
  UL["TileLink-UL (bus ngoại vi)"]:::bus
  UART["UART"]:::periph
  LED["LED Matrix"]:::periph
  KBD["Keyboard"]:::periph
  MOUSE["Mouse"]:::periph

  CPU -->|"cpu-to-mmu"| MMU
  MMU <-->|"mmu-to-l1i"| L1I
  MMU <-->|"mmu-to-l1d"| L1D
  L1I <-->|"l1i-to-l2"| L2
  L1D <-->|"l1d-to-l2"| L2
  L2 <-->|"l2-to-uh"| UH
  UH <-->|"uh-to-main-memory"| MEM
  UH <-->|"uh-to-dma-regs (DMA là slave)"| DMA
  DMA -->|"uh-to-dma (DMA là master)"| UH
  UH <-->|"cầu nối UH ↔ UL"| UL
  DMA -->|"ul-to-dma (DMA là master)"| UL
  UL <-->|"ul-to-uart"| UART
  UL <-->|"ul-to-led"| LED
  UL <-->|"ul-to-keyboard"| KBD
  UL <-->|"ul-to-mouse"| MOUSE
```

---

## Hình 3.3 — Trình tự tick một chu kỳ và lan truyền yêu cầu

*Phần (a): thứ tự tiến bước cố định trong một chu kỳ. Phần (b): một thao tác nạp dữ liệu lan qua nhiều chu kỳ; PC bị đóng băng trong khi chờ phản hồi.*

**(a) Thứ tự tiến bước trong MỘT chu kỳ `simulator.tick()`** (MMU dịch địa chỉ in-line, không có bước tick riêng):

```mermaid
flowchart LR
  C["CPU.tick"] --> D["DMA.tick"] --> I["L1I.tick"] --> DC["L1D.tick"] --> L2["L2.tick"] --> UH["TileLink-UH.tick"] --> UL["TileLink-UL.tick"] --> M["Memory.tick"] --> U["UART.tick"] --> CC(["cycleCount += 1"])
```

**(b) Lan truyền một thao tác nạp dữ liệu qua các chu kỳ:**

```mermaid
sequenceDiagram
  participant CPU
  participant L1D as L1D Cache
  participant L2 as L2 Cache
  participant UH as TileLink-UH
  participant MEM as Main Memory
  Note over CPU: Chu kỳ N — phát Get (load), PC bị đóng băng (stall)
  CPU->>L1D: Get
  L1D->>L2: trượt → chuyển tiếp
  L2->>UH: trượt → chuyển tiếp
  UH->>MEM: Get
  Note over MEM: chờ ≈ độ trễ bộ nhớ (mặc định 20 chu kỳ)
  MEM-->>UH: AccessAckData
  UH-->>L2: dữ liệu (refill)
  L2-->>L1D: dữ liệu (refill)
  L1D-->>CPU: AccessAckData
  Note over CPU: "thực hiện lại" lệnh, ghi thanh ghi, PC tiến tới lệnh kế
```

---

## Hình 3.4 — Mô hình cổng kết nối (Port)

*Bên trái: cổng liên kết điểm–điểm chuyển tiếp yêu cầu xuống và phản hồi lên. Bên phải: cách đăng ký master (upper) và slave (lower, kèm match địa chỉ) vào một bus, cùng cổng memory phục vụ gỡ lỗi.*

```mermaid
flowchart LR
  subgraph A["(a) Cổng liên kết điểm–điểm"]
    direction TB
    CPU["CPU"] -->|"yêu cầu: sendRequest → receiveRequest"| MMU["MMU"]
    MMU -->|"phản hồi: sendResponse → receiveResponse"| CPU
    MMU -->|"yêu cầu"| CACHE["Cache"]
    CACHE -->|"phản hồi"| MMU
  end
  subgraph B["(b) Đăng ký endpoint vào bus host"]
    direction TB
    Pu1["Port.upper: CPU/L2 (master)"] --> UHbus["TileLink-UH"]
    Pu2["Port.upper: DMA (master)"] --> UHbus
    UHbus --> Pl1["Port.lower: Main Memory + match(addr)"]
    UHbus --> Pl2["Port.lower: DMA Regs + match(addr)"]
    UHbus --> Pl3["Port.lower: Bridge → UL + match(addr)"]
    UHbus -.->|"khung nhìn"| Pm["Port.memory: khung nhìn bộ nhớ (gỡ lỗi)"]
  end
```

---

## Hình 3.5 — Giao diện web tổng quan ⭐ (ảnh chụp có chú thích)

> **Cách dựng hình cuối cùng:** dùng ảnh chụp màn hình thật `screenshot.png` (hoặc chụp lại khung **Editor**), chú thích ba khu vực như sơ đồ khung dưới đây. Lưu ý: `screenshot.png` hiện đang hiển thị khung **SoC**; thanh bên và thanh công cụ giống nhau ở mọi khung, nên có thể dùng trực tiếp; riêng phần nội dung chính nên chụp ở khung Editor để khớp mô tả.

**Nhãn đã đối chiếu với `screenshot.png` (khớp chính xác):**
- Thanh công cụ (trái → phải): `ASSEMBLE` · `RESET` · `RUN` · `PAUSE` · `STOP` · `STEP` · thanh trượt `Speed: 1x` · `IPS: 0 Hz`.
- Thanh bên (trên → dưới): `Editor` · `SoC` · `MMU` · `Cache` · `Memory` · `I/O` · `Help`.
- Tiêu đề thẻ trình duyệt: `RISC-V SoC Simulator`.

**Bản SVG dựng sẵn (mở bằng trình duyệt để xem/ xuất PNG hoặc chèn trực tiếp vào Word):**

![Hình 3.5 — Giao diện web tổng quan (wireframe SVG)](fig_3_5_ui_layout.svg)

**Sơ đồ khung (wireframe) bố cục — phương án Mermaid đơn giản hơn:**

```mermaid
flowchart LR
  SB["Thanh bên (dọc):<br/>Editor · SoC · MMU · Cache · Memory · I/O · Help"]
  subgraph MAIN["Vùng chính"]
    direction TB
    TB["Thanh công cụ: Assemble | Reset · Run · Pause · Stop · Step | Speed: 1x | IPS: 0 Hz"]
    subgraph EDV["Khung Editor"]
      direction LR
      subgraph LEFTC["Cột trái"]
        direction TB
        ED["Trình soạn thảo CodeMirror<br/>(số dòng + tô màu cú pháp)"]
        CO["Console / Binary Output"]
      end
      RT["Cột phải — Bảng thanh ghi:<br/>thẻ Registers / Floating Point"]
    end
  end
  SB --- MAIN
```

---

## Hình 3.6 — Các khung quan sát thanh ghi và bộ nhớ (ảnh chụp có chú thích)

> **Cách dựng hình cuối cùng:** chụp khung **Editor** (phần bảng thanh ghi) và khung **Memory**, chú thích các cột như dưới đây. Khi một thanh ghi đổi giá trị sau một bước, ô tương ứng được tô sáng — nên chụp ngay sau một lần Step để thấy hiệu ứng này.

**Nhãn cột đã đối chiếu với `src/index.html`:**
- Thanh ghi số nguyên: `Name` | `Value (Hex)` | `Dec` (x0–x31).
- Thanh ghi dấu phẩy động: `Register` | `Float Value` | `Hex (Bits)` (f0–f31).
- Bộ nhớ lệnh: `Bkpt` | `Address` | `Code` | `Basic` | `Source`.
- Vùng dữ liệu: `Address` | `Value (+0)` … `Value (+1c)`; có ô `Go to Address` và nút `Toggle Hex/ASCII`.

**Bản SVG dựng sẵn (mở bằng trình duyệt để xem/ xuất PNG hoặc chèn trực tiếp vào Word):**

![Hình 3.6 — Các khung quan sát thanh ghi và bộ nhớ (wireframe SVG)](fig_3_6_observation_frames.svg)

**Sơ đồ khung (wireframe) — phương án Mermaid:**

```mermaid
flowchart TB
  subgraph REG["Khung thanh ghi (trong khung Editor)"]
    direction LR
    IR["Registers (số nguyên)<br/>Name | Value (Hex) | Dec<br/>x0 … x31"]
    FR["Floating Point<br/>Register | Float Value | Hex (Bits)<br/>f0 … f31"]
  end
  subgraph MEMV["Khung bộ nhớ (Memory)"]
    direction TB
    IM["Instruction Memory<br/>Bkpt | Address | Code | Basic | Source"]
    DS["Data Segment<br/>Address | +0 +4 +8 … +1c<br/>Go to Address · Toggle Hex/ASCII"]
  end
```

---

## Hình 3.7 — Luồng thực thi chương trình hợp ngữ (đầu–cuối) ⭐

*Sơ đồ hoạt động: nhập mã → assemble (init + 2 lượt) → kiểm tra lỗi → nạp & đặt PC → chọn Run/Step → vòng chạy với điều kiện dừng → cập nhật giao diện; có cung phản hồi về chu trình chỉnh sửa.*

```mermaid
flowchart TD
  Start(["Start"]) --> A["Nhập/chọn mã hợp ngữ"]
  A --> B["Nhấn Assemble"]
  B --> C["Khởi tạo lại SoC (simulator.init)"]
  C --> D["Lượt 1: dựng bảng nhãn, tính địa chỉ/kích thước, xử lý directive"]
  D --> E["Lượt 2: mã hóa lệnh/dữ liệu, ghi little-endian vào ảnh bộ nhớ"]
  E --> F{"Có lỗi?"}
  F -->|"Có"| G["Hiển thị lỗi theo dòng"]
  G --> A
  F -->|"Không"| H["Xác định địa chỉ bắt đầu (_start hoặc lệnh đầu .text)"]
  H --> I["Nạp ảnh bộ nhớ vào RAM, đặt PC, CPU sẵn sàng"]
  I --> J{"Run hay Step?"}
  J -->|"Step"| K["Tiến đúng một lệnh (stepInstruction)"]
  K --> U["Cập nhật giao diện"]
  U --> J
  J -->|"Run"| L["Vòng lặp requestAnimationFrame"]
  L --> Mtick["Mỗi khung hình: thực thi N chu kỳ (tick), đo IPS, cập nhật giao diện"]
  Mtick --> T{"Điểm dừng / halt / vượt max?"}
  T -->|"Chưa"| L
  T -->|"Rồi"| N["Hoàn tất DMA còn dở, cập nhật giao diện cuối"]
  N --> End(["End"])
  End -.->|"chỉnh sửa & chạy lại"| A
  Mtick -.- Note["Mỗi tick: CPU nạp–giải mã–thực thi; phát giao dịch Bus/DMA/Ngoại vi; xử lý ECALL & xuất I/O"]
```

---

## Tình trạng và việc còn lại

| Hình | Dạng | Tình trạng |
|---|---|---|
| 3.1 Use case | Mermaid | Đã dựng — render/xuất ảnh là dùng được |
| 3.2 Kiến trúc tổng quan ⭐ | Mermaid | Đã dựng — đối chiếu khớp `SoC.png` (mở rộng Cache thành L1I/L1D/L2 theo source) |
| 3.3 Trình tự tick | Mermaid (2 phần) | Đã dựng |
| 3.4 Mô hình Port | Mermaid | Đã dựng |
| 3.5 Giao diện tổng quan ⭐ | SVG dựng sẵn + ảnh chụp | Có wireframe `fig_3_5_ui_layout.svg`; nhãn đã đối chiếu `screenshot.png`; bản in cuối có thể thay bằng ảnh chụp khung **Editor** |
| 3.6 Khung quan sát | SVG dựng sẵn + ảnh chụp | Có wireframe `fig_3_6_observation_frames.svg`; nhãn đã đối chiếu `index.html`; bản in cuối có thể thay bằng ảnh chụp khung **Memory** |
| 3.7 Luồng thực thi ⭐ | Mermaid | Đã dựng |

*Lưu ý:* nếu xuất ảnh để in trong báo cáo, nên đặt tên tệp theo số hình (`hinh_3_2.png`, …) và đặt trong thư mục này để dễ tham chiếu từ bản Word/LaTeX cuối cùng.
