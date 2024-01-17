import env from "#lib/env";
import uuid from "#lib/uuid";
import path from "node:path";
import fs from "node:fs";

export default class Env {
    #app;
    #config;
    #packageName;
    #instanceId;
    #dataDir;
    #tmpDir;

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
        if ( !this.#dataDir ) {
            this.#dataDir = path.join( env.root, "data" );

            fs.mkdirSync( this.#dataDir, { "recursive": true } );
        }

        return this.#dataDir;
    }

    // XXX
    get tmpDir () {
        if ( !this.#tmpDir ) {

            // process.platform === "win32"

            this.#tmpDir = path.posix.join( this.dataDir, ".tmo" );

            fs.rmSync( this.#tmpDir, { "recursive": true, "force": true } );

            fs.mkdirSync( this.#tmpDir, { "recursive": true } );
        }

        return this.#tmpDir;
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
            const instanceIdPath = path.join( this.dataDir, ".instance-id" );

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
