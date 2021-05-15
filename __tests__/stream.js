import { jest } from "@jest/globals";

jest.setTimeout( 2000 );

import Stream from "../lib/stream";

const buffer = "12-34--56--78-90";
const encoding = "utf8";

const TESTS = [

    // streaming, match
    { buffer, encoding, "eol": "--", "maxSize": null, "chunkSize": null, "line": "12-34", "rest": "56--78-90" },
    { buffer, encoding, "eol": "--", "maxSize": null, "chunkSize": 1, "line": "12-34", "rest": "5" },
    { buffer, encoding, "eol": "--", "maxSize": null, "chunkSize": 2, "line": "12-34", "rest": "5" },
    { buffer, encoding, "eol": "--", "maxSize": null, "chunkSize": 3, "line": "12-34", "rest": "56" },
    { buffer, encoding, "eol": "--", "maxSize": null, "chunkSize": 7, "line": "12-34", "rest": null },

    // streaming, not match
    { buffer, encoding, "eol": "---", "maxSize": null, "chunkSize": null, "line": null, "rest": null },
    { buffer, encoding, "eol": "---", "maxSize": null, "chunkSize": 1, "line": null, "rest": null },
    { buffer, encoding, "eol": "---", "maxSize": 5, "chunkSize": 1, "line": null, "rest": null },

    // pre-buffered, match
    { buffer, encoding, "eol": "--", "maxSize": null, "chunkSize": null, "preinit": true, "line": "12-34", "rest": "56--78-90" },
    { buffer, encoding, "eol": "--", "maxSize": 7, "chunkSize": null, "preinit": true, "line": "12-34", "rest": "56--78-90" },

    // pre-buffered, not match
    { buffer, encoding, "eol": "---", "maxSize": null, "chunkSize": null, "preinit": true, "line": null, "rest": null },
    { buffer, encoding, "eol": "---", "maxSize": 4, "chunkSize": null, "preinit": true, "line": null, "rest": "4--56--78-90" },
    { buffer, encoding, "eol": "---", "maxSize": 6, "chunkSize": null, "preinit": true, "line": null, "rest": "-56--78-90" },
];

const sleep = () => new Promise( resolve => setTimeout( resolve, 1 ) );

for ( let n = 0; n < TESTS.length; n++ ) {
    test( "read_line_" + n, async () => {
        const data = TESTS[n];

        const [line, rest] = await readLine( data );

        expect( line ).toBe( data.line );

        expect( rest ).toBe( data.rest );
    } );
}

async function readLine ( data ) {
    const stream = new Stream.Readable( { read () {} } );

    if ( data.preinit ) await push( stream, data );

    return new Promise( resolve => {
        stream.readLine( { "eol": data.eol, "encoding": data.encoding, "maxSize": data.maxSize } ).then( line => {
            const rest = stream.read();

            resolve( [line, rest == null ? rest : rest + ""] );
        } );

        if ( !data.preinit ) push( stream, data );
    } );
}

async function push ( stream, data ) {
    for ( const buf of data.buffer.split( new RegExp( `(.{1,${data.chunkSize}})` ) ).filter( buf => buf !== "" ) ) {
        stream.push( buf );

        await sleep( 1 );
    }

    // eof
    stream.push( null );
}
