// js/keyboard.js
// Keyboard module
// Memory-mapped I/O peripheral for keyboard input
// Compatible with RARS keyboard MMIO

export class Keyboard {
    constructor(baseAddress) {
        this.baseAddress = baseAddress; // 0xFFFF0000

        // Registers offset from base address
        this.KEYBOARD_CTRL = 0x00; // Read-only: Control register (Bit 0: Ready)
        this.KEYBOARD_DATA = 0x04; // Read-only: Data register (ASCII value)

        // State
        this.buffer = [];      // Key buffer
        this.ready = false;    // Ready bit

        // Callbacks
        this.onUpdate = null;  // Called when state changes (to update UI)
    }

    // Write to Keyboard register
    writeRegister(address, value) {
        // Keyboard registers are generally read-only in this simple model
        // RARS allows writing to control to enable interrupts, but we'll stick to polling for now
        // or just ignore writes.
        console.warn(`[Keyboard] Write to read-only register: 0x${address.toString(16)}`);
    }

    // Read from Keyboard register
    readRegister(address) {
        const offset = address - this.baseAddress;

        switch (offset) {
            case this.KEYBOARD_CTRL:
                // Bit 0: Ready (1 if data available, 0 otherwise)
                return this.buffer.length > 0 ? 1 : 0;

            case this.KEYBOARD_DATA:
                // Return the oldest key from buffer
                if (this.buffer.length > 0) {
                    const charCode = this.buffer.shift();
                    // Ready bit logic: In RARS, reading data clears the ready bit if buffer empty.
                    // Here we check buffer length dynamically in CTRL read.
                    return charCode;
                }
                return 0;

            default:
                console.warn(`[Keyboard] Read from invalid register: 0x${address.toString(16)}`);
                return 0;
        }
    }

    // Called by UI when user presses a key
    pressKey(charCode) {
        this.buffer.push(charCode);
        if (typeof this.onUpdate === 'function') {
            this.onUpdate();
        }
    }

    reset() {
        this.buffer = [];
        this.ready = false;
        if (typeof this.onUpdate === 'function') {
            this.onUpdate();
        }
    }

    isKeyboardAddress(address) {
        return address >= this.baseAddress && address < this.baseAddress + 0x08;
    }
}
