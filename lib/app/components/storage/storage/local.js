import Storage from "../storage.js";
import fs from "node:fs";
import path from "node:path";
import env from "#lib/env";

export default class LocalStorage extends Storage {
    #location;

    constructor ( app, config ) {
        super( app, config );

        this.#location = path.jois( env.root, "data/storage" );
    }

    // protected
    async _init () {
        if ( !fs.existsSync( this.#location ) ) fs.mkdirSync( this.#location, { "recursive": true } );

        return result( 200 );
    }
}
