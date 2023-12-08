import GoogleCloudStorage from "#lib/api/google/cloud/storage";
import path from "node:path";

export default class {
    #storage;
    #location;
    #deduplicate;
    #name;
    #api;

    constructor ( storage, location, { deduplicate, name, serviceAccount } = {} ) {
        this.#storage = storage;
        this.#location = location;
        this.#deduplicate = deduplicate;
        this.#name = name;

        this.#api = new GoogleCloudStorage( serviceAccount );
    }

    // properties
    get location () {
        return this.#location;
    }

    get deduplicate () {
        return this.#deduplicate;
    }

    get name () {
        return this.#name;
    }

    // public
    async init () {
        var res;

        res = await this.#api.getBucket( this.#name );

        if ( !res.ok ) {
            if ( res.status !== 404 ) return res;

            // create bucket
            res = await this.#api.createBucket( this.#name );

            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    async imageExists ( _path ) {
        _path = this.#buildImagePath( _path );

        const res = await this.#api.getFileMetadata( _path );

        if ( res.status === 606 ) {
            return false;
        }
        else if ( !res.ok ) {
            return null;
        }
        else {
            return true;
        }
    }

    async uploadImage ( _path, file ) {
        return this.#api.uploadFile( this.#buildImagePath( _path ), file );
    }

    async deleteImage ( _path ) {
        const res = await this.#api.deleteFile( this.#buildImagePath( _path ) );

        if ( res.status === 404 ) return result( 200 );

        return res;
    }

    async getFile ( file ) {
        const res = await this.#api.getFile( this.#buildImagePath( file.path ) );

        if ( !res.ok ) return res;

        res.data.name = path.basename( file.path );

        res.data.type = file.contentType;

        return result( 200, res.data );
    }

    async downloadFile ( req, _path, headers ) {
        req.end( {
            "headers": headers,
            "body": async () => {
                const reqHeaders = {};

                const range = req.headers.get( "range" );
                if ( range ) reqHeaders.range = range;

                const res = await this.#api.getFileHttpResponse( this.#buildImagePath( _path ), {
                    "method": req.method,
                    "headers": reqHeaders,
                } );

                if ( !res.ok ) {
                    return result( res.status );
                }
                else {
                    const headers = {};

                    if ( range ) {
                        headers["content-length"] = res.headers.contentLength;

                        if ( res.headers.has( "content-range" ) ) {
                            headers["content-range"] = res.headers.get( "content-range" );
                        }
                    }

                    return result( res.status, {
                        headers,
                        "body": res.body,
                    } );
                }
            },
        } );
    }

    // private
    #buildImagePath ( _path ) {
        return path.posix.join( this.#name, _path.substring( this.#location.length ) );
    }
}
