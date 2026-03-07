# RISC-V Simulator & Assembler

A web-based **System-on-Chip (SoC) simulator** and **RISC-V assembler** designed for learning computer architecture and embedded systems.

This project allows users to write RISC-V assembly code, assemble it, and run it inside an interactive simulator that visualizes how different hardware components interact in a System-on-Chip environment.

This project is developed as an **undergraduate thesis** at the University of Information Technology – VNU-HCM.

---

## 🌐 Live Demo

Try the simulator here:

https://risc-v.vercel.app

---

## 📚 Project Overview

The goal of this project is to create an **educational tool** that helps students understand how a modern processor system works.

Unlike many simulators that only simulate the CPU instruction set, this project focuses on simulating a **complete SoC architecture**, including CPU, bus interconnect, DMA, and peripheral devices.

Users can:

- Write RISC-V assembly code
- Assemble the program
- Load it into the simulator
- Observe registers, memory, and system behavior in real time

---

## ⚙️ Features

- RISC-V RV32 instruction simulation
- Built-in RISC-V assembler
- Interactive web interface
- Register visualization
- Memory inspection
- Program execution step-by-step
- Educational system-level simulation

Planned features:

- RV32IMF full support
- DMA controller simulation
- Multi-master bus interconnect
- Peripheral devices (UART, display, keyboard)
- System-level debugging tools

---

## 🏗 System Architecture

The simulator models a simplified System-on-Chip architecture including:

- **CPU Core** – executes RISC-V instructions
- **Memory** – program and data storage
- **Bus Interconnect** – communication between components
- **DMA Controller** – memory transfer without CPU
- **Peripheral Controllers** – external device interaction


Developed by Xuan Loc and Gia Khang
