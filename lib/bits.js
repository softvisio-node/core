export function getBit ( value, bit ) {
    return ( value & bit ) !== 0
        ? 1
        : 0;
}

export function setBit ( value, mask ) {
    return value | mask;
}

export function dropBit ( value, mask ) {
    return value & ~mask;
}

export function toggleBit ( value, mask ) {
    return value ^ mask;
}
