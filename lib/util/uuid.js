const bth = [];

for ( let i = 0; i < 256; ++i ) {
    bth.push( ( i + 0x100 ).toString( 16 ).substr( 1 ) );
}

module.exports.bufferToUuid = function ( buf, offset ) {
    const i = offset || 0;

    return bth[buf[i + 0]] + bth[buf[i + 1]] + bth[buf[i + 2]] + bth[buf[i + 3]] + "-" + bth[buf[i + 4]] + bth[buf[i + 5]] + "-" + bth[buf[i + 6]] + bth[buf[i + 7]] + "-" + bth[buf[i + 8]] + bth[buf[i + 9]] + "-" + bth[buf[i + 10]] + bth[buf[i + 11]] + bth[buf[i + 12]] + bth[buf[i + 13]] + bth[buf[i + 14]] + bth[buf[i + 15]];
};

module.exports.uuidToBuffer = function ( uuid ) {
    return Buffer.from( uuid.replace( /-/g, "" ), "hex" );
};
