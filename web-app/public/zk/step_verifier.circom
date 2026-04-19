pragma circom 2.1.6;

// --- THƯ VIỆN BITMAN (GỘP VÀO ĐÂY) ---
template Num2Bits(n) {
    signal input in;
    signal output out[n];
    var lc1=0;
    var e2=1;
    for (var i = 0; i<n; i++) {
        out[i] <-- (in >> i) & 1;
        out[i] * (out[i] - 1) === 0;
        lc1 += out[i] * e2;
        e2 = e2 + e2;
    }
    lc1 === in;
}

// --- THƯ VIỆN COMPARATORS (GỘP VÀO ĐÂY) ---
template LessThan(n) {
    assert(n <= 252);
    signal input in[2];
    signal output out;
    component n2b = Num2Bits(n+1);
    n2b.in <== in[0] + (1 << n) - in[1];
    out <== 1 - n2b.out[n];
}

template GreaterEqThan(n) {
    signal input in[2];
    signal output out;
    component lt = LessThan(n);
    lt.in[0] <== in[0];
    lt.in[1] <== in[1];
    out <== 1 - lt.out;
}

// --- MẠCH CHÍNH CỦA BẠN ---
template StepVerifier() {
    signal input actual_steps; 
    signal input threshold;    
    
    component geq = GreaterEqThan(32);
    geq.in[0] <== actual_steps;
    geq.in[1] <== threshold;
    
    geq.out === 1;
}

component main {public [threshold]} = StepVerifier();