// js/mouse.js
// Simple memory-mapped mouse peripheral for the simulator

export class MousePeripheral {
    constructor(baseAddress) {
        this.baseAddress = baseAddress; // e.g. 0xFF100000
        // Register offsets
        this.MOUSE_X = 0x00;      // Read-only: last X position (pixels relative to canvas)
        this.MOUSE_Y = 0x04;      // Read-only: last Y position
        this.MOUSE_BTN = 0x08;    // Read-only: button state bitmap (bit0=left, bit1=right, bit2=middle)
        this.MOUSE_STATUS = 0x0C; // R/W: bit0=move event, bit1=button change/click
        this.MOUSE_CTRL = 0x10;   // R/W: reserved for future (interrupt enable)

        this.posX = 0;
        this.posY = 0;
        this.buttons = 0;
        this.status = 0;
        this.ctrl = 0;
    }

    isMouseAddress(address) {
        // Device spans 0x14 bytes (up to CTRL)
        return address >= this.baseAddress && address < this.baseAddress + 0x14;
    }

    readRegister(address) {
        const offset = address - this.baseAddress;
        switch (offset) {
            case this.MOUSE_X: return this.posX;
            case this.MOUSE_Y: return this.posY;
            case this.MOUSE_BTN: return this.buttons;
            case this.MOUSE_STATUS: return this.status;
            case this.MOUSE_CTRL: return this.ctrl;
            default:
                console.warn(`[MOUSE] Read from invalid offset 0x${offset.toString(16)}`);
                return 0;
        }
    }

    writeRegister(address, value) {
        const offset = address - this.baseAddress;
        switch (offset) {
            case this.MOUSE_STATUS:
                // Writing clears the bits that are set in value
                this.status &= ~value;
                break;
            case this.MOUSE_CTRL:
                this.ctrl = value;
                break;
            default:
                console.warn(`[MOUSE] Write to read-only/invalid offset 0x${offset.toString(16)}`);
        }
    }

    reportEvent(x, y, buttonMask, isClick) {
        // Clamp to 16-bit unsigned to keep it simple
        this.posX = x & 0xFFFF;
        this.posY = y & 0xFFFF;
        this.buttons = buttonMask & 0x07; // left/right/middle
        // Set status bits: move => bit0, click/button change => bit1
        this.status |= 0x1;
        if (isClick) this.status |= 0x2;
    }

    reset() {
        this.posX = 0;
        this.posY = 0;
        this.buttons = 0;
        this.status = 0;
        this.ctrl = 0;
    }
}
