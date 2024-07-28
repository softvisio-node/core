#!/usr/bin/env node

import Cli from "#lib/cli";
import Api from "#lib/api";

const CLI = {
    "title": "Core API client",
    "globalOptions": {
        "url": {

            // XXX
            // "required": true,

            "description": "API url",
            "default": "http://127.0.0.1:81/api",
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

// schema
if ( process.cli.command === "schema" ) {
    const res = await api.getSchema();

    // XXX filter methods

    console.log( res );
}

// call
else if ( process.cli.command === "call" ) {
    const args = [];

    if ( process.cli.arguments.argument ) {
        for ( const arg of process.cli.arguments.argument ) {
            args.push( JSON.parse( arg ) );
        }
    }

    const res = await api.call( process.cli.arguments.method, ...args );

    console.log( res );
}
