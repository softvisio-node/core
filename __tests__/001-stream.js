import { jest } from "@jest/globals";

jest.setTimeout( 2000 );

import Stream from "../lib/stream";

const buffer = "12-34--56--78-90";
const encoding = "utf8";

const TESTS = [

    // match
    { buffer, encoding, "eol": "--", "maxSize": null, "chunkSize": 1, "line": "12-34", "rest": "5" },
    { buffer, encoding, "eol": "--", "maxSize": null, "chunkSize": null, "line": "12-34", "rest": "56--78-90" },
    { buffer, encoding, "eol": "--", "maxSize": null, "chunkSize": 2, "line": "12-34", "rest": "5" },
    { buffer, encoding, "eol": "--", "maxSize": null, "chunkSize": 3, "line": "12-34", "rest": "56" },
    { buffer, encoding, "eol": "--", "maxSize": null, "chunkSize": 7, "line": "12-34", "rest": null },

    // not match
    { buffer, encoding, "eol": "---", "maxSize": null, "chunkSize": 1, "line": null, "rest": buffer },
    { buffer, encoding, "eol": "---", "maxSize": null, "chunkSize": null, "line": null, "rest": buffer },
    { buffer, encoding, "eol": "---", "maxSize": 5, "chunkSize": 1, "line": null, "rest": "12-34-" },
];

const sleep = () => new Promise( resolve => setTimeout( resolve, 1 ) );

for ( let n = 0; n < TESTS.length; n++ ) {
    test( "test " + n, async () => {
        const data = TESTS[n];

        const [line, rest] = await run( data );

        expect( line ).toBe( data.line );

        expect( rest ).toBe( data.rest );
    } );
}

async function run ( data ) {
    const stream = new Stream.Readable( { read () {} } );

    return new Promise( resolve => {
        stream.readLine( { "eol": data.eol, "encoding": data.encoding, "maxSize": data.maxSize } ).then( line => {
            const rest = stream.read();

            resolve( [line, rest == null ? rest : rest + ""] );
        } );

        push( stream, data );
    } );
}

async function push ( stream, data ) {
    for ( const buf of data.buffer.split( new RegExp( `(.{1,${data.chunkSize}})` ) ).filter( buf => buf !== "" ) ) {
        stream.push( buf );

        await sleep( 1 );
    }

    stream.push( null );
}
