import env from "#lib/env";
import uuidV4 from "#lib/uuid";
import fs from "node:fs";

const dataDir = env.root + "/data",
    instanceIdPath = dataDir + "/.instance-id";

export default class id {
    #app;
    #config;
    #packageName;
    #serviceName;
    #instanceId;
    #dataDir = dataDir;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
    }

    // properties
    get dataDir () {
        return this.#dataDir;
    }

    get clusterId () {
        return this.#app.cluster?.id;
    }

    get packageName () {
        return this.#packageName;
    }

    get serviceName () {
        return this.#serviceName;
    }

    get instanceId () {
        return this.#instanceId;
    }

    // public
    async init () {
        this.#packageName = env.package.name;

        this.#serviceName = this.#app.components.service;

        fs.mkdirSync( this.#dataDir, { "recursive": true } );

        if ( fs.existsSync( instanceIdPath ) ) {
            this.#instanceId = fs.readFileSync( instanceIdPath, "utf8" );
        }
        else {
            this.#instanceId = uuidV4();

            fs.writeFileSync( instanceIdPath, this.#instanceId );
        }

        return result( 200 );
    }
}
