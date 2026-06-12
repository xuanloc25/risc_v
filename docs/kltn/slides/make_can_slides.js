const pptxgen = require("pptxgenjs");

// ---- palette: charcoal minimal + teal accent --------------------------------
const INK = "212B32";      // main text
const CHAR = "36454F";     // dark slide bg / strong elements
const MUTED = "5B6770";    // secondary text
const ACCENT = "028090";   // teal accent
const ACCENT_LT = "8FD3D8";// accent on dark bg
const CARD = "F2F4F5";     // light card fill
const CARD_LINE = "DDE3E6";
const CODE_BG = "232B31";
const CODE_TX = "D8E0E5";
const WARN = "9A3B3B";     // muted red for "KHÔNG"/error

const HEAD = "Cambria";
const BODY = "Calibri";
const MONO = "Consolas";

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10 x 5.625 in
pres.author = "KLTN - SoC RISC-V Simulator";
pres.title = "Ngoai vi CAN trong trinh mo phong SoC RISC-V";

function pageNum(slide, n) {
    slide.addText(String(n), {
        x: 9.45, y: 5.28, w: 0.4, h: 0.3, fontSize: 10, fontFace: BODY,
        color: MUTED, align: "right", margin: 0
    });
}

function slideTitle(slide, text) {
    slide.addText(text, {
        x: 0.5, y: 0.28, w: 9.0, h: 0.55, fontSize: 26, fontFace: HEAD,
        bold: true, color: INK, margin: 0, valign: "middle"
    });
}

function card(slide, x, y, w, h) {
    slide.addShape(pres.shapes.RECTANGLE, {
        x, y, w, h, fill: { color: CARD }, line: { color: CARD_LINE, width: 1 }
    });
}

// ============================================================ S1 — title (dark)
{
    const s = pres.addSlide();
    s.background = { color: CHAR };
    s.addText("Ngoại vi CAN", {
        x: 0.5, y: 1.05, w: 9, h: 0.95, fontSize: 44, fontFace: HEAD, bold: true,
        color: "FFFFFF", align: "center", margin: 0
    });
    s.addText("trong trình mô phỏng SoC RISC-V", {
        x: 0.5, y: 2.0, w: 9, h: 0.55, fontSize: 24, fontFace: HEAD,
        color: ACCENT_LT, align: "center", margin: 0
    });

    // CPU -> TileLink -> CAN chip row
    const chips = ["CPU", "MMU", "TileLink-UH", "Bridge", "TileLink-UL", "CAN"];
    const cw = 1.18, gap = 0.34;
    const total = chips.length * cw + (chips.length - 1) * gap;
    let cx = (10 - total) / 2;
    chips.forEach((label, i) => {
        const isCan = label === "CAN";
        s.addShape(pres.shapes.RECTANGLE, {
            x: cx, y: 3.05, w: cw, h: 0.5,
            fill: { color: isCan ? ACCENT : CHAR },
            line: { color: isCan ? ACCENT : "8C9BA5", width: 1 }
        });
        s.addText(label, {
            x: cx, y: 3.05, w: cw, h: 0.5, fontSize: 11, fontFace: BODY, bold: isCan,
            color: "FFFFFF", align: "center", valign: "middle", margin: 0
        });
        if (i < chips.length - 1) {
            s.addText("→", {
                x: cx + cw, y: 3.05, w: gap, h: 0.5, fontSize: 13, color: "8C9BA5",
                align: "center", valign: "middle", margin: 0
            });
        }
        cx += cw + gap;
    });

    s.addText("CAN controller mức frame/message qua MMIO  ·  0xFF200000  ·  TileLink-UL", {
        x: 0.5, y: 3.85, w: 9, h: 0.35, fontSize: 13, fontFace: MONO,
        color: "C3CDD3", align: "center", margin: 0
    });
    s.addText("Báo cáo Khóa luận tốt nghiệp  ·  demo trực tiếp trên web simulator", {
        x: 0.5, y: 4.65, w: 9, h: 0.35, fontSize: 13, fontFace: BODY, italic: true,
        color: "9FB0B9", align: "center", margin: 0
    });
}

// ============================================================ S2 — CAN là gì?
{
    const s = pres.addSlide();
    s.background = { color: "FFFFFF" };
    slideTitle(s, "CAN là gì?");

    const items = [
        ["Nguồn gốc: ", "Bosch phát triển cho ô tô; CAN Specification 2.0 (1991), chuẩn hóa ISO 11898."],
        ["Message-based: ", "frame mang CAN ID 11 bit — ID vừa là ý nghĩa dữ liệu, vừa là độ ưu tiên."],
        ["Multi-master, broadcast: ", "node nào cũng phát được khi bus rảnh; mọi node tự lọc frame theo ID."],
        ["Arbitration không phá hủy: ", "bit dominant (0) thắng recessive (1) → ID nhỏ hơn ưu tiên cao hơn."],
        ["Tin cậy cao: ", "CRC 15 bit, ACK slot, bit stuffing, error counters."],
    ];
    const runs = [];
    items.forEach(([b, t], i) => {
        runs.push({ text: b, options: { bold: true, color: ACCENT, bullet: true } });
        runs.push({ text: t, options: { color: INK, breakLine: true } });
    });
    s.addText(runs, {
        x: 0.5, y: 1.05, w: 5.3, h: 3.0, fontSize: 13, fontFace: BODY,
        paraSpaceAfter: 10, valign: "top", margin: 0
    });

    s.addText([
        { text: "Ranh giới mô phỏng của đề tài: ", options: { bold: true, color: INK } },
        { text: "phần mềm không chạm bit trên dây — nó chỉ đọc/ghi thanh ghi của CAN controller. Project mô phỏng đúng ranh giới này.", options: { color: INK } }
    ], { x: 0.5, y: 4.35, w: 5.3, h: 0.95, fontSize: 12.5, fontFace: BODY, valign: "top", margin: 0 });

    // right: 3-node bus sketch
    const bx = 6.2, bw = 3.3;
    ["Node A", "Node B", "Node C"].forEach((n, i) => {
        const nx = bx + i * (bw - 0.9) / 2;
        s.addShape(pres.shapes.RECTANGLE, {
            x: nx, y: 1.25, w: 0.9, h: 0.5, fill: { color: "FFFFFF" }, line: { color: CHAR, width: 1.25 }
        });
        s.addText(n, { x: nx, y: 1.25, w: 0.9, h: 0.5, fontSize: 10, fontFace: BODY, color: INK, align: "center", valign: "middle", margin: 0 });
        s.addShape(pres.shapes.LINE, { x: nx + 0.45, y: 1.75, w: 0, h: 0.85, line: { color: CHAR, width: 1.25 } });
    });
    s.addShape(pres.shapes.LINE, { x: bx - 0.15, y: 2.6, w: bw + 0.3, h: 0, line: { color: ACCENT, width: 3 } });
    s.addShape(pres.shapes.LINE, { x: bx - 0.15, y: 2.74, w: bw + 0.3, h: 0, line: { color: ACCENT, width: 3 } });
    s.addText("CAN_H / CAN_L (cặp dây vi sai)", {
        x: bx - 0.15, y: 2.86, w: bw + 0.3, h: 0.3, fontSize: 10, fontFace: BODY, color: MUTED, align: "center", margin: 0
    });
    [bx - 0.15, bx + bw + 0.01].forEach((tx) => {
        s.addShape(pres.shapes.RECTANGLE, { x: tx, y: 2.57, w: 0.14, h: 0.2, fill: { color: CHAR }, line: { color: CHAR, width: 0.5 } });
    });
    s.addText("120Ω hai đầu bus · mọi node cùng thấy frame, lọc theo ID", {
        x: bx - 0.3, y: 3.35, w: bw + 0.6, h: 0.3, fontSize: 10, fontFace: BODY, italic: true, color: MUTED, align: "center", margin: 0
    });
    pageNum(s, 2);
}

// ============================================================ S3 — phạm vi
{
    const s = pres.addSlide();
    s.background = { color: "FFFFFF" };
    slideTitle(s, "Phạm vi mô hình trong project");

    card(s, 0.5, 1.0, 4.45, 3.0);
    s.addText("CÓ", { x: 0.75, y: 1.15, w: 3.9, h: 0.35, fontSize: 15, fontFace: HEAD, bold: true, color: ACCENT, margin: 0 });
    s.addText([
        { text: "Standard ID 11 bit (0x000–0x7FF)", options: { bullet: true, breakLine: true } },
        { text: "DLC 0–8, payload tối đa 8 byte", options: { bullet: true, breakLine: true } },
        { text: "1 TX mailbox + 1 RX mailbox", options: { bullet: true, breakLine: true } },
        { text: "Loopback — tự nhận frame mình phát", options: { bullet: true, breakLine: true } },
        { text: "Cờ ERROR + lệnh CLEAR_ERROR", options: { bullet: true, breakLine: true } },
        { text: "Inject frame nhận từ giao diện web", options: { bullet: true } },
    ], { x: 0.75, y: 1.55, w: 4.0, h: 2.7, fontSize: 12.5, fontFace: BODY, color: INK, paraSpaceAfter: 7, valign: "top", margin: 0 });

    card(s, 5.15, 1.0, 4.35, 3.0);
    s.addText("KHÔNG (chủ đích)", { x: 5.4, y: 1.15, w: 3.9, h: 0.35, fontSize: 15, fontFace: HEAD, bold: true, color: WARN, margin: 0 });
    s.addText([
        { text: "Physical layer (CAN_H/CAN_L, transceiver)", options: { bullet: true, breakLine: true } },
        { text: "Bit stuffing, CRC, ACK slot", options: { bullet: true, breakLine: true } },
        { text: "Arbitration bit-level (chỉ có 1 node)", options: { bullet: true, breakLine: true } },
        { text: "Extended ID 29 bit, CAN FD", options: { bullet: true, breakLine: true } },
        { text: "Ngắt — toàn hệ thống dùng polling", options: { bullet: true } },
    ], { x: 5.4, y: 1.55, w: 3.9, h: 2.7, fontSize: 12.5, fontFace: BODY, color: INK, paraSpaceAfter: 7, valign: "top", margin: 0 });

    s.addText([
        { text: "Lý do: ", options: { bold: true, italic: true, color: INK } },
        { text: "mục tiêu đề tài là kiến trúc SoC và luồng dữ liệu trên bus — mô phỏng đúng ranh giới phần mềm nhìn thấy. Mọi giới hạn ghi rõ trong báo cáo (mục 1.3.2, 4.6.3, 6.2).", options: { italic: true, color: MUTED } }
    ], { x: 0.5, y: 4.3, w: 9.0, h: 0.7, fontSize: 12, fontFace: BODY, valign: "top", margin: 0 });
    pageNum(s, 3);
}

// ============================================================ S4 — vị trí trong SoC
{
    const s = pres.addSlide();
    s.background = { color: "FFFFFF" };
    slideTitle(s, "Vị trí CAN trong SoC");

    const boxes = [
        ["CPU", "lw / sw"],
        ["MMU", "cacheable=false"],
        ["L1D", "BYPASS"],
        ["TileLink-UH", "bus tốc độ cao"],
        ["Bridge", "UH → UL"],
        ["TileLink-UL", "bus ngoại vi"],
        ["CAN", "0xFF200000"],
    ];
    const bw = 1.06, gap = 0.34;
    const total = boxes.length * bw + (boxes.length - 1) * gap;
    let x = (10 - total) / 2;
    boxes.forEach(([label, sub], i) => {
        const isCan = label === "CAN";
        s.addShape(pres.shapes.RECTANGLE, {
            x, y: 1.35, w: bw, h: 0.62,
            fill: { color: isCan ? ACCENT : "FFFFFF" },
            line: { color: isCan ? ACCENT : CHAR, width: 1.25 }
        });
        s.addText(label, {
            x, y: 1.35, w: bw, h: 0.62, fontSize: 10.5, fontFace: BODY, bold: true,
            color: isCan ? "FFFFFF" : INK, align: "center", valign: "middle", margin: 0
        });
        s.addText(sub, {
            x: x - 0.12, y: 2.0, w: bw + 0.24, h: 0.3, fontSize: 8.5, fontFace: MONO,
            color: MUTED, align: "center", margin: 0
        });
        if (i < boxes.length - 1) {
            s.addText("→", { x: x + bw - 0.02, y: 1.35, w: gap + 0.04, h: 0.62, fontSize: 12, color: MUTED, align: "center", valign: "middle", margin: 0 });
        }
        x += bw + gap;
    });

    s.addText("Base 0xFF200000–0xFF2000FF  ·  256 byte  ·  non-cacheable  ·  TileLink-UL", {
        x: 0.5, y: 2.55, w: 9, h: 0.32, fontSize: 12, fontFace: MONO, color: INK, align: "center", margin: 0
    });

    card(s, 0.5, 3.15, 9.0, 1.75);
    s.addText([
        { text: "Một lệnh sw/lw tới vùng CAN đi qua đủ các tầng: ", options: { color: INK } },
        { text: "MMU đánh dấu non-cacheable → dữ liệu bỏ qua cache → TileLink-UH → cầu nối → TileLink-UL → endpoint CAN, rồi AccessAck/AccessAckData quay về CPU.", options: { color: INK, breakLine: true } },
        { text: "Ý nghĩa: CAN chứng minh toàn bộ đường ngoại vi của SoC hoạt động — từ CPU xuống thiết bị.", options: { bold: true, color: ACCENT } }
    ], { x: 0.8, y: 3.4, w: 8.4, h: 1.3, fontSize: 13, fontFace: BODY, paraSpaceAfter: 8, valign: "top", margin: 0 });
    pageNum(s, 4);
}

// ============================================================ S5 — register map
{
    const s = pres.addSlide();
    s.background = { color: "FFFFFF" };
    slideTitle(s, "Bản đồ thanh ghi (register map)");

    const hdr = { fill: { color: CHAR }, color: "FFFFFF", bold: true, fontFace: BODY, fontSize: 11 };
    const mono = { fontFace: MONO, fontSize: 10.5, color: INK };
    const body = { fontFace: BODY, fontSize: 10.5, color: INK };
    const rows = [
        [{ text: "Offset", options: hdr }, { text: "Thanh ghi", options: hdr }, { text: "Quyền", options: hdr }, { text: "Ý nghĩa", options: hdr }],
        [{ text: "0x00", options: mono }, { text: "CTRL", options: mono }, { text: "R/W", options: body }, { text: "bit0 EN · bit1 SOFT_RESET · bit2 LOOPBACK", options: body }],
        [{ text: "0x04", options: mono }, { text: "STATUS", options: mono }, { text: "R", options: body }, { text: "bit0 TX_READY · bit1 RX_AVAILABLE · bit2 ERROR", options: body }],
        [{ text: "0x20", options: mono }, { text: "TX_ID", options: mono }, { text: "R/W", options: body }, { text: "Identifier 11 bit của frame phát (0x000–0x7FF)", options: body }],
        [{ text: "0x24", options: mono }, { text: "TX_DLC", options: mono }, { text: "R/W", options: body }, { text: "Số byte dữ liệu, hợp lệ 0–8", options: body }],
        [{ text: "0x28 / 0x2C", options: mono }, { text: "TX_DATA0/1", options: mono }, { text: "R/W", options: body }, { text: "Payload byte 0–3 / 4–7 (little-endian)", options: body }],
        [{ text: "0x30", options: mono }, { text: "CMD", options: mono }, { text: "W", options: body }, { text: "bit0 SEND · bit1 CLEAR_ERROR", options: body }],
        [{ text: "0x40 / 0x44", options: mono }, { text: "RX_ID / RX_DLC", options: mono }, { text: "R", options: body }, { text: "ID và DLC của frame trong RX mailbox", options: body }],
        [{ text: "0x48 / 0x4C", options: mono }, { text: "RX_DATA0/1", options: mono }, { text: "R", options: body }, { text: "Payload của frame nhận", options: body }],
        [{ text: "0x50", options: mono }, { text: "RX_POP", options: mono }, { text: "W", options: body }, { text: "Ghi 1 → xóa frame, giải phóng RX mailbox", options: body }],
    ];
    s.addTable(rows, {
        x: 0.5, y: 1.0, w: 9.0, colW: [1.25, 1.7, 0.85, 5.2],
        border: { pt: 0.75, color: CARD_LINE }, rowH: 0.34, valign: "middle",
        fill: { color: "FFFFFF" }, margin: 0.06
    });

    s.addText("Ví dụ little-endian:  11 22 33 44 55 66 77 88  →  TX_DATA0 = 0x44332211   TX_DATA1 = 0x88776655", {
        x: 0.5, y: 4.85, w: 9, h: 0.35, fontSize: 11.5, fontFace: MONO, color: ACCENT, align: "center", margin: 0
    });
    pageNum(s, 5);
}

// ============================================================ S6 — cơ chế hoạt động
{
    const s = pres.addSlide();
    s.background = { color: "FFFFFF" };
    slideTitle(s, "Cơ chế hoạt động");

    card(s, 0.5, 1.0, 4.45, 3.55);
    s.addText("Luồng phát (TX)", { x: 0.75, y: 1.15, w: 3.9, h: 0.35, fontSize: 14, fontFace: HEAD, bold: true, color: ACCENT, margin: 0 });
    s.addText([
        { text: "Ghi CTRL = EN | LOOPBACK", options: { bullet: { type: "number" }, breakLine: true } },
        { text: "Nạp TX_ID, TX_DLC, TX_DATA0/1", options: { bullet: { type: "number" }, breakLine: true } },
        { text: "Ghi CMD.SEND", options: { bullet: { type: "number" }, breakLine: true } },
        { text: "Controller kiểm tra: EN bật, ID ≤ 0x7FF, DLC ≤ 8 — vi phạm → ERROR, không phát", options: { bullet: { type: "number" }, breakLine: true } },
        { text: "Loopback bật → frame được đưa ngược về RX mailbox (tự test với 1 node)", options: { bullet: { type: "number" } } },
    ], { x: 0.75, y: 1.55, w: 4.0, h: 2.9, fontSize: 12.5, fontFace: BODY, color: INK, paraSpaceAfter: 10, valign: "top", margin: 0 });

    card(s, 5.15, 1.0, 4.35, 1.5);
    s.addText("Luồng nhận (RX)", { x: 5.4, y: 1.15, w: 3.9, h: 0.35, fontSize: 14, fontFace: HEAD, bold: true, color: ACCENT, margin: 0 });
    s.addText([
        { text: "Poll STATUS.RX_AVAILABLE", options: { bullet: { type: "number" }, breakLine: true } },
        { text: "Đọc RX_ID, RX_DLC, RX_DATA0/1", options: { bullet: { type: "number" }, breakLine: true } },
        { text: "Ghi RX_POP = 1 → giải phóng mailbox", options: { bullet: { type: "number" } } },
    ], { x: 5.4, y: 1.52, w: 3.9, h: 0.9, fontSize: 12, fontFace: BODY, color: INK, paraSpaceAfter: 4, valign: "top", margin: 0 });

    card(s, 5.15, 2.85, 4.35, 1.7);
    s.addText("Quy tắc lỗi", { x: 5.4, y: 3.0, w: 3.9, h: 0.35, fontSize: 14, fontFace: HEAD, bold: true, color: WARN, margin: 0 });
    s.addText([
        { text: "RX mailbox giữ đúng 1 frame: mailbox đầy → frame mới bị từ chối, ERROR bật, frame cũ giữ nguyên", options: { bullet: true, breakLine: true } },
        { text: "ERROR là cờ sticky — xóa bằng CMD.CLEAR_ERROR hoặc CTRL.SOFT_RESET", options: { bullet: true } },
    ], { x: 5.4, y: 3.4, w: 3.9, h: 1.05, fontSize: 12, fontFace: BODY, color: INK, paraSpaceAfter: 6, valign: "top", margin: 0 });
    pageNum(s, 6);
}

// ============================================================ S7 — demo 1
{
    const s = pres.addSlide();
    s.background = { color: "FFFFFF" };
    slideTitle(s, "Demo 1 — Loopback bằng chương trình assembly");

    card(s, 0.5, 1.0, 4.45, 3.5);
    s.addText("Các bước thao tác", { x: 0.75, y: 1.15, w: 3.9, h: 0.35, fontSize: 14, fontFace: HEAD, bold: true, color: ACCENT, margin: 0 });
    s.addText([
        { text: "Nạp test/can_loopback.asm → bấm ASSEMBLE", options: { bullet: { type: "number" }, breakLine: true } },
        { text: "Mở tab I/O, quan sát card CAN Controller", options: { bullet: { type: "number" }, breakLine: true } },
        { text: "RUN — hoặc STEP và dừng ngay sau CMD.SEND để thấy frame đang nằm trong RX mailbox", options: { bullet: { type: "number" }, breakLine: true } },
        { text: "Chương trình tự poll, đọc lại 4 thanh ghi RX, so sánh từng giá trị rồi RX_POP", options: { bullet: { type: "number" } } },
    ], { x: 0.75, y: 1.55, w: 4.0, h: 2.8, fontSize: 12, fontFace: BODY, color: INK, paraSpaceAfter: 8, valign: "top", margin: 0 });

    card(s, 5.15, 1.0, 4.35, 3.5);
    s.addText("Kỳ vọng trên UI", { x: 5.4, y: 1.15, w: 3.9, h: 0.35, fontSize: 14, fontFace: HEAD, bold: true, color: ACCENT, margin: 0 });
    s.addText("Latest TX frame:", { x: 5.4, y: 1.6, w: 3.9, h: 0.28, fontSize: 11.5, fontFace: BODY, bold: true, color: INK, margin: 0 });
    s.addText("STD ID=0x123 DLC=8\nDATA=11 22 33 44 55 66 77 88", {
        x: 5.4, y: 1.9, w: 3.9, h: 0.6, fontSize: 11, fontFace: MONO, color: ACCENT, margin: 0
    });
    s.addText("Trạng thái sau khi chạy hết:", { x: 5.4, y: 2.62, w: 3.9, h: 0.28, fontSize: 11.5, fontFace: BODY, bold: true, color: INK, margin: 0 });
    s.addText("EN ON · LOOPBACK ON · TX_READY ON\nRX_AVAILABLE OFF (đã pop) · ERROR OFF", {
        x: 5.4, y: 2.92, w: 3.9, h: 0.6, fontSize: 11, fontFace: MONO, color: INK, margin: 0
    });
    s.addText("Exit code:  a0 = 0  (a0 = 1..5 chỉ ra đúng bước bị sai)", {
        x: 5.4, y: 3.62, w: 3.9, h: 0.55, fontSize: 11.5, fontFace: BODY, color: INK, margin: 0
    });

    s.addText("Frame demo: ID 0x123 · DLC 8 · payload 11 22 33 44 55 66 77 88 — CPU gửi rồi tự nhận lại qua loopback, so sánh từng thanh ghi.", {
        x: 0.5, y: 4.72, w: 9, h: 0.55, fontSize: 12, fontFace: BODY, italic: true, color: MUTED, margin: 0
    });
    pageNum(s, 7);
}

// ============================================================ S8 — demo 2 & 3
{
    const s = pres.addSlide();
    s.background = { color: "FFFFFF" };
    slideTitle(s, "Demo 2 & 3 — Inject frame từ UI, lỗi mailbox đầy");

    card(s, 0.5, 1.0, 4.45, 3.85);
    s.addText("Demo 2 · Inject frame nhận", { x: 0.75, y: 1.15, w: 4.0, h: 0.35, fontSize: 14, fontFace: HEAD, bold: true, color: ACCENT, margin: 0 });
    s.addText("Nhập trên card CAN Controller (tab I/O):", { x: 0.75, y: 1.58, w: 4.0, h: 0.28, fontSize: 11.5, fontFace: BODY, color: INK, margin: 0 });
    s.addText("ID hex: 321   DLC: 3\nPayload: 01 02 03   → bấm Inject RX", {
        x: 0.75, y: 1.88, w: 4.0, h: 0.6, fontSize: 11, fontFace: MONO, color: INK, margin: 0
    });
    s.addText("Kết quả:", { x: 0.75, y: 2.6, w: 4.0, h: 0.28, fontSize: 11.5, fontFace: BODY, bold: true, color: INK, margin: 0 });
    s.addText("RX_AVAILABLE = ON\nRX mailbox: STD ID=0x321 DLC=3 DATA=01 02 03", {
        x: 0.75, y: 2.9, w: 4.0, h: 0.6, fontSize: 11, fontFace: MONO, color: ACCENT, margin: 0
    });
    s.addText("Inject = mô phỏng node CAN bên ngoài gửi frame tới — không cần node thứ hai.", {
        x: 0.75, y: 3.62, w: 4.0, h: 0.85, fontSize: 11.5, fontFace: BODY, italic: true, color: MUTED, valign: "top", margin: 0
    });

    card(s, 5.15, 1.0, 4.35, 3.85);
    s.addText("Demo 3 · Tràn RX mailbox", { x: 5.4, y: 1.15, w: 3.9, h: 0.35, fontSize: 14, fontFace: HEAD, bold: true, color: WARN, margin: 0 });
    s.addText("Inject tiếp một frame khi frame trước chưa được pop:", {
        x: 5.4, y: 1.58, w: 3.9, h: 0.5, fontSize: 11.5, fontFace: BODY, color: INK, valign: "top", margin: 0
    });
    s.addText("“CAN rejected the frame because\nthe RX mailbox is occupied.”", {
        x: 5.4, y: 2.12, w: 3.9, h: 0.6, fontSize: 11, fontFace: MONO, color: WARN, margin: 0
    });
    s.addText("ERROR = ON · frame cũ giữ nguyên", {
        x: 5.4, y: 2.84, w: 3.9, h: 0.3, fontSize: 11, fontFace: MONO, color: INK, margin: 0
    });
    s.addText("Minh họa tràn buffer ở mức đơn giản nhất: RX mailbox chỉ giữ 1 frame nên phần mềm phải đọc và pop kịp thời.", {
        x: 5.4, y: 3.3, w: 3.9, h: 1.1, fontSize: 11.5, fontFace: BODY, italic: true, color: MUTED, valign: "top", margin: 0
    });
    pageNum(s, 8);
}

// ============================================================ S9 — log
{
    const s = pres.addSlide();
    s.background = { color: "FFFFFF" };
    slideTitle(s, "Bằng chứng trong log hệ thống");

    s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 1.0, w: 9.0, h: 1.7, fill: { color: CODE_BG }, line: { color: CODE_BG, width: 0 } });
    s.addText([
        { text: "[MMU] REQUEST … va=0xff200000 -> pa=0xff200000 cacheable=false", options: { breakLine: true } },
        { text: "[L1D Cache] BYPASS_WRITE addr=0xff200000", options: { breakLine: true } },
        { text: "[uh-to-ul-bridge] BRIDGE_DIRECT_WRITE TileLink-UH->TileLink-UL addr=0xff200000 data=0x5", options: { breakLine: true } },
        { text: "[TileLink-UL] TileLink -> CAN Controller DIRECT_WRITE addr=0xff200000 data=0x5", options: { breakLine: true } },
        { text: "[TileLink-UL] CAN Controller -> TileLink DIRECT_READ_DATA addr=0xff200004 data=3", options: {} },
    ], { x: 0.75, y: 1.0, w: 8.5, h: 1.7, fontSize: 10.5, fontFace: MONO, color: CODE_TX, paraSpaceAfter: 5, valign: "middle", margin: 0 });

    s.addText([
        { text: "cacheable=false + BYPASS_WRITE: ", options: { bold: true, color: ACCENT, bullet: true } },
        { text: "thanh ghi thiết bị không bị đưa vào cache.", options: { color: INK, breakLine: true } },
        { text: "data=0x5 = EN | LOOPBACK: ", options: { bold: true, color: ACCENT, bullet: true } },
        { text: "giá trị ghi CTRL đi tới đúng thiết bị, qua bridge UH→UL.", options: { color: INK, breakLine: true } },
        { text: "data=3 = TX_READY | RX_AVAILABLE: ", options: { bold: true, color: ACCENT, bullet: true } },
        { text: "STATUS đọc về đúng lúc vòng poll wait_rx thoát.", options: { color: INK } },
    ], { x: 0.5, y: 3.0, w: 9.0, h: 1.25, fontSize: 12.5, fontFace: BODY, paraSpaceAfter: 7, valign: "top", margin: 0 });

    s.addText("Request đi thật từ CPU qua MMU → UH → bridge → UL → CAN — không phải demo giả lập trên UI.", {
        x: 0.5, y: 4.55, w: 9, h: 0.4, fontSize: 13, fontFace: BODY, bold: true, color: INK, align: "center", margin: 0
    });
    pageNum(s, 9);
}

// ============================================================ S10 — kiểm thử / tham khảo / hạn chế (dark)
{
    const s = pres.addSlide();
    s.background = { color: CHAR };
    s.addText("Kiểm thử · Tham khảo · Hạn chế", {
        x: 0.5, y: 0.32, w: 9, h: 0.55, fontSize: 26, fontFace: HEAD, bold: true, color: "FFFFFF", margin: 0, valign: "middle"
    });

    const colW = 2.93, gap = 0.1;
    const cols = [
        {
            h: "Kiểm thử — đều PASS",
            items: [
                "can_verify.mjs: unit test toàn bộ thanh ghi + các trường hợp lỗi",
                "can_mmio_verify.mjs: chạy assembly qua toàn SoC, exit 0 sau 354 chu kỳ",
                "Ba lớp bằng chứng: UI + chương trình assembly + log bus",
            ],
        },
        {
            h: "Tài liệu tham khảo",
            items: [
                "Bosch M_CAN User's Manual v3.3.1 — cấu trúc controller: Tx/Rx Buffer Element, loopback TEST.LBCK",
                "Bosch CAN Specification 2.0 (1991) / ISO 11898-1 — lý thuyết giao thức",
            ],
        },
        {
            h: "Hạn chế & hướng phát triển",
            items: [
                "Chưa có đa node, arbitration, bit-level — giới hạn chủ đích, ghi rõ trong báo cáo",
                "Hướng phát triển: nhiều node CAN ảo, mô hình lỗi chi tiết hơn",
            ],
        },
    ];
    cols.forEach((c, i) => {
        const x = 0.5 + i * (colW + gap * 2);
        s.addText(c.h, { x, y: 1.15, w: colW, h: 0.6, fontSize: 14.5, fontFace: HEAD, bold: true, color: ACCENT_LT, valign: "top", margin: 0 });
        s.addText(
            c.items.map((t, j) => ({ text: t, options: { bullet: true, breakLine: j < c.items.length - 1 } })),
            { x, y: 1.8, w: colW, h: 2.9, fontSize: 12, fontFace: BODY, color: "E8EDEF", paraSpaceAfter: 9, valign: "top", margin: 0 }
        );
    });

    s.addText("Demo trực tiếp: web simulator · tab I/O · sơ đồ SoC · Systems Log Console", {
        x: 0.5, y: 4.95, w: 9, h: 0.35, fontSize: 12, fontFace: BODY, italic: true, color: "9FB0B9", align: "center", margin: 0
    });
}

pres.writeFile({ fileName: "D:/STUDY/UIT/DoAn1/web/assembler/docs/kltn/slides/bao_cao_CAN.pptx" })
    .then(() => console.log("OK: bao_cao_CAN.pptx written"));
