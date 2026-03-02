// js/uart.js
// UART (Universal Asynchronous Receiver-Transmitter) module
// Memory-mapped I/O peripheral for serial communication

export class UART {
    constructor(baseAddress) {
        this.baseAddress = baseAddress; // 0x10000000
        
        // Registers offset from base address
        this.UART_TX = 0x00;      // Write-only: Transmit data
        this.UART_RX = 0x04;      // Read-only: Receive data
        this.UART_STATUS = 0x08;  // Read-only: Status register
        this.UART_CTRL = 0x0C;    // Read/Write: Control register
        this.UART_BAUD = 0x10;    // Read/Write: Baud rate divisor
        
        // Buffers
        this.txBuffer = [];       // Output buffer (characters sent to console)
        this.rxBuffer = [];       // Input buffer (characters from user input)
        
        // Status flags
        this.txReady = true;      // TX ready to accept new character
        this.rxAvailable = false; // RX has data available
        
        // Control flags
        this.txInterruptEnable = false;
        this.rxInterruptEnable = false;
        
        // Baud rate configuration (giống UART thực tế)
        this.peripheralClock = 48000000;  // 48 MHz UART peripheral clock (riêng với CPU clock)
        this.oversampling = 16;           // Oversampling 16x (chuẩn UART)
        this.baudDivisor = 26;            // Default divisor cho 115200 baud
        this.baudRate = this.peripheralClock / (this.oversampling * this.baudDivisor); // ~115200
        this.cpuFrequency = 100000000;    // 100 MHz CPU clock (để tính cycles)
        this.bitsPerFrame = 10;           // START + 8 data + STOP
        this.txCyclesRemaining = 0;       // Cycles until TX ready again
        this.rxCyclesRemaining = 0;       // Cycles until RX ready
        
        // Callbacks for UI updates
        this.onTransmit = null;   // Called when character is transmitted
        this.onReceive = null;    // Called when character is received
    }
    
    // Write to UART register
    writeRegister(address, value) {
        const offset = address - this.baseAddress;
        
        switch(offset) {
            case this.UART_TX:
                // Transmit character
                this.transmit(value & 0xFF);
                break;
                
            case this.UART_CTRL:
                // Update control register
                this.txInterruptEnable = (value & 0x01) !== 0;
                this.rxInterruptEnable = (value & 0x02) !== 0;
                break;
                
            case this.UART_BAUD:
                // UART_BAUD register lưu DIVISOR (giống STM32/ESP32)
                // Baud rate = peripheral_clock / (oversampling × divisor)
                this.baudDivisor = value;
                if (this.baudDivisor === 0) {
                    console.warn('[UART] Invalid divisor 0, keeping previous value');
                    return;
                }
                this.baudRate = Math.floor(this.peripheralClock / (this.oversampling * this.baudDivisor));
                console.log(`[UART] Divisor set to ${this.baudDivisor} → Baud rate: ${this.baudRate} (PCLK=${this.peripheralClock/1000000}MHz, OS=${this.oversampling}x)`);
                break;
                
            default:
                console.warn(`[UART] Write to read-only or invalid register: 0x${address.toString(16)}`);
        }
    }
    
    // Read from UART register
    readRegister(address) {
        const offset = address - this.baseAddress;
        
        switch(offset) {
            case this.UART_RX:
                // Read and consume one character from RX buffer
                return this.receive();
                
            case this.UART_STATUS:
                // Status register:
                // Bit 0: TX Ready (1 = can transmit)
                // Bit 1: RX Available (1 = has data to read)
                // Bit 2: TX Interrupt Enable
                // Bit 3: RX Interrupt Enable
                return (this.txReady ? 0x01 : 0x00) |
                       (this.rxAvailable ? 0x02 : 0x00) |
                       (this.txInterruptEnable ? 0x04 : 0x00) |
                       (this.rxInterruptEnable ? 0x08 : 0x00);
                       
            case this.UART_CTRL:
                // Control register
                return (this.txInterruptEnable ? 0x01 : 0x00) |
                       (this.rxInterruptEnable ? 0x02 : 0x00);
                       
            case this.UART_BAUD:
                // Return current divisor (NOT baud rate)
                return this.baudDivisor;
                       
            case this.UART_TX:
                // Reading TX register returns 0
                return 0;
                
            default:
                console.warn(`[UART] Read from invalid register: 0x${address.toString(16)}`);
                return 0;
        }
    }
    
    // Transmit a character (called when CPU writes to UART_TX)
    transmit(charCode) {
        if (!this.txReady) {
            console.warn('[UART] TX not ready, dropping character');
            return;
        }
        
        this.txBuffer.push(charCode);
        
        // Notify UI callback
        if (typeof this.onTransmit === 'function') {
            this.onTransmit(charCode);
        }
        
        // Calculate transmission delay based on baud rate
        // Time per byte = bits_per_frame / baud_rate (seconds)
        // CPU cycles = time * cpu_frequency
        const cyclesPerByte = Math.floor((this.bitsPerFrame * this.cpuFrequency) / this.baudRate);
        
        this.txReady = false;
        this.txCyclesRemaining = cyclesPerByte;
        
        console.log(`[UART] Transmitting 0x${charCode.toString(16)}, will be ready in ${cyclesPerByte} cycles (${(cyclesPerByte/this.cpuFrequency*1000000).toFixed(2)} μs)`);
    }
    
    // Receive a character (called when CPU reads from UART_RX)
    receive() {
        if (this.rxBuffer.length === 0) {
            this.rxAvailable = false;
            return 0;
        }
        
        const charCode = this.rxBuffer.shift();
        this.rxAvailable = this.rxBuffer.length > 0;
        
        return charCode;
    }
    
    // Add character to RX buffer (called from UI input)
    addToRxBuffer(charCode) {
        this.rxBuffer.push(charCode);
        this.rxAvailable = true;
        
        if (typeof this.onReceive === 'function') {
            this.onReceive(charCode);
        }
    }
    
    // Add string to RX buffer
    addStringToRxBuffer(str) {
        for (let i = 0; i < str.length; i++) {
            this.addToRxBuffer(str.charCodeAt(i));
        }
    }
    
    // Get all transmitted text as string
    getTransmittedText() {
        return String.fromCharCode(...this.txBuffer);
    }
    
    // Clear TX buffer
    clearTxBuffer() {
        this.txBuffer = [];
    }
    
    // Clear RX buffer
    clearRxBuffer() {
        this.rxBuffer = [];
        this.rxAvailable = false;
    }
    
    // Reset UART state
    reset() {
        this.txBuffer = [];
        this.rxBuffer = [];
        this.txReady = true;
        this.rxAvailable = false;
        this.txInterruptEnable = false;
        this.rxInterruptEnable = false;
        this.txCyclesRemaining = 0;
        this.rxCyclesRemaining = 0;
        this.baudDivisor = 26; // Reset to default (115200 @ 48MHz/16x)
        this.baudRate = this.peripheralClock / (this.oversampling * this.baudDivisor);
    }
    
    // Called every CPU cycle to update UART timing
    tick() {
        // Count down TX delay
        if (this.txCyclesRemaining > 0) {
            this.txCyclesRemaining--;
            if (this.txCyclesRemaining % 10 === 0) {
                console.log(`[UART TICK] TX cycles remaining: ${this.txCyclesRemaining}`);
            }
            if (this.txCyclesRemaining === 0) {
                this.txReady = true;
                console.log('[UART] ✅ TX ready again after countdown');
            }
        }
        
        // Count down RX delay (if needed)
        if (this.rxCyclesRemaining > 0) {
            this.rxCyclesRemaining--;
        }
    }
    
    // Check if address is in UART range
    isUARTAddress(address) {
        return address >= this.baseAddress && 
               address < this.baseAddress + 0x14; // Include UART_BAUD (0x10)
    }
}
