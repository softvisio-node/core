#!/usr/bin/env node

import Cli from "#lib/cli";
import Api from "#lib/api";

const CLI = {
    "title": "Core API client",
    "description": `
# Connect to the docker stack:

    docker run --rm -it --entrypoint=/bin/bash --network=<STACK-NETWORK-NAME> ghcr.io/zerocluster/cluster

# Connect to the docker container:

    docker exec -it <CONTAINER-ID> /bin/bash
`.trim(),
    "globalOptions": {
        "url": {
            "description": "API url",

            // XXX
            "default": "http://127.0.0.1:81/api",

            // "required": true,

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
        "json": {
            "short": "j",
            "description": "output in JSON format",
            "default": false,
            "schema": {
                "type": "boolean",
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

class ApiCli {
    #url;
    #version;
    #token;
    #json;
    #api;

    constructor ( { url, version, token, json } ) {
        this.#url = url;
        this.#version = version;
        this.#token = token;
        this.#json = json;
    }

    // public
    // XXX json
    async schema ( method ) {
        const res = await this.#getApi().call( "/get-schema" );

        if ( !res.ok ) return this.#logError( res );

        const methods = {};

        for ( const version of Object.keys( res.data.versions ).sort() ) {
            for ( const module of Object.keys( res.data.versions[ version ] ).sort() ) {
                for ( const methodId of Object.keys( res.data.versions[ version ][ module ].methods ).sort() ) {
                    const method = res.data.versions[ version ][ module ].methods[ methodId ];

                    methods[ method.id ] = method;
                }
            }
        }

        if ( method && methods[ method ] ) {
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

        return res;
    }

    async call ( method, ...args ) {
        const parans = [];

        for ( const arg of args ) {
            parans.push( JSON.parse( arg ) );
        }

        const res = await this.#getApi().call( method, ...parans );

        if ( !res.ok ) return this.#logError( res );

        console.log( JSON.stringify( res, null, 4 ) );

        return res;
    }

    // private
    #getApi () {
        this.#api ??= new Api( this.#url, {
            "version": this.#version,
            "token": this.#token,
        } );

        return this.#api;
    }

    #logError ( res ) {
        if ( res.ok ) return;

        if ( this.#json ) {
            console.log( JSON.stringify( res, null, 4 ) );
        }
        else {
            console.log( res + "" );
        }

        return res;
    }
}

await Cli.parse( CLI );

const apiCli = new ApiCli( {
    "url": process.cli.globalOptions.url,
    "version": process.cli.globalOptions[ "default-version" ],
    "token": process.cli.globalOptions.token,
    "json": process.cli.globalOptions.json,
} );

var res;

if ( process.cli.command === "schema" ) {
    res = await apiCli.schema( process.cli.arguments.method );
}
else if ( process.cli.command === "call" ) {
    res = await apiCli.call( process.cli.arguments.method, ...process.cli.arguments.argument );
}

if ( res.ok ) {
    process.exit();
}
else {
    process.exit( 1 );
}
