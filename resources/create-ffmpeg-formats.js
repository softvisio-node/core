#!/usr/bin/env node

import childProcess from "node:child_process";
import { writeConfigSync } from "#lib/config";
import externalResources from "#lib/external-resources";

var FFMPEG_EXECUTABLE_PATH;

if ( process.platform === "win32" ) {
    var FFMPEG_RESOURCE = await externalResources.add( "softvisio-node/core/resources/ffmpeg-win32" ).check();

    FFMPEG_EXECUTABLE_PATH = FFMPEG_RESOURCE.getResourcePath( "bin/ffmpeg.exe" );
}
else {
    FFMPEG_EXECUTABLE_PATH = "ffmpeg";
}

const formats = getFormats();

const extnames = {};

for ( const format of Object.values( formats ) ) {
    for ( const extname of format.extnames ) {
        extnames[ extname ] ||= [];
        extnames[ extname ].push( format.format );
    }
}

for ( const extname in extnames ) {
    if ( extnames[ extname ].length > 1 ) {
        console.log( `Extname conflict: "${ extname }", formats:`, extnames[ extname ] );
    }
}

writeConfigSync( "ffmpeg-formats.json", formats, { "readable": true } );

function getFormats () {
    const formats = {},
        data = execFfmpeg( "-formats" );

    for ( const line of data.split( /\r?\n/ ).slice( 5 ) ) {
        const [ type, format ] = line.trim().split( / +/ );

        formats[ format ] = {
            format,
            "encode": type[ 1 ] === "E",
            "decode": type[ 0 ] === "D",
            "device": type[ 2 ] === "d",
            "extnames": [],
            "type": null,
        };
    }

    for ( const format of Object.values( formats ) ) {
        parseFormat( format );
    }

    return formats;
}

function parseFormat ( format ) {
    if ( format.encode ) {
        const data = execFfmpeg( "-i", format.format, "-h", "muxer=" + format.format );

        for ( let line of data.split( /\r?\n/ ) ) {
            line = line.trim();

            if ( line.startsWith( "Common extensions:" ) ) {
                const extnames = line.slice( 19, -1 ).split( "," );

                format.extnames = [ ...new Set( [ ...format.extnames, ...extnames ] ) ].sort();
            }
            else if ( line.startsWith( "Mime type:" ) ) {
                format.type = line.slice( 11, -1 );
            }
        }
    }

    if ( format.decode ) {
        const data = execFfmpeg( "-i", format.format, "-h", "demuxer=" + format.format );

        for ( let line of data.split( /\r?\n/ ) ) {
            line = line.trim();

            if ( line.startsWith( "Common extensions:" ) ) {
                const extnames = line.slice( 19, -1 ).split( "," );

                format.extnames = [ ...new Set( [ ...format.extnames, ...extnames ] ) ].sort();
            }
        }
    }
}

function execFfmpeg ( ...args ) {
    return childProcess.execFileSync( FFMPEG_EXECUTABLE_PATH, [ "-hide_banner", ...args ], {
        "encoding": "utf8",
    } );
}
