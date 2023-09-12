import env from "#lib/env";
import uuid from "#lib/uuid";
import path from "node:path";
import fs from "node:fs";

const dataDir = path.join( env.root, "data" ),
    instanceIdPath = path.join( dataDir, ".instance-id" );

fs.mkdirSync( dataDir, { "recursive": true } );

export default class Env {
    #app;
    #config;
    #packageName;
    #serviceName;
    #instanceId;
    #dataDir = dataDir;

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
        return this.#dataDir;
    }

    get clusterId () {
        return this.#app.cluster?.id;
    }

    get packageName () {
        return ( this.#packageName ??= env.package.name );
    }

    get serviceName () {
        return ( this.#serviceName ??= this.#app.components.service );
    }

    get instanceId () {
        if ( !this.#instanceId ) {
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
}
