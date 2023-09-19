import fs from "node:fs";
import path from "node:path";

export default class PostgreSqlCluster {
    #name;
    #version;
    #binDir;
    #dataDir;
    #backupsDir;
    #baseConfigPath;
    #userConfigPath;
    #replicationConfigPath;

    constructor ( dataRoot, name, version ) {
        this.#name = name;
        this.#version = +version;

        this.#binDir = `/usr/lib/postgresql/${this.#version}/bin`;
        this.#dataDir = path.join( dataRoot, this.#version + "", this.#name );
        this.#backupsDir = path.join( dataRoot, this.#version + "", this.#name + ".backups" );

        this.#baseConfigPath = this.#dataDir + "/conf.d/0-postgresql.conf";
        this.#userConfigPath = this.#dataDir + "/conf.d/10-user.conf";
        this.#replicationConfigPath = this.#dataDir + "/conf.d/20-replication.conf";
    }

    // properties
    get name () {
        return this.#name;
    }

    get version () {
        return this.#version;
    }

    get binDir () {
        return this.#binDir;
    }

    get dataDir () {
        return this.#dataDir;
    }

    get backupsDir () {
        return this.#backupsDir;
    }

    get isExists () {
        return fs.existsSync( this.dataDir + "/PG_VERSION" );
    }

    get binIsExists () {
        return fs.existsSync( this.#binDir );
    }

    get baseConfigPath () {
        return this.#baseConfigPath;
    }

    get userConfigPath () {
        return this.#userConfigPath;
    }

    get replicationConfigPath () {
        return this.#replicationConfigPath;
    }
}
