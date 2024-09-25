#!/usr/bin/env node

import { suite, test } from "node:test";
import { strictEqual } from "node:assert";
import _stream from "#lib/stream";

const buffer = "12-34--56--78-90";
const encoding = "utf8";

const READ_LINE = [

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
    { buffer, encoding, "eol": "---", "maxLength": null, "chunkSize": null, "line": undefined, "rest": "" },
    { buffer, encoding, "eol": "---", "maxLength": null, "chunkSize": 1, "line": undefined, "rest": "" },
    { buffer, encoding, "eol": "---", "maxLength": 5, "chunkSize": 1, "line": undefined, "rest": undefined, "exception": true },

    // pre-buffered, match
    { buffer, encoding, "eol": "--", "maxLength": null, "chunkSize": null, "preinit": true, "line": "12-34", "rest": "56--78-90" },
    { buffer, encoding, "eol": "--", "maxLength": 7, "chunkSize": null, "preinit": true, "line": "12-34", "rest": "56--78-90" },

    // pre-buffered, not match
    { buffer, encoding, "eol": "---", "maxLength": null, "chunkSize": null, "preinit": true, "line": undefined, "rest": undefined },
    { buffer, encoding, "eol": "---", "maxLength": 4, "chunkSize": null, "preinit": true, "line": undefined, "rest": undefined, "exception": true },
    { buffer, encoding, "eol": "---", "maxLength": 6, "chunkSize": null, "preinit": true, "line": undefined, "rest": undefined, "exception": true },
];

const READ_CHUNK = [
    { buffer, encoding, "length": 1, "line": "1", "rest": "2-34--56--78-90" },
    { buffer, encoding, "length": 5, "line": "12-34", "rest": "--56--78-90" },
    { buffer, encoding, "length": 16, "line": "12-34--56--78-90", "rest": "" },
    { buffer, encoding, "length": 100, "line": undefined, "rest": "" },
];

const sleep = () => new Promise( resolve => setTimeout( resolve, 1 ) );

suite( "stream", () => {

    // read line
    suite( "readline", () => {
        for ( let n = 0; n < READ_LINE.length; n++ ) {
            test( "read_line_" + n, async () => {
                const data = READ_LINE[ n ];

                const [ line, rest, exception ] = await readLine( data );

                strictEqual( line, data.line );

                strictEqual( rest, data.rest );

                strictEqual( !!exception, !!data.exception );
            } );
        }
    } );

    // read chunk
    suite( "readchunk", () => {
        for ( let n = 0; n < READ_CHUNK.length; n++ ) {
            test( "read_chunk_" + n, async () => {
                const data = READ_CHUNK[ n ];

                const [ line, rest ] = await readChunk( data );

                strictEqual( line, data.line );

                strictEqual( rest, data.rest );
            } );
        }
    } );
} );

async function readLine ( data ) {
    const stream = new _stream.Readable( { read () {} } );

    if ( data.preinit ) await push( stream, data );
    else push( stream, data );

    var exception;

    const line = await stream.readLine( { "eol": data.eol, "encoding": data.encoding, "maxLength": data.maxLength } ).catch( e => {
        exception = true;
    } );

    const rest = await stream.buffer();

    return [ line, rest
        ? rest.toString()
        : rest, exception ];
}

async function readChunk ( data ) {
    const stream = new _stream.Readable( { read () {} } );

    if ( data.preinit ) await push( stream, data );
    else push( stream, data );

    const line = await stream.readChunk( data.length, { "encoding": data.encoding } );

    return [ line, await stream.text() ];
}

async function push ( stream, data ) {
    await sleep( 1 );

    for ( const buf of data.buffer.split( new RegExp( `(.{1,${ data.chunkSize }})` ) ).filter( buf => buf !== "" ) ) {
        stream.push( buf );
        await sleep( 1 );
    }

    // eof
    stream.push( null );
    await sleep( 1 );
}
