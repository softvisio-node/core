export function getBit ( value, bit ) {
    return ( value & ( 2 ** ( bit - 1 ) ) ) === 0
        ? 0
        : 1;
}

export function setBits ( value, mask ) {
    return value | mask;
}

export function dropBits ( value, mask ) {
    return value & ~mask;
}

export function toggleBits ( value, mask ) {
    return value ^ mask;
}
