import "#lib/result";
import crypto from "node:crypto";
import fs from "node:fs";
import GitHub from "#lib/api/github";
import env from "#lib/env";
import externalResoources from "#lib/external-resources";
import File from "#lib/file";
import stream from "#lib/stream";
import tar from "#lib/tar";
import ansi from "#lib/text/ansi";
import { TmpDir } from "#lib/tmp";

env.loadUserEnv();

const HASH_ALGORITHM = "SHA256",
    HASH_ENCODING = "base64url";

export default class ExternalRecourceBuilder {
    #id;
    #repository;
    #tag;
    #name;
    #githubToken;
    #etag;
    #buildDate;
    #expires;
    #meta;

    constructor ( id, { githubtoken } = {} ) {
        if ( id ) {
            this.#id = this.buildResourceId( id );
        }

        this.#githubToken = githubtoken || process.env.GITHUB_TOKEN;

        const [ owner, repo, tag, name ] = this.id.split( "/" );

        this.#repository = owner + "/" + repo;
        this.#tag = tag;
        this.#name = name;
    }

    // statid
    static async build ( resources, { force } = {} ) {
        var pad = 0;

        resources = resources.map( resource => {
            if ( typeof resource === "function" ) resource = new resource();

            if ( resource.name.length > pad ) pad = resource.name.length;

            return resource;
        } );

        const cache = {};

        for ( const resource of resources ) {
            process.stdout.write( `Building resource "${ resource.name }" ... `.padEnd( pad + 25 ) );

            const res = await resource.build( {
                force,
                cache,
            } );

            if ( res.ok ) {
                console.log( ansi.ok( " " + res.statusText + " " ) );
            }
            else {
                if ( res.status === 304 ) {
                    console.log( res.statusText );
                }
                else {
                    console.log( ansi.error( " " + res.statusText + " " ) );

                    return res;
                }
            }
        }

        return result( 200 );
    }

    // properties
    get id () {
        return this.#id;
    }

    get repository () {
        return this.#repository;
    }

    get tag () {
        return this.#tag;
    }

    get name () {
        return this.#name;
    }

    get etag () {
        return this.#etag;
    }

    get buildDate () {
        return this.#buildDate;
    }

    get expires () {
        return this.#expires;
    }

    get meta () {
        return this.#meta;
    }

    // public
    async build ( { force, cache } = {} ) {
        return this.#build( { force, cache } );
    }

    buildResourceId ( id, { tag, napi, node, platform, architecture } = {} ) {
        return externalResoources.buildResourceId( id, { tag, napi, node, platform, architecture } );
    }

    // protected
    async _getEtag ( { etag, buildDate, meta } ) {
        return result( [ 400, `Etog is not defined` ] );
    }

    async _build ( location ) {
        return result( [ 400, `Builder not defined` ] );
    }

    async _getExpires () {
        return result( 200 );
    }

    async _getMeta () {
        return result( 200 );
    }

    _getHash () {
        return crypto.createHash( HASH_ALGORITHM );
    }

    async _getFileHash ( path ) {
        return this._getStreamHash( fs.createReadStream( path ) );
    }

    async _getStreamHash ( stream ) {
        return new Promise( resolve =>
            stream.pipe( this._getHash().setEncoding( HASH_ENCODING ) ).on( "finish", function () {
                resolve( this.read() );
            } ) );
    }

    async _getLastModified ( url ) {
        const res = await fetch( url, {
            "method": "head",
        } ).catch( e => result.catch( e, { "log": false } ) );

        // request error
        if ( !res.ok ) return res;

        const lastModified = res.headers.get( "last-modified" );

        if ( lastModified ) {
            return result( 200, new Date( lastModified ) );
        }
        else {
            return result( [ 500 ] );
        }
    }

    // private
    async #build ( { force, cache } = {} ) {
        if ( !this.#githubToken ) {
            return result( [ 500, `GitHub token not found` ] );
        }

        const gitHubApi = new GitHub( this.#githubToken );

        var res;

        // get remote index
        res = await this.#getIndex( gitHubApi, cache );
        if ( !res.ok ) return res;
        var index = res.data;

        this.#etag = index[ this.#name ]?.etag;
        this.#buildDate = index[ this.#name ]?.buildDate
            ? new Date( index[ this.#name ].buildDate )
            : null;
        this.#expires = index[ this.#name ]?.expires
            ? new Date( index[ this.#name ].expires )
            : null;
        this.#meta = index[ this.#name ]?.meta;

        // get etag
        try {
            res = result.try( await this._getEtag() );
        }
        catch ( e ) {
            res = result.catch( e, { "log": false } );
        }
        if ( !res.ok ) return res;

        const etag = await this.#prepareEtag( res.data );

        // not modified
        if ( !force && ( etag == null || etag === index[ this.#name ]?.etag ) ) return result( 304 );

        // get expires
        try {
            res = result.try( await this._getExpires() );
        }
        catch ( e ) {
            res = result.catch( e, { "log": false } );
        }
        if ( !res.ok ) return res;

        const expires = res.data
            ? new Date( res.data )
            : null;

        // get meta data
        try {
            res = result.try( await this._getMeta() );
        }
        catch ( e ) {
            res = result.catch( e, { "log": false } );
        }
        if ( !res.ok ) return res;

        const meta = res.data ?? null;

        const tmp = new TmpDir();

        // build
        try {
            res = result.try( await this._build( tmp.path ) );
        }
        catch ( e ) {
            res = result.catch( e, { "log": false } );
        }
        if ( !res.ok ) return res;

        const assetPath = tmp.path + "/" + this.#name + ".tar.gz";

        tar.create( {
            "cwd": tmp.path,
            "gzip": true,
            "portable": true,
            "sync": true,
            "file": assetPath,
        } );

        // upload asset tar.gz
        res = await this.#uploadAsset(
            gitHubApi,
            new File( {
                "path": assetPath,
            } )
        );
        if ( !res.ok ) return res;

        // get latest remote index
        res = await this.#getIndex( gitHubApi );
        if ( !res.ok ) return res;
        index = res.data;

        // update index
        index[ this.#name ] ||= {};
        index[ this.#name ].etag = etag;
        index[ this.#name ].buildDate = new Date();
        index[ this.#name ].expires = expires;
        index[ this.#name ].meta = meta;

        // upload index
        res = await this.#uploadAsset(
            gitHubApi,
            new File( {
                "name": "index.json",
                "buffer": JSON.stringify( index, null, 4 ) + "\n",
            } )
        );
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async #prepareEtag ( etag ) {
        if ( etag == null ) return null;

        if ( !( etag instanceof crypto.Hash ) ) {
            if ( etag instanceof stream.Readable ) {
                return this._getStreamHash( etag );
            }

            if ( etag instanceof Date ) {
                etag = etag.toISOString();
            }

            etag = this._getHash().update( etag );
        }

        return etag.digest( HASH_ENCODING );
    }

    async #getIndex ( gitHubApi, cache = {} ) {
        const cacheId = this.#repository + this.#tag;

        if ( cache?.[ cacheId ] ) {
            return result( 200, cache[ cacheId ] );
        }

        // get release id
        var res = await gitHubApi.getReleaseByTagName( this.#repository, this.#tag );
        if ( !res.ok ) return res;

        res = await gitHubApi.downloadReleaseAssetByName( this.#repository, res.data.id, "index.json" );

        var index;

        if ( !res.ok ) {
            if ( res.status === 404 ) {
                index = {};
            }
            else {
                return result( res );
            }
        }
        else {
            index = await res.json();
        }

        if ( cache ) {
            cache[ cacheId ] = index;
        }

        return result( 200, index );
    }

    async #uploadAsset ( gitHubApi, file ) {

        // get release id
        const res = await gitHubApi.getReleaseByTagName( this.#repository, this.#tag );
        if ( !res.ok ) return res;

        return gitHubApi.updateReleaseAsset( this.#repository, res.data.id, file );
    }
}
