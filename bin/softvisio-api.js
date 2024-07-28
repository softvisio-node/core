#!/usr/bin/env node

import Cli from "#lib/cli";
import Api from "#lib/api";

const CLI = {
    "title": "Core API client",
    "globalOptions": {
        "url": {
            "description": "API url",

            // "required": true,
            "schema": {
                "type": "string",
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
                "url": {
                    "description": "API url",
                    "required": true,
                    "schema": {
                        "type": "string",
                    },
                },
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
                "url": {
                    "description": "API url",
                    "required": true,
                    "schema": {
                        "type": "string",
                    },
                },
                "method": {
                    "description": "API method",
                    "required": true,
                    "schema": {
                        "type": "string",
                    },
                },
            },
        },
    },
};

await Cli.parse( CLI );

var url = process.cli.arguments.url;

if ( !url.startsWith( "http://" ) && !url.startsWith( "https://" ) && !url.startsWith( "ws://" ) && !url.startsWith( "wss://" ) ) {
    url = "http://" + url;
}

const api = new Api( url, {
    "version": process.cli.globalOptions[ "default-version" ],
    "token": process.cli.globalOptions.token,
} );

if ( process.cli.command === "schema" ) {
    const res = await api.call( "get-schema" );

    console.log( res );
}
else if ( process.cli.command === "call" ) {
    const res = await api.call( process.cli.arguments.method );

    console.log( res );
}
