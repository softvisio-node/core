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
            },
        },
    },
};

await Cli.parse( CLI );

const url = new URL( process.cli.options.url, "http://" );

const api = new Api( url, {
    "version": process.cli.options[ "default-version" ],
    "token": process.cli.options.token,
} );

const res = await api.call( process.cli.arguments.method );

console.log( res );
