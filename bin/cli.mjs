#!/usr/bin/env node

import softvisioCliApi from "../lib/api.js";
import net from "net";
import readline from "readline";
import { default as eslintApi } from "eslint/lib/cli-engine/cli-engine.js";
import _prettier from "../lib/prettier.js";
import { default as prettierApi } from "prettier";
import { default as terserApi } from "terser";

const api = new softvisioCliApi();

var server = net.createServer( function ( socket ) {
    var rl = readline.createInterface( socket, socket );

    rl.on( "line", function ( line ) {
        onCommand( line, function ( data ) {
            socket.write( data + "\n" );
        } );
    } );
} );

server.listen( 55556, "127.0.0.1" );

function onCommand ( data, req ) {
    data = JSON.parse( data );

    var res;

    if ( data.command === "prettier" ) {
        res = prettier( data );
    }
    else if ( data.command === "eslint" ) {
        res = eslint( data );
    }
    else if ( data.command === "terser" ) {
        res = terser( data );
    }
    else {
        res = {
            "status": 0,
            "reason": "Invalid command",
        };
    }

    req( JSON.stringify( res ) );
}

function eslint ( data ) {
    let engine;

    try {
        engine = new eslintApi.CLIEngine( data.options );
    }
    catch ( error ) {
        return {
            "status": 0,
            "reason": error.message,
        };
    }

    const report = engine.executeOnText( data.data, data.path, true );

    return {
        "status": 1,
        "result": report.results,
    };
}

function prettier ( data ) {
    var res;

    var options;

    try {
        const config = prettierApi.resolveConfig.sync( data.options.filepath, {
            "editorconfig": data.options.editorconfig,
            "config": data.options.config,
        } );

        options = { ...data.options, ...config };
    }
    catch ( error ) {
        return {
            "status": 0,
            "reason": error.message,
        };
    }

    try {
        res = prettierApi.format( data.data, options );
    }
    catch ( error ) {
        return {
            "status": 0,
            "reason": error.message,
        };
    }

    return {
        "status": 1,
        "result": res,
    };
}

function terser ( data ) {
    var res;

    try {
        res = terserApi.minify( data.data, data.options );
    }
    catch ( error ) {
        return {
            "status": 0,
            "reason": error.message,
        };
    }

    if ( res.error ) {
        return {
            "status": 0,
            "reason": res.error.message,
        };
    }
    else {
        return {
            "status": 1,
            "result": res.code,
        };
    }
}
// -----SOURCE FILTER LOG BEGIN-----
//
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
// | Sev.  | Line:Col      | Rule                         | Description                                                                    |
// |=======+===============+==============================+================================================================================|
// |  WARN | 7:8           | no-unused-vars               | '_prettier' is defined but never used.                                         |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// |  WARN | 11:7          | no-unused-vars               | 'api' is assigned a value but never used.                                      |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----
