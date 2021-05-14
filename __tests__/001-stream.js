import { jest } from "@jest/globals";

import Stream from "../lib/stream";

jest.setTimeout( 5000 );

const buffer = "12-34--56--78-90";

const TESTS = [
    {
        buffer,
        "eol": "--",
        "encoding": "utf8",
        "maxSize": null,
        "chunkSize": 1,
        "line": "12-34",
        "rest": "56--78-90",
    },
    {
        buffer,
        "eol": "---",
        "encoding": "utf8",
        "maxSize": null,
        "chunkSize": 1,
        "line": undefined,
        "rest": buffer,
    },
];

for ( const data of TESTS ) {
    test( "1", async () => {
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

            resolve( [line, rest + ""] );
        } );

        for ( const buf of data.buffer.split( new RegExp( `(.{1,${data.chunkSize}})` ) ).filter( buf => buf !== "" ) ) {
            stream.push( buf );
        }

        stream.push( null );
    } );
}
