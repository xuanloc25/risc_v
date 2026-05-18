const WORD_CHAR = /[\w.$%]/;

const REGISTER_DOCS = [
    ['zero', 'x0', 'constant zero'], ['ra', 'x1', 'return address'],
    ['sp', 'x2', 'stack pointer'], ['gp', 'x3', 'global pointer'],
    ['tp', 'x4', 'thread pointer'], ['t0', 'x5', 'temporary register'],
    ['t1', 'x6', 'temporary register'], ['t2', 'x7', 'temporary register'],
    ['s0', 'x8', 'saved register / frame pointer'], ['fp', 'x8', 'frame pointer alias'],
    ['s1', 'x9', 'saved register'], ['a0', 'x10', 'argument / return value'],
    ['a1', 'x11', 'argument / return value'], ['a2', 'x12', 'argument register'],
    ['a3', 'x13', 'argument register'], ['a4', 'x14', 'argument register'],
    ['a5', 'x15', 'argument register'], ['a6', 'x16', 'argument register'],
    ['a7', 'x17', 'argument register / syscall id'], ['s2', 'x18', 'saved register'],
    ['s3', 'x19', 'saved register'], ['s4', 'x20', 'saved register'],
    ['s5', 'x21', 'saved register'], ['s6', 'x22', 'saved register'],
    ['s7', 'x23', 'saved register'], ['s8', 'x24', 'saved register'],
    ['s9', 'x25', 'saved register'], ['s10', 'x26', 'saved register'],
    ['s11', 'x27', 'saved register'], ['t3', 'x28', 'temporary register'],
    ['t4', 'x29', 'temporary register'], ['t5', 'x30', 'temporary register'],
    ['t6', 'x31', 'temporary register'],
];

const FP_REGISTER_DOCS = [
    ['ft0', 'f0'], ['ft1', 'f1'], ['ft2', 'f2'], ['ft3', 'f3'],
    ['ft4', 'f4'], ['ft5', 'f5'], ['ft6', 'f6'], ['ft7', 'f7'],
    ['fs0', 'f8'], ['fs1', 'f9'], ['fa0', 'f10'], ['fa1', 'f11'],
    ['fa2', 'f12'], ['fa3', 'f13'], ['fa4', 'f14'], ['fa5', 'f15'],
    ['fa6', 'f16'], ['fa7', 'f17'], ['fs2', 'f18'], ['fs3', 'f19'],
    ['fs4', 'f20'], ['fs5', 'f21'], ['fs6', 'f22'], ['fs7', 'f23'],
    ['fs8', 'f24'], ['fs9', 'f25'], ['fs10', 'f26'], ['fs11', 'f27'],
    ['ft8', 'f28'], ['ft9', 'f29'], ['ft10', 'f30'], ['ft11', 'f31'],
];

const ROUNDING_MODES = [
    ['rne', 'round to nearest, ties to even'],
    ['rtz', 'round toward zero'],
    ['rdn', 'round down'],
    ['rup', 'round up'],
    ['rmm', 'round to nearest, ties to max magnitude'],
    ['dyn', 'dynamic rounding mode'],
];

const FENCE_MODES = [
    ['i', 'instruction input'], ['o', 'device output'],
    ['r', 'memory read'], ['w', 'memory write'],
    ['iorw', 'all fence domains'],
    ['rw', 'memory reads and writes'],
];

const DIRECTIVE_DOCS = {
    '.text': { detail: 'Switch to code section.', syntax: '.text [address]', example: '.text 0x00400000' },
    '.data': { detail: 'Switch to data section.', syntax: '.data [address]', example: '.data 0x10010000' },
    '.section': { detail: 'Switch to a named section.', syntax: '.section .text | .data | .rodata', example: '.section .text' },
    '.word': { detail: 'Store 32-bit words in data memory.', syntax: '.word value[, value...]', example: '.word 1, 2, 0xFF' },
    '.half': { detail: 'Store 16-bit halfwords.', syntax: '.half value[, value...]', example: '.half 0x1234' },
    '.byte': { detail: 'Store bytes or character literals.', syntax: '.byte value[, value...]', example: ".byte 65, 'A'" },
    '.float': { detail: 'Store single-precision floating-point values.', syntax: '.float value[, value...]', example: '.float 1.25, -3.5' },
    '.single': { detail: 'Alias of .float.', syntax: '.single value[, value...]', example: '.single 1.0' },
    '.ascii': { detail: 'Store a string without the null terminator.', syntax: '.ascii "text"', example: '.ascii "Hello"' },
    '.asciiz': { detail: 'Store a null-terminated string.', syntax: '.asciiz "text"', example: '.asciiz "Hello\\n"' },
    '.string': { detail: 'Alias of .asciiz.', syntax: '.string "text"', example: '.string "Hello"' },
    '.space': { detail: 'Reserve zero-filled bytes.', syntax: '.space byte_count', example: '.space 64' },
    '.align': { detail: 'Align current address to 2^n bytes.', syntax: '.align exponent', example: '.align 2' },
    '.globl': { detail: 'Mark a symbol as global.', syntax: '.globl label', example: '.globl _start' },
    '.global': { detail: 'Alias of .globl.', syntax: '.global label', example: '.global _start' },
    '.extern': { detail: 'Declare external symbols for compatible input.', syntax: '.extern symbol[, symbol...]', example: '.extern puts' },
    '.eqv': { detail: 'Define a symbolic constant.', syntax: '.eqv symbol, value', example: '.eqv UART, 0x10000000' },
    '.org': { detail: 'Set the current assembly address.', syntax: '.org address', example: '.org 0x10010100' },
};

const INSTRUCTION_DOCS = {
    lb: { detail: 'Load signed byte.', example: 'lb t0, 0(sp)' },
    lh: { detail: 'Load signed halfword.', example: 'lh t0, 0(sp)' },
    lw: { detail: 'Load 32-bit word.', example: 'lw t0, 0(sp)' },
    lbu: { detail: 'Load unsigned byte.', example: 'lbu t0, 0(sp)' },
    lhu: { detail: 'Load unsigned halfword.', example: 'lhu t0, 0(sp)' },
    sb: { detail: 'Store byte.', example: 'sb t0, 0(sp)' },
    sh: { detail: 'Store halfword.', example: 'sh t0, 0(sp)' },
    sw: { detail: 'Store 32-bit word.', example: 'sw t0, 0(sp)' },
    addi: { detail: 'Addition immediate: rd = rs1 + signed 12-bit immediate.', examples: ['addi t1, t2, -100', 'addi t1, t2, %lo(label)'] },
    slti: { detail: 'Set rd to 1 when rs1 < signed immediate.', example: 'slti t0, t1, 10' },
    sltiu: { detail: 'Set rd to 1 when rs1 < unsigned immediate.', example: 'sltiu t0, t1, 10' },
    xori: { detail: 'Bitwise XOR with signed 12-bit immediate.', example: 'xori t0, t1, -1' },
    ori: { detail: 'Bitwise OR with signed 12-bit immediate.', example: 'ori t0, t1, 0xFF' },
    andi: { detail: 'Bitwise AND with signed 12-bit immediate.', example: 'andi t0, t1, 0xFF' },
    slli: { detail: 'Logical left shift by immediate shamt.', example: 'slli t0, t1, 2' },
    srli: { detail: 'Logical right shift by immediate shamt.', example: 'srli t0, t1, 2' },
    srai: { detail: 'Arithmetic right shift by immediate shamt.', example: 'srai t0, t1, 2' },
    add: { detail: 'Add two registers.', example: 'add t0, t1, t2' },
    sub: { detail: 'Subtract rs2 from rs1.', example: 'sub t0, t1, t2' },
    sll: { detail: 'Logical left shift by register shamt.', example: 'sll t0, t1, t2' },
    slt: { detail: 'Set rd when rs1 < rs2, signed.', example: 'slt t0, t1, t2' },
    sltu: { detail: 'Set rd when rs1 < rs2, unsigned.', example: 'sltu t0, t1, t2' },
    xor: { detail: 'Bitwise XOR registers.', example: 'xor t0, t1, t2' },
    srl: { detail: 'Logical right shift by register shamt.', example: 'srl t0, t1, t2' },
    sra: { detail: 'Arithmetic right shift by register shamt.', example: 'sra t0, t1, t2' },
    or: { detail: 'Bitwise OR registers.', example: 'or t0, t1, t2' },
    and: { detail: 'Bitwise AND registers.', example: 'and t0, t1, t2' },
    lui: { detail: 'Load upper 20 bits into rd.', examples: ['lui t0, 0x10010', 'lui t0, %hi(label)'] },
    auipc: { detail: 'Add upper immediate to PC.', examples: ['auipc t0, 0', 'auipc t0, %hi(label)'] },
    jal: { detail: 'Jump and link to PC-relative target.', example: 'jal ra, target' },
    jalr: { detail: 'Jump and link through register base.', examples: ['jalr ra, t0, 0', 'jalr ra, 0(t0)'] },
    beq: { detail: 'Branch when rs1 equals rs2.', example: 'beq t0, t1, done' },
    bne: { detail: 'Branch when rs1 is not equal to rs2.', example: 'bne t0, t1, loop' },
    blt: { detail: 'Branch when rs1 < rs2, signed.', example: 'blt t0, t1, loop' },
    bge: { detail: 'Branch when rs1 >= rs2, signed.', example: 'bge t0, t1, done' },
    bltu: { detail: 'Branch when rs1 < rs2, unsigned.', example: 'bltu t0, t1, loop' },
    bgeu: { detail: 'Branch when rs1 >= rs2, unsigned.', example: 'bgeu t0, t1, done' },
    ecall: { detail: 'Environment call / syscall trap.', syntax: 'ecall', example: 'ecall' },
    ebreak: { detail: 'Breakpoint trap.', syntax: 'ebreak', example: 'ebreak' },
    fence: { detail: 'Order memory and I/O operations.', example: 'fence iorw, iorw' },
    mul: { detail: 'Low 32 bits of signed multiply.', example: 'mul t0, t1, t2' },
    mulh: { detail: 'High 32 bits of signed multiply.', example: 'mulh t0, t1, t2' },
    mulhsu: { detail: 'High 32 bits of signed x unsigned multiply.', example: 'mulhsu t0, t1, t2' },
    mulhu: { detail: 'High 32 bits of unsigned multiply.', example: 'mulhu t0, t1, t2' },
    div: { detail: 'Signed division quotient.', example: 'div t0, t1, t2' },
    divu: { detail: 'Unsigned division quotient.', example: 'divu t0, t1, t2' },
    rem: { detail: 'Signed division remainder.', example: 'rem t0, t1, t2' },
    remu: { detail: 'Unsigned division remainder.', example: 'remu t0, t1, t2' },
    flw: { detail: 'Load single-precision float.', example: 'flw ft0, 0(sp)' },
    fsw: { detail: 'Store single-precision float.', example: 'fsw ft0, 0(sp)' },
    'fmadd.s': { detail: 'Fused multiply-add: fd = fs1 * fs2 + fs3.', example: 'fmadd.s ft0, ft1, ft2, ft3' },
    'fmsub.s': { detail: 'Fused multiply-subtract.', example: 'fmsub.s ft0, ft1, ft2, ft3' },
    'fnmsub.s': { detail: 'Negated fused multiply-subtract.', example: 'fnmsub.s ft0, ft1, ft2, ft3' },
    'fnmadd.s': { detail: 'Negated fused multiply-add.', example: 'fnmadd.s ft0, ft1, ft2, ft3' },
    'fadd.s': { detail: 'Single-precision floating-point addition.', example: 'fadd.s ft0, ft1, ft2' },
    'fsub.s': { detail: 'Single-precision floating-point subtraction.', example: 'fsub.s ft0, ft1, ft2' },
    'fmul.s': { detail: 'Single-precision floating-point multiply.', example: 'fmul.s ft0, ft1, ft2' },
    'fdiv.s': { detail: 'Single-precision floating-point divide.', example: 'fdiv.s ft0, ft1, ft2' },
    'fsqrt.s': { detail: 'Single-precision square root.', example: 'fsqrt.s ft0, ft1' },
    'fmin.s': { detail: 'Minimum of two single-precision floats.', example: 'fmin.s ft0, ft1, ft2' },
    'fmax.s': { detail: 'Maximum of two single-precision floats.', example: 'fmax.s ft0, ft1, ft2' },
    'fsgnj.s': { detail: 'Copy sign of fs2 to fs1 magnitude.', example: 'fsgnj.s ft0, ft1, ft2' },
    'fsgnjn.s': { detail: 'Copy inverted sign of fs2.', example: 'fsgnjn.s ft0, ft1, ft2' },
    'fsgnjx.s': { detail: 'Sign injection using XOR of signs.', example: 'fsgnjx.s ft0, ft1, ft2' },
    'fcvt.w.s': { detail: 'Convert float to signed integer.', example: 'fcvt.w.s t0, ft1' },
    'fcvt.wu.s': { detail: 'Convert float to unsigned integer.', example: 'fcvt.wu.s t0, ft1' },
    'fcvt.s.w': { detail: 'Convert signed integer to float.', example: 'fcvt.s.w ft0, t1' },
    'fcvt.s.wu': { detail: 'Convert unsigned integer to float.', example: 'fcvt.s.wu ft0, t1' },
    'feq.s': { detail: 'Set integer rd when fs1 equals fs2.', example: 'feq.s t0, ft1, ft2' },
    'flt.s': { detail: 'Set integer rd when fs1 < fs2.', example: 'flt.s t0, ft1, ft2' },
    'fle.s': { detail: 'Set integer rd when fs1 <= fs2.', example: 'fle.s t0, ft1, ft2' },
    'fclass.s': { detail: 'Classify floating-point value.', example: 'fclass.s t0, ft1' },
    'fmv.x.w': { detail: 'Move raw float bits to integer register.', example: 'fmv.x.w t0, ft1' },
    'fmv.w.x': { detail: 'Move raw integer bits to float register.', example: 'fmv.w.x ft0, t1' },
    'amoadd.w': { detail: 'Atomic add word.', example: 'amoadd.w t0, t1, 0(t2)' },
    nop: { detail: 'No operation.', syntax: 'nop', example: 'nop' },
    li: { detail: 'Load immediate pseudo-instruction.', syntax: 'li rd, imm', example: 'li a7, 93' },
    mv: { detail: 'Move register pseudo-instruction.', syntax: 'mv rd, rs', example: 'mv t0, t1' },
    j: { detail: 'Jump without link.', syntax: 'j label', example: 'j loop' },
    jr: { detail: 'Jump through register.', syntax: 'jr rs', example: 'jr ra' },
    ret: { detail: 'Return to ra.', syntax: 'ret', example: 'ret' },
    call: { detail: 'Call symbol through auipc + jalr expansion.', syntax: 'call label', example: 'call main' },
    bnez: { detail: 'Branch when register is not zero.', syntax: 'bnez rs, label', example: 'bnez t0, loop' },
    beqz: { detail: 'Branch when register is zero.', syntax: 'beqz rs, label', example: 'beqz t0, done' },
    la: { detail: 'Load address of a symbol.', syntax: 'la rd, symbol', example: 'la a0, msg' },
    'fmv.s': { detail: 'Move single-precision register.', syntax: 'fmv.s fd, fs', example: 'fmv.s ft0, ft1' },
    'fabs.s': { detail: 'Floating-point absolute value.', syntax: 'fabs.s fd, fs', example: 'fabs.s ft0, ft1' },
    'fneg.s': { detail: 'Floating-point negation.', syntax: 'fneg.s fd, fs', example: 'fneg.s ft0, ft1' },
};

export function configureRiscvEditorHints(editor, { assembler }) {
    if (!editor || typeof CodeMirror === 'undefined' || !CodeMirror.showHint) {
        return;
    }

    const dictionary = buildDictionary(assembler);
    editor.__riscvAssembler = assembler;

    CodeMirror.registerHelper('hint', 'riscv', (cm) => buildHintResult(cm, dictionary));

    const previousExtraKeys = editor.getOption('extraKeys') || {};
    editor.setOption('extraKeys', {
        ...previousExtraKeys,
        'Ctrl-Space': showAutocomplete,
        'Alt-/': showAutocomplete,
    });

    const hintOptions = {
        hint: CodeMirror.hint.riscv,
        completeSingle: false,
        alignWithWord: false,
        closeOnUnfocus: true,
        extraKeys: {
            Enter: insertNewlineFromHint,
            'Shift-Enter': insertNewlineFromHint,
            Tab: (_cm, handle) => handle.pick(),
        },
    };
    editor.setOption('hintOptions', hintOptions);

    let scheduledHint = null;
    const requestHint = (cm) => {
        window.clearTimeout(scheduledHint);
        scheduledHint = window.setTimeout(() => {
            if (!cm.state.completionActive) {
                cm.showHint(hintOptions);
            }
        }, 60);
    };

    editor.on('inputRead', (cm, change) => {
        if (cm.state.completionActive || !shouldTriggerAutocomplete(cm, change)) return;
        requestHint(cm);
    });

    editor.on('change', (cm, change) => {
        if (cm.state.completionActive || !shouldTriggerAutocomplete(cm, change)) return;
        requestHint(cm);
    });

    editor.on('changes', (cm, changes) => {
        if (cm.state.completionActive) return;
        if (changes.some((change) => shouldTriggerAutocomplete(cm, change))) requestHint(cm);
    });

    editor.on('keyup', (cm, event) => {
        if (cm.state.completionActive || event.ctrlKey || event.altKey || event.metaKey) return;
        if (shouldTriggerAutocompleteFromKey(cm, event)) requestHint(cm);
    });

    const inputField = editor.getInputField?.();
    inputField?.addEventListener('input', () => {
        if (!editor.state.completionActive && shouldTriggerAutocompleteAtCursor(editor)) requestHint(editor);
    });
    inputField?.addEventListener('keyup', (event) => {
        if (editor.state.completionActive || event.ctrlKey || event.altKey || event.metaKey) return;
        if (shouldTriggerAutocompleteFromKey(editor, event)) requestHint(editor);
    });

    function showAutocomplete(cm) {
        cm.showHint(hintOptions);
    }
}

function insertNewlineFromHint(cm, handle) {
    cm.operation(() => {
        handle.close();
        cm.execCommand('newlineAndIndent');
    });
}

function buildDictionary(assembler) {
    const instructionItems = Object.entries(assembler.opcodes).map(([mnemonic, info]) => {
        const doc = INSTRUCTION_DOCS[mnemonic] || {};
        const syntax = doc.syntax || inferSyntax(mnemonic, info);
        const examples = doc.examples || (doc.example ? [doc.example] : [exampleFromSyntax(syntax)]);
        const insertText = syntax === mnemonic ? mnemonic : `${mnemonic} `;
        return makeCompletion({
            label: mnemonic,
            insertText,
            kind: info.type === 'Pseudo' ? 'pseudo' : 'instruction',
            detail: doc.detail || detailFromType(info.type),
            syntax,
            example: examples[0],
            examples,
            priority: info.type === 'Pseudo' ? 20 : 10,
        });
    });

    const directiveItems = Object.keys(assembler.directives).map((directive) => {
        const doc = DIRECTIVE_DOCS[directive] || {};
        return makeCompletion({
            label: directive,
            insertText: directive.includes(' ') ? directive : `${directive} `,
            kind: 'directive',
            detail: doc.detail || 'Assembler directive.',
            syntax: doc.syntax || directive,
            example: doc.example || directive,
            priority: 30,
        });
    });

    const integerRegisters = REGISTER_DOCS.flatMap(([abi, xname, detail]) => [
        makeCompletion({ label: abi, kind: 'reg', detail, syntax: xname, priority: 50 }),
        makeCompletion({ label: xname, kind: 'reg', detail: `${abi} - ${detail}`, syntax: abi, priority: 55 }),
    ]);

    const fpRegisters = FP_REGISTER_DOCS.flatMap(([abi, fname]) => [
        makeCompletion({ label: abi, kind: 'fp', detail: `${fname} floating-point register`, syntax: fname, priority: 60 }),
        makeCompletion({ label: fname, kind: 'fp', detail: `${abi} floating-point register`, syntax: abi, priority: 65 }),
    ]);

    const roundingModes = ROUNDING_MODES.map(([mode, detail]) => makeCompletion({
        label: mode,
        kind: 'rm',
        detail,
        syntax: 'optional floating-point rounding mode',
        priority: 90,
    }));

    const fenceModes = FENCE_MODES.map(([mode, detail]) => makeCompletion({
        label: mode,
        kind: 'fence',
        detail,
        syntax: 'fence predecessor/successor set',
        priority: 95,
    }));

    const immediateHelpers = [
        makeCompletion({ label: '%hi(label)', insertText: '%hi(label)', kind: 'imm', detail: 'Upper 20-bit relocation helper.', syntax: 'lui rd, %hi(label)', priority: 80 }),
        makeCompletion({ label: '%lo(label)', insertText: '%lo(label)', kind: 'imm', detail: 'Signed lower 12-bit relocation helper.', syntax: 'addi rd, rs1, %lo(label)', priority: 80 }),
        makeCompletion({ label: '0(sp)', insertText: '0(sp)', kind: 'mem', detail: 'Memory operand using stack pointer.', syntax: 'offset(base)', priority: 85 }),
        makeCompletion({ label: '0(t0)', insertText: '0(t0)', kind: 'mem', detail: 'Memory operand using temporary base register.', syntax: 'offset(base)', priority: 85 }),
        makeCompletion({ label: '-4(sp)', insertText: '-4(sp)', kind: 'mem', detail: 'Negative stack offset.', syntax: 'offset(base)', priority: 85 }),
    ];

    return {
        instructions: instructionItems,
        directives: directiveItems,
        integerRegisters,
        fpRegisters,
        roundingModes,
        fenceModes,
        immediateHelpers,
        allHeadItems: [...instructionItems, ...directiveItems],
    };
}

function buildHintResult(cm, dictionary) {
    const cur = cm.getCursor();
    if (isInsideCommentOrString(cm, cur)) return null;

    const range = getCurrentWordRange(cm, cur);
    const context = getStatementContext(cm, cur);
    const labels = collectSymbolCompletions(cm.getValue());

    let list;
    if (context.statementHead) {
        const headItems = range.prefix.startsWith('.')
            ? dictionary.directives
            : dictionary.allHeadItems;
        list = filterCompletions(headItems, range.prefix);
    } else {
        list = filterCompletions(
            buildOperandCompletions(context, dictionary, labels, range.prefix),
            range.prefix
        );
    }

    if (list.length === 0) return null;
    return { list, from: range.from, to: range.to };
}

function buildOperandCompletions(context, dictionary, labels, prefix) {
    const suggestions = [];
    const mnemonic = context.mnemonic;
    const opInfo = context.opInfo;

    suggestions.push(...exampleTailCompletions(mnemonic, context.operandIndex));

    if (context.insideMemoryBase) {
        suggestions.push(...dictionary.integerRegisters);
        return suggestions;
    }

    if (context.insideRelocation) {
        suggestions.push(...labels);
        return suggestions;
    }

    const kind = operandKindFor(opInfo, mnemonic, context.operandIndex);
    if (kind === 'xreg') suggestions.push(...dictionary.integerRegisters);
    else if (kind === 'freg') suggestions.push(...dictionary.fpRegisters);
    else if (kind === 'rm') suggestions.push(...dictionary.roundingModes);
    else if (kind === 'fence') suggestions.push(...dictionary.fenceModes);
    else if (kind === 'memory') suggestions.push(...dictionary.immediateHelpers, ...labels);
    else if (kind === 'label') suggestions.push(...labels, ...dictionary.immediateHelpers);
    else if (kind === 'imm') suggestions.push(...dictionary.immediateHelpers, ...labels);
    else suggestions.push(...dictionary.integerRegisters, ...dictionary.fpRegisters, ...labels, ...dictionary.immediateHelpers);

    if (prefix.startsWith('%')) {
        suggestions.unshift(...dictionary.immediateHelpers.filter((item) => item.label.startsWith('%')));
    }

    return suggestions;
}

function exampleTailCompletions(mnemonic, operandIndex) {
    const doc = INSTRUCTION_DOCS[mnemonic];
    const examples = doc?.examples || (doc?.example ? [doc.example] : []);
    return examples
        .map((example) => {
            const exampleMnemonic = example.trim().split(/\s+/)[0]?.toLowerCase();
            if (exampleMnemonic !== mnemonic) return null;
            const operandText = example.trim().slice(exampleMnemonic.length).trim();
            const operands = splitOperands(operandText);
            if (operandIndex >= operands.length) return null;
            const insertText = operands.slice(operandIndex).join(', ');
            return makeCompletion({
                label: example,
                insertText,
                kind: 'example',
                detail: doc.detail || 'Instruction example.',
                syntax: doc.syntax || inferSyntax(mnemonic, { type: 'I' }),
                example,
                priority: 5,
            });
        })
        .filter(Boolean);
}

function collectSymbolCompletions(code) {
    const items = [];
    const seen = new Set();
    const labelRegex = /^\s*([A-Za-z_]\w*)\s*:/gm;
    const eqvRegex = /^\s*\.eqv\s+([A-Za-z_]\w*)\b/gm;

    for (const regex of [labelRegex, eqvRegex]) {
        let match;
        while ((match = regex.exec(code)) !== null) {
            const label = match[1];
            if (seen.has(label)) continue;
            seen.add(label);
            items.push(makeCompletion({
                label,
                kind: regex === labelRegex ? 'label' : 'const',
                detail: regex === labelRegex ? 'Label defined in the editor.' : 'Constant defined with .eqv.',
                syntax: regex === labelRegex ? 'branch/jump/data symbol' : '.eqv symbol',
                priority: regex === labelRegex ? 40 : 42,
            }));
        }
    }

    return items;
}

function makeCompletion({ label, insertText = label, kind, detail, syntax, example, examples = [], priority = 100 }) {
    const item = {
        text: insertText,
        label,
        displayText: label,
        insertText,
        kind,
        detail,
        syntax,
        example,
        examples,
        priority,
        filterText: `${label} ${insertText} ${syntax || ''} ${detail || ''}`.toLowerCase(),
        className: `riscv-hint-item riscv-hint-${kind}`,
        render: renderCompletion,
        hint(cm, data, completion) {
            cm.replaceRange(completion.insertText, data.from, data.to);
        },
    };
    return item;
}

function renderCompletion(element, _self, completion) {
    const wrapper = document.createElement('div');
    wrapper.className = 'riscv-hint-content';

    const main = document.createElement('div');
    main.className = 'riscv-hint-main';

    const label = document.createElement('span');
    label.className = 'riscv-hint-label';
    label.textContent = completion.label;
    main.appendChild(label);

    const badge = document.createElement('span');
    badge.className = 'riscv-hint-badge';
    badge.textContent = completion.kind;
    main.appendChild(badge);

    const detail = document.createElement('div');
    detail.className = 'riscv-hint-detail';
    detail.textContent = completion.detail || '';

    wrapper.appendChild(main);
    wrapper.appendChild(detail);

    if (completion.syntax) {
        const syntax = document.createElement('div');
        syntax.className = 'riscv-hint-syntax';
        syntax.textContent = completion.syntax;
        wrapper.appendChild(syntax);
    }

    if (completion.example && completion.example !== completion.syntax) {
        const example = document.createElement('div');
        example.className = 'riscv-hint-example';
        example.textContent = completion.example;
        wrapper.appendChild(example);
    }

    element.appendChild(wrapper);
}

function filterCompletions(items, prefix) {
    const normalized = prefix.toLowerCase();
    const seen = new Set();

    return items
        .filter((item) => {
            const key = `${item.kind}:${item.label}:${item.insertText}`;
            if (seen.has(key)) return false;
            seen.add(key);
            if (!normalized) return true;
            return item.filterText.includes(normalized);
        })
        .sort((a, b) => {
            const aStarts = a.label.toLowerCase().startsWith(normalized) ? 0 : 1;
            const bStarts = b.label.toLowerCase().startsWith(normalized) ? 0 : 1;
            return aStarts - bStarts || a.priority - b.priority || a.label.localeCompare(b.label);
        })
        .slice(0, 80);
}

function getCurrentWordRange(cm, cur) {
    const line = cm.getLine(cur.line);
    let start = cur.ch;
    let end = cur.ch;

    while (start > 0 && WORD_CHAR.test(line.charAt(start - 1))) start--;
    while (end < line.length && WORD_CHAR.test(line.charAt(end))) end++;

    return {
        from: CodeMirror.Pos(cur.line, start),
        to: CodeMirror.Pos(cur.line, end),
        prefix: line.slice(start, cur.ch),
    };
}

function getStatementContext(cm, cur) {
    const line = cm.getLine(cur.line);
    const before = stripComment(line.slice(0, cur.ch));
    const rest = before.replace(/^\s*[A-Za-z_]\w*:\s*/, '');
    const statementHead = /^\s*[\w.$%]*$/.test(rest);
    const mnemonicMatch = rest.trimStart().match(/^([.\w][\w.]*)\b/);
    const mnemonic = mnemonicMatch ? mnemonicMatch[1].toLowerCase() : '';
    const opInfo = cm.__riscvAssembler?.opcodes?.[mnemonic] || window.riscvAssembler?.opcodes?.[mnemonic] || null;
    const afterMnemonic = mnemonic
        ? rest.replace(/^\s*[.\w][\w.]*\s*/, '')
        : '';
    const lastComma = Math.max(afterMnemonic.lastIndexOf(','), 0);
    const lastOpenParen = afterMnemonic.lastIndexOf('(');
    const lastCloseParen = afterMnemonic.lastIndexOf(')');

    return {
        statementHead,
        mnemonic,
        opInfo,
        operandIndex: countTopLevelCommas(afterMnemonic),
        insideMemoryBase: lastOpenParen > lastCloseParen && lastOpenParen > lastComma && !/%\w+\([^)]*$/.test(afterMnemonic),
        insideRelocation: /%\w+\([^)]*$/.test(afterMnemonic),
    };
}

function shouldTriggerAutocomplete(cm, change) {
    if (change.origin === 'setValue') return false;
    const text = change.text.join('\n');
    if (!text) return false;
    if (text.includes('\n')) return false;
    if (text.length > 24) return false;
    const cur = cm.getCursor();
    if (isInsideCommentOrString(cm, cur)) return false;
    return /[\w.$%,(\s]$/.test(text);
}

function shouldTriggerAutocompleteFromKey(cm, event) {
    const key = event.key || '';
    if (key === 'Enter' || key === 'Escape' || key.startsWith('Arrow')) return false;
    if (key === 'Backspace') return shouldTriggerAutocompleteAtCursor(cm);
    return /^[\w.$%,(\s]$/.test(key) && shouldTriggerAutocompleteAtCursor(cm);
}

function shouldTriggerAutocompleteAtCursor(cm) {
    const cur = cm.getCursor();
    if (cur.ch === 0 || isInsideCommentOrString(cm, cur)) return false;

    const line = cm.getLine(cur.line);
    if (!line.slice(0, cur.ch).trim()) return false;

    return /[\w.$%,(\s]$/.test(line.charAt(cur.ch - 1));
}

function isInsideCommentOrString(cm, cur) {
    const token = cm.getTokenAt(cur);
    return /\b(comment|string)\b/.test(token.type || '');
}

function stripComment(line) {
    let inString = false;
    let escaped = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (char === '\\') {
            escaped = true;
            continue;
        }
        if (char === '"') inString = !inString;
        if (char === '#' && !inString) return line.slice(0, i);
    }
    return line;
}

function countTopLevelCommas(text) {
    let count = 0;
    let parens = 0;
    let inString = false;
    let escaped = false;
    for (const char of text) {
        if (escaped) {
            escaped = false;
            continue;
        }
        if (char === '\\') {
            escaped = true;
            continue;
        }
        if (char === '"') inString = !inString;
        else if (!inString && char === '(') parens++;
        else if (!inString && char === ')') parens = Math.max(0, parens - 1);
        else if (!inString && parens === 0 && char === ',') count++;
    }
    return count;
}

function splitOperands(text) {
    const operands = [];
    let current = '';
    let parens = 0;
    let inString = false;
    let escaped = false;
    for (const char of text) {
        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }
        if (char === '\\') {
            current += char;
            escaped = true;
            continue;
        }
        if (char === '"') inString = !inString;
        if (!inString && char === '(') parens++;
        if (!inString && char === ')') parens = Math.max(0, parens - 1);
        if (!inString && parens === 0 && char === ',') {
            if (current.trim()) operands.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    if (current.trim()) operands.push(current.trim());
    return operands;
}

function operandKindFor(info, mnemonic, index) {
    if (!info) return 'any';
    if (mnemonic === 'ecall' || mnemonic === 'ebreak' || mnemonic === 'nop' || mnemonic === 'ret') return 'none';
    if (mnemonic === 'fence') return 'fence';
    if (mnemonic === 'li') return index === 0 ? 'xreg' : 'imm';
    if (mnemonic === 'mv') return 'xreg';
    if (mnemonic === 'j' || mnemonic === 'call') return 'label';
    if (mnemonic === 'jr') return 'xreg';
    if (mnemonic === 'bnez' || mnemonic === 'beqz') return index === 0 ? 'xreg' : 'label';
    if (mnemonic === 'la') return index === 0 ? 'xreg' : 'label';
    if (mnemonic === 'fmv.s' || mnemonic === 'fabs.s' || mnemonic === 'fneg.s') return 'freg';

    switch (info.type) {
        case 'R':
            return 'xreg';
        case 'R-AMO':
            return index === 2 ? 'memory' : 'xreg';
        case 'I':
            if (['lb', 'lh', 'lw', 'lbu', 'lhu', 'jalr'].includes(mnemonic) && index === 1) return 'memory';
            return index < 2 ? 'xreg' : 'imm';
        case 'I-shamt':
            return index < 2 ? 'xreg' : 'imm';
        case 'S':
            return index === 0 ? 'xreg' : 'memory';
        case 'B':
            return index < 2 ? 'xreg' : 'label';
        case 'U':
            return index === 0 ? 'xreg' : 'imm';
        case 'J':
            return index === 0 ? 'xreg' : 'label';
        case 'I-FP':
            return index === 0 ? 'freg' : 'memory';
        case 'S-FP':
            return index === 0 ? 'freg' : 'memory';
        case 'R4-FP':
            return index < 4 ? 'freg' : 'rm';
        case 'R-FP':
            return index < 3 ? 'freg' : 'rm';
        case 'R-FP-CMP':
            return index === 0 ? 'xreg' : 'freg';
        case 'R-FP-CVT':
            if (mnemonic === 'fcvt.w.s' || mnemonic === 'fcvt.wu.s' || mnemonic === 'fclass.s' || mnemonic === 'fmv.x.w') {
                return index === 0 ? 'xreg' : index === 1 ? 'freg' : 'rm';
            }
            return index === 0 ? 'freg' : index === 1 ? 'xreg' : 'rm';
        default:
            return 'any';
    }
}

function inferSyntax(mnemonic, info) {
    switch (info.type) {
        case 'R':
            return `${mnemonic} rd, rs1, rs2`;
        case 'R-AMO':
            return `${mnemonic} rd, rs2, offset(rs1)`;
        case 'I':
            if (['lb', 'lh', 'lw', 'lbu', 'lhu'].includes(mnemonic)) return `${mnemonic} rd, offset(rs1)`;
            if (mnemonic === 'jalr') return `${mnemonic} rd, rs1, imm`;
            if (mnemonic === 'fence') return `${mnemonic} pred, succ`;
            return `${mnemonic} rd, rs1, imm`;
        case 'I-shamt':
            return `${mnemonic} rd, rs1, shamt`;
        case 'S':
            return `${mnemonic} rs2, offset(rs1)`;
        case 'B':
            return `${mnemonic} rs1, rs2, label`;
        case 'U':
            return `${mnemonic} rd, imm20`;
        case 'J':
            return `${mnemonic} rd, label`;
        case 'I-FP':
            return `${mnemonic} fd, offset(rs1)`;
        case 'S-FP':
            return `${mnemonic} fs2, offset(rs1)`;
        case 'R4-FP':
            return `${mnemonic} fd, fs1, fs2, fs3[, rm]`;
        case 'R-FP':
            return `${mnemonic} fd, fs1, fs2[, rm]`;
        case 'R-FP-CMP':
            return `${mnemonic} rd, fs1, fs2`;
        case 'R-FP-CVT':
            return `${mnemonic} rd, rs1[, rm]`;
        default:
            return mnemonic;
    }
}

function detailFromType(type) {
    const descriptions = {
        R: 'Register-register instruction.',
        'R-AMO': 'Atomic memory operation.',
        I: 'Immediate or load instruction.',
        'I-shamt': 'Immediate shift instruction.',
        S: 'Store instruction.',
        B: 'Conditional branch instruction.',
        U: 'Upper immediate instruction.',
        J: 'Jump instruction.',
        'I-FP': 'Floating-point load.',
        'S-FP': 'Floating-point store.',
        'R4-FP': 'Four-register floating-point instruction.',
        'R-FP': 'Floating-point arithmetic instruction.',
        'R-FP-CVT': 'Floating-point conversion/move instruction.',
        'R-FP-CMP': 'Floating-point comparison instruction.',
    };
    return descriptions[type] || 'RISC-V instruction.';
}

function exampleFromSyntax(syntax) {
    return syntax
        .replace(/\brd\b/g, 't0')
        .replace(/\brs1\b/g, 't1')
        .replace(/\brs2\b/g, 't2')
        .replace(/\bfd\b/g, 'ft0')
        .replace(/\bfs1\b/g, 'ft1')
        .replace(/\bfs2\b/g, 'ft2')
        .replace(/\bfs3\b/g, 'ft3')
        .replace(/\bimm20\b/g, '0')
        .replace(/\bimm\b/g, '0')
        .replace(/\bshamt\b/g, '1')
        .replace(/\blabel\b/g, 'target')
        .replace(/\boffset\(t1\)/g, '0(t1)');
}
