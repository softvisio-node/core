// XXX after migrated to webpack 5
// const Events = require( "#lib/events" );
import Events from "../../events.js";
import result from "../../result.js";

const STATUS = {
    "STARTING": "Starting",
    "HASH": "Calculating hash",
    "UPLOADING": "Uploading",
    "DONE": "Done",
    "CANCELED": "Canceled",
};

var id = 0;

export default class Upload extends Events {
    #api;
    #method;
    #file;
    #options;
    #onProgress;

    #id = ++id;
    #name;
    #size;
    #type;
    #fh;
    #isStarted = false;
    #isFinished = false;

    // result
    #ok;
    #status;
    #reason;
    #progress = 0;
    data;

    constructor ( api, method, file, options, onProgress ) {
        super();

        this.#api = api;
        this.#method = method;
        this.#file = file;
        this.#options = options;
        this.#onProgress = onProgress;

        this.#name = api.uploadGetFileName( file );
    }

    get id () {
        return this.#id;
    }

    get name () {
        return this.#name;
    }

    get size () {
        return this.#size;
    }

    get type () {
        return this.#type;
    }

    get ok () {
        return this.#ok;
    }

    get status () {
        return this.#status;
    }

    get reason () {
        return this.#reason;
    }

    get progress () {
        return this.#progress;
    }

    async start () {
        if ( this.#isStarted ) return;

        this.#isStarted = true;

        // operation is finished
        if ( this.#setProgress( STATUS.STARTING, 0 ) ) return;

        // get file stats
        try {
            const stats = await this.#api.uploadGetFileStats( this.#file );

            this.#size = stats.size;
            this.#type = stats.type;
        }
        catch ( e ) {
            return this.#finish( result( [500, e.message] ) );
        }

        // operation canceled
        if ( this.#isFinished ) return;

        var res = await this.#api.call( this.#method, {
            "name": this.#name,
            "size": this.#size,
            "type": this.#type,
            "data": this.#options,
        } );

        // operation canceled
        if ( this.#isFinished ) return;

        // server error
        if ( !res.ok ) return this.#finish( res );

        const id = res.data.id,
            chunkSize = res.data.chunkSize,
            hashIsRequired = res.data.hashIsRequired;

        // create file handle
        try {
            this.#fh = await this.#api.uploadOpenFile( this.#file );
        }
        catch ( e ) {
            return this.#finish( result( [500, e.message] ) );
        }

        // operation canceled
        if ( this.#isFinished ) return;

        var offset = 0;

        // calculating hash
        if ( hashIsRequired ) {

            // operation canceled
            if ( this.#setProgress( STATUS.HASH, 0 ) ) return;

            const hash = await this.#api.uploadCreateHashObject();

            // calculate hash
            while ( 1 ) {
                let chunk;

                try {
                    chunk = await this.#api.uploadReadFileChunk( this.#fh, offset, chunkSize );
                }
                catch ( e ) {

                    // chunk read error
                    return this.#finish( result( [500, e.message] ) );
                }

                // operation canceled
                if ( this.#isFinished ) return;

                hash.update( chunk );

                offset += chunk.byteLength;

                // operation canceled
                if ( this.#setProgress( STATUS.HASH, offset / this.#size ) ) return;

                // last chunk
                if ( offset >= this.#size ) break;
            }

            // send hash
            res = await this.#api.call( this.#method, {
                "id": id,
                "hash": hash.digest( "hex" ),
            } );

            // operation canceled
            if ( this.#isFinished ) return;

            if ( !res.ok ) return this.#finish( res );
        }

        offset = 0;

        // operation canceled
        if ( this.#setProgress( STATUS.UPLOADING, 0 ) ) return;

        // send file body
        while ( 1 ) {
            let chunk;

            try {
                chunk = await this.#api.uploadReadFileChunk( this.#fh, offset, chunkSize );
            }
            catch ( e ) {

                // chunk read error
                return this.#finish( result( [500, e.message] ) );
            }

            // operation canceled
            if ( this.#isFinished ) return;

            // upload chunk
            res = await this.#api.uploadChunk( this.#method, id, offset, chunk );

            // operation canceled
            if ( this.#isFinished ) return;

            offset += chunk.byteLength;

            // server error
            if ( !res.ok ) {
                return this.#finish( res );
            }
            else {

                // operation canceled
                if ( this.#setProgress( STATUS.UPLOADING, offset / this.#size ) ) return;

                // last chunk
                if ( offset >= this.#size ) return this.#finish( res );
            }
        }
    }

    cancel () {
        this.#finish( result( [400, STATUS.CANCELED] ) );
    }

    toString () {
        return this.#reason;
    }

    // PRIVATE METHODS
    #setProgress ( reason, progress ) {
        if ( reason != null ) this.#reason = reason;

        if ( progress != null ) this.#progress = progress;

        if ( this.#onProgress ) this.#onProgress( this, this.#reason, this.#progress );

        // operation is finished
        if ( this.#isFinished ) return true;
    }

    #finish ( res ) {

        // already finished
        if ( this.#isFinished ) return;

        // mark as finished
        this.#isFinished = true;

        this.#ok = res.ok;
        this.#status = res.status;
        this.data = res.data;

        if ( res.ok ) {
            this.#setProgress( STATUS.DONE, 1 );
        }
        else {
            this.#setProgress( res.reason );
        }

        // close fh
        if ( this.#fh ) {
            this.#api.uploadCloseFile( this.#fh );

            this.#fh = null;
        }

        // cleanup
        this.#api = null;
        this.#onProgress = null;
    }
}
