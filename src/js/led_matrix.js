// js/led_matrix.js
// Module quản lý màn hình LED Matrix mô phỏng

export class LEDMatrix {
    constructor(canvasId, width, height, baseAddress) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error(`Canvas with id '${canvasId}' not found.`);
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        
        // Cấu hình phần cứng giả lập
        this.width = width;         // Số cột (32)
        this.height = height;       // Số hàng (32)
        this.baseAddress = baseAddress; // 0xFF000000
        this.sizeInBytes = this.width * this.height * 4; // Mỗi pixel 4 byte

        // Cấu hình giao diện hiển thị
        this.ledSize = 0;   // Sẽ tính toán lại dựa trên kích thước canvas
        this.gap = 1;       // Khoảng cách giữa các led
        this.padding = 5;   // Lề

        // Bộ nhớ Video (VRAM) riêng của thiết bị
        // Dùng Uint32Array để lưu màu dạng số nguyên cho nhanh
        this.vram = new Uint32Array(this.width * this.height);

        this.calculateLayout();
        this.reset();
    }

    // Tính toán kích thước LED dựa trên kích thước thật của thẻ Canvas
    calculateLayout() {
        const availWidth = this.canvas.width - (this.padding * 2);
        const availHeight = this.canvas.height - (this.padding * 2);
        
        // Tính kích thước tối đa của 1 ô led (bao gồm cả gap)
        const sizeX = availWidth / this.width;
        const sizeY = availHeight / this.height;
        
        // Chọn kích thước nhỏ hơn để ô vuông vức
        const totalSize = Math.min(sizeX, sizeY);
        this.ledSize = totalSize - this.gap;
    }

    reset() {
        this.vram.fill(0); // Xóa bộ nhớ video
        this.clearScreen();
        this.drawAll();    // Vẽ màn hình đen
    }

    clearScreen() {
        this.ctx.fillStyle = '#2d3436'; // Màu nền bảng mạch
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Hàm quan trọng: CPU ghi vào địa chỉ -> Thiết bị vẽ lên màn hình
    writeWord(address, value) {
        // 1. Tính offset (khoảng cách từ địa chỉ base)
        const offset = address - this.baseAddress;
        
        // 2. Kiểm tra an toàn
        if (offset < 0 || offset >= this.sizeInBytes) return;

        // 3. Tính chỉ số pixel
        const pixelIndex = Math.floor(offset / 4);

        // 4. Cập nhật VRAM
        this.vram[pixelIndex] = value;

        // 5. Vẽ lại CHỈ điểm ảnh này (Partial Update)
        const y = Math.floor(pixelIndex / this.width);
        const x = pixelIndex % this.width;
        this.drawPixel(x, y, value);
    }

    drawPixel(x, y, colorValue) {
        // Tách các thành phần màu (Format 0x00RRGGBB)
        const r = (colorValue >> 16) & 0xFF;
        const g = (colorValue >> 8) & 0xFF;
        const b = colorValue & 0xFF;

        // Tính tọa độ vẽ
        const drawX = this.padding + x * (this.ledSize + this.gap);
        const drawY = this.padding + y * (this.ledSize + this.gap);

        this.ctx.beginPath();
        
        // Vẽ hình tròn (LED) hoặc hình vuông
        // Dùng hình vuông bo góc nhẹ cho giống ma trận thực tế
        const radius = 2; 
        this.ctx.roundRect(drawX, drawY, this.ledSize, this.ledSize, radius);

        if (r === 0 && g === 0 && b === 0) {
            // LED tắt
            this.ctx.fillStyle = '#444'; 
            this.ctx.shadowBlur = 0;
        } else {
            // LED sáng
            const colorStr = `rgb(${r},${g},${b})`;
            this.ctx.fillStyle = colorStr;
            // Hiệu ứng phát sáng (Glow)
            this.ctx.shadowColor = colorStr;
            this.ctx.shadowBlur = this.ledSize / 2; 
        }

        this.ctx.fill();
        this.ctx.shadowBlur = 0; // Reset shadow
    }

    drawAll() {
        for (let i = 0; i < this.vram.length; i++) {
            const y = Math.floor(i / this.width);
            const x = i % this.width;
            this.drawPixel(x, y, this.vram[i]);
        }
    }
}