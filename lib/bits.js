export function getBit ( value, bit ) {
    return ( value & bit ) !== 0
        ? 1
        : 0;
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
