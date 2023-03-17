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

    async _uploadFile ( name, file ) {
        const stream = fs.createWriteStream( path.join( this.#location, name ) );

        return new Promise( resolve => {
            stream.once( "close", () => resolve( result( 200 ) ) );

            file.stream().pipe( stream );
        } );
    }

    async _deleteFile ( name ) {
        await fs.promises.rm( path.join( this.#location, name ), { "force": true } );

        return result( 299 );
    }

    async _getFileStream ( name ) {
        return result( 200, fs.createReadStream( path.join( this.#location, name ) ) );
    }
}
