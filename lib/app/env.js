import env from "#lib/env";
import uuid from "#lib/uuid";
import path from "node:path";
import fs from "node:fs";

const dataDir = path.join( env.root, "data" ),
    tmpDir = path.posix.join( dataDir, ".run" );

fs.mkdirSync( dataDir, { "recursive": true } );

fs.rmSync( tmpDir, { "recursive": true, "force": true } );
fs.mkdirSync( tmpDir, { "recursive": true } );

export default class Env {
    #app;
    #config;
    #packageName;
    #instanceId;

    constructor ( app ) {
        this.#app = app;
    }

    // properties
    get mode () {
        return env.mode;
    }

    get isProduction () {
        return env.isProduction;
    }

    get isDevelopment () {
        return env.isDevelopment;
    }

    get root () {
        return env.root;
    }

    get dataDir () {
        return dataDir;
    }

    get tmpDir () {
        return tmpDir;
    }

    get clusterId () {
        return this.#app.cluster?.id;
    }

    get packageName () {
        return ( this.#packageName ??= env.package.name );
    }

    get serviceName () {
        return this.#app.components.service;
    }

    get instanceId () {
        if ( !this.#instanceId ) {
            const instanceIdPath = path.join( dataDir, ".instance-id" );

            if ( fs.existsSync( instanceIdPath ) ) {
                this.#instanceId = fs.readFileSync( instanceIdPath, "utf8" );
            }

            if ( !this.#instanceId ) {
                this.#instanceId = uuid();

                fs.writeFileSync( instanceIdPath, this.#instanceId );
            }
        }

        return this.#instanceId;
    }

    // XXX
    // get unixSocketsDir () {
    //     if ( !this.#unixSocketsDir ) {
    //         this.#unixSocketsDir = "/var/run/" + this.instanceId;

    //         fs.mkdirSync( this.#unixSocketsDir, { "recursive": true } );
    //     }

    //     return this.#unixSocketsDir;
    // }
}
