import { jest } from "@jest/globals";

jest.setTimeout( 2000 );

import Stream from "../lib/stream";

const buffer = "12-34--56--78-90";
const encoding = "utf8";

const READLINE = [

    // streaming, match
    { buffer, encoding, "eol": "--", "maxLength": null, "chunkSize": null, "line": "12-34", "rest": "56--78-90" },
    { buffer, encoding, "eol": "--", "maxLength": null, "chunkSize": 1, "line": "12-34", "rest": "56--78-90" },
    { buffer, encoding, "eol": "--", "maxLength": null, "chunkSize": 2, "line": "12-34", "rest": "56--78-90" },
    { buffer, encoding, "eol": "--", "maxLength": null, "chunkSize": 3, "line": "12-34", "rest": "56--78-90" },
    { buffer, encoding, "eol": "--", "maxLength": null, "chunkSize": 7, "line": "12-34", "rest": "56--78-90" },

    // streaming, match, eol: "-"
    { buffer, encoding, "eol": "-", "maxLength": null, "chunkSize": null, "line": "12", "rest": "34--56--78-90" },
    { buffer, encoding, "eol": "-", "maxLength": null, "chunkSize": 1, "line": "12", "rest": "34--56--78-90" },
    { buffer, encoding, "eol": "-", "maxLength": null, "chunkSize": 2, "line": "12", "rest": "34--56--78-90" },
    { buffer, encoding, "eol": "-", "maxLength": null, "chunkSize": 3, "line": "12", "rest": "34--56--78-90" },
    { buffer, encoding, "eol": "-", "maxLength": null, "chunkSize": 7, "line": "12", "rest": "34--56--78-90" },

    // streaming, not match
    { buffer, encoding, "eol": "---", "maxLength": null, "chunkSize": null, "line": null, "rest": null },
    { buffer, encoding, "eol": "---", "maxLength": null, "chunkSize": 1, "line": null, "rest": null },
    { buffer, encoding, "eol": "---", "maxLength": 5, "chunkSize": 1, "line": null, "rest": "--56--78-90" },

    // pre-buffered, match
    { buffer, encoding, "eol": "--", "maxLength": null, "chunkSize": null, "preinit": true, "line": "12-34", "rest": "56--78-90" },
    { buffer, encoding, "eol": "--", "maxLength": 7, "chunkSize": null, "preinit": true, "line": "12-34", "rest": "56--78-90" },

    // pre-buffered, not match
    { buffer, encoding, "eol": "---", "maxLength": null, "chunkSize": null, "preinit": true, "line": null, "rest": null },
    { buffer, encoding, "eol": "---", "maxLength": 4, "chunkSize": null, "preinit": true, "line": null, "rest": "4--56--78-90" },
    { buffer, encoding, "eol": "---", "maxLength": 6, "chunkSize": null, "preinit": true, "line": null, "rest": "-56--78-90" },
];

const READCHUNK = [
    { buffer, encoding, "length": 1, "line": "1", "rest": "2-34--56--78-90" },
    { buffer, encoding, "length": 5, "line": "12-34", "rest": "--56--78-90" },
    { buffer, encoding, "length": 16, "line": "12-34--56--78-90", "rest": null },
    { buffer, encoding, "length": 100, "line": null, "rest": null },
];

const sleep = () => new Promise( resolve => setTimeout( resolve, 1 ) );

// read line
for ( let n = 0; n < READLINE.length; n++ ) {
    test( "read_line_" + n, async () => {
        const data = READLINE[n];

        const [line, rest] = await readLine( data );

        expect( line ).toBe( data.line );

        expect( rest ).toBe( data.rest );
    } );
}

// read chunk
for ( let n = 0; n < READCHUNK.length; n++ ) {
    test( "read_chunk_" + n, async () => {
        const data = READCHUNK[n];

        const [line, rest] = await readChunk( data );

        expect( line ).toBe( data.line );

        expect( rest ).toBe( data.rest );
    } );
}

async function readLine ( data ) {
    const stream = new Stream.Readable( { read () {} } );

    if ( data.preinit ) await push( stream, data );
    else push( stream, data );

    const line = await stream.readLine( { "eol": data.eol, "encoding": data.encoding, "maxLength": data.maxLength } );

    var rest = [];

    await new Promise( resolve => {
        stream.on( "end", resolve );

        stream.on( "data", data => rest.push( data ) );
    } );

    return [line, rest.length ? Buffer.concat( rest ) + "" : null];
}

async function readChunk ( data ) {
    const stream = new Stream.Readable( { read () {} } );

    if ( data.preinit ) await push( stream, data );
    else push( stream, data );

    const line = await stream.readChunk( data.length, { "encoding": data.encoding } );

    var rest = [];

    await new Promise( resolve => {
        stream.on( "end", resolve );

        stream.on( "data", data => rest.push( data ) );
    } );

    return [line, rest.length ? Buffer.concat( rest ) + "" : null];
}

async function push ( stream, data ) {
    await sleep( 1 );

    for ( const buf of data.buffer.split( new RegExp( `(.{1,${data.chunkSize}})` ) ).filter( buf => buf !== "" ) ) {
        stream.push( buf );
        await sleep( 1 );
    }

    // eof
    stream.push( null );
    await sleep( 1 );
}
