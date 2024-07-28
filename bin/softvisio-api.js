#!/usr/bin/env node

import Cli from "#lib/cli";
import Api from "#lib/api";

const CLI = {
    "title": "Core API client",
    "globalOptions": {
        "url": {
            "description": "API url",

            // XXX
            // "default": "http://127.0.0.1:81/api",
            "required": true,

            "schema": {
                "type": "string",
                "format": "uri-whatwg",
            },
        },
        "default-version": {
            "short": "v",
            "description": "default API version",
            "default": 1,
            "schema": {
                "type": "integer",
            },
        },
        "token": {
            "description": "API token",
            "schema": {
                "type": "string",
            },
        },
    },
    "commands": {
        "schema": {
            "title": "get API schema",
            "arguments": {
                "method": {
                    "description": "API method pattern",
                    "schema": {
                        "type": "string",
                    },
                },
            },
        },

        "call": {
            "title": "make API call",
            "arguments": {
                "method": {
                    "description": "API method",
                    "required": true,
                    "schema": {
                        "type": "string",
                    },
                },
                "argument": {
                    "description": "API method argument in JSON format",
                    "schema": {
                        "type": "array",
                        "items": { "type": "string" },
                    },
                },
            },
        },
    },
};

await Cli.parse( CLI );

const api = new Api( process.cli.globalOptions.url, {
    "version": process.cli.globalOptions[ "default-version" ],
    "token": process.cli.globalOptions.token,
} );

var res;

// schema
if ( process.cli.command === "schema" ) {
    res = await schema();
}

// call
else if ( process.cli.command === "call" ) {
    res = await call();
}

if ( res.ok ) {
    process.exit();
}
else {
    process.exit( 1 );
}

async function schema () {
    const res = await api.call( "/get-schema" );

    if ( !res.ok ) {
        console.log( JSON.stringify( res, null, 4 ) );
    }
    else {
        const methods = {};

        for ( const version of Object.keys( res.data.versions ).sort() ) {
            for ( const module of Object.keys( res.data.versions[ version ] ).sort() ) {
                for ( const methodId of Object.keys( res.data.versions[ version ][ module ].methods ).sort() ) {
                    const method = res.data.versions[ version ][ module ].methods[ methodId ];

                    methods[ method.id ] = method;
                }
            }
        }

        if ( process.cli.arguments.method && methods[ process.cli.arguments.method ] ) {
            console.log( JSON.stringify( methods[ process.cli.arguments.method ], null, 4 ) );
        }
        else {
            console.log( "Emits:\n" );

            for ( const name of res.data.emits ) {
                console.log( name );
            }

            console.log( "\nMetods:\n" );

            for ( const method of Object.values( methods ) ) {
                console.log( `${ method.id }    ${ method.title }` );
            }
        }
    }

    return res;
}

async function call () {
    const args = [];

    if ( process.cli.arguments.argument ) {
        for ( const arg of process.cli.arguments.argument ) {
            args.push( JSON.parse( arg ) );
        }
    }

    const res = await api.call( process.cli.arguments.method, ...args );

    console.log( JSON.stringify( res, null, 4 ) );

    return res;
}
