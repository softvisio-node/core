import "#lib/result";
import GitHub from "#lib/api/github";
import env from "#lib/env";
import { TmpDir } from "#lib/tmp";
import File from "#lib/file";
import tar from "#lib/tar";
import crypto from "crypto";
import fs from "node:fs";
import ansi from "#lib/text/ansi";
import externalResoources from "#lib/external-resources";
import stream from "#lib/stream";

env.loadUserEnv();

const HASH_ALGORITHM = "SHA256",
    HASH_ENCODING = "base64url";

export default class ExternalRecourceBuilder {
    #id;
    #repository;
    #tag;
    #name;
    #githubToken;

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

        for ( const resource of resources ) {
            process.stdout.write( `Building resource "${ resource.name }" ... `.padEnd( pad + 25 ) );

            const res = await resource.build( { force } );

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

    // public
    async build ( { force } = {} ) {
        return this.#build( { force } );
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

    async _getMeta () {
        return null;
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
            "timeout": 30000,
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
    async #build ( { force } = {} ) {
        if ( !this.#githubToken ) {
            return result( [ 500, `GitHub token not found` ] );
        }

        const gitHubApi = new GitHub( this.#githubToken );

        var res;

        // get remove index
        res = await this.#getIndex( gitHubApi );
        if ( !res.ok ) return res;
        var index = res.data;

        // get etag
        res = await this._getEtag( {
            "etag": index[ this.#name ]?.etag,
            "buildDate": index[ this.#name ]?.buildDate,
            "meta": index[ this.#name ]?.meta,
        } );
        if ( !res.ok ) return res;

        const etag = await this.#prepareEtag( res.data );

        // not modified
        if ( !force && etag === index[ this.#name ]?.etag ) return result( 304 );

        const tmp = new TmpDir();

        res = await this._build( tmp.path );
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
        res = await this.#uploadAsset( gitHubApi, new File( { "path": assetPath } ) );
        if ( !res.ok ) return res;

        // get latest remote index
        res = await this.#getIndex( gitHubApi );
        if ( !res.ok ) return res;
        index = res.data;

        // update index
        index[ this.#name ] ||= {};
        index[ this.#name ].etag = etag;
        index[ this.#name ].buildDate = new Date();
        index[ this.#name ].meta = await this._getMeta();
        if ( !index[ this.#name ].meta ) delete index[ this.#name ].meta;

        // upload index
        res = await this.#uploadAsset( gitHubApi, new File( { "name": "index.json", "buffer": JSON.stringify( index, null, 4 ) + "\n" } ) );
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async #prepareEtag ( etag ) {
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

    async #getIndex ( gitHubApi ) {

        // get release id
        var res = await gitHubApi.getReleaseByTagName( this.#repository, this.#tag );
        if ( !res.ok ) return res;

        res = await gitHubApi.downloadReleaseAssetByName( this.#repository, res.data.id, "index.json" );

        if ( res.status === 404 ) return result( 200, {} );

        if ( !res.ok ) return result( res );

        const index = await res.json();

        return result( 200, index );
    }

    async #uploadAsset ( gitHubApi, file ) {

        // get release id
        const res = await gitHubApi.getReleaseByTagName( this.#repository, this.#tag );
        if ( !res.ok ) return res;

        return gitHubApi.updateReleaseAsset( this.#repository, res.data.id, file );
    }
}
