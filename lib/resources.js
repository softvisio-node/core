import "#lib/result";
import Events from "#lib/events";
import Resource from "./resources/resource.js";
import fs from "fs";
import Mutex from "#lib/threads/mutex";
import ansi from "#lib/text/ansi";
import fetch from "#lib/fetch";
import env from "#lib/env";
import GitHub from "#lib/api/github";
import { TmpDir } from "#lib/tmp";
import File from "#lib/file";
import tar from "#lib/tar";
import url from "url";
import crypto from "crypto";

env.loadUserEnv();

const DEFAULT_UPDATE_INTERVAL = 1000 * 60 * 60 * 4; // 4 hours

export default class Resources extends Events {
    #location;
    #repository;
    #tag;
    #updateInterval;
    #resources = {};
    #updateTimeout;
    #mutex = new Mutex();
    #maxLength = 22;
    #githubToken;

    constructor ( options ) {
        super();

        if ( options.location instanceof URL || options.location.startsWith( "file:" ) ) {
            this.#location = url.fileURLToPath( options.location );
        }
        else {
            this.#location = options.location;
        }

        this.#repository = options.repository;
        this.#tag = options.tag;
        this.#updateInterval = options.updateInterval || DEFAULT_UPDATE_INTERVAL;
        this.#githubToken = options.githubToken || process.env.GITHUB_TOKEN;

        // add resources
        for ( const ResourceClass of options.resources ) {
            const resource = new ResourceClass( this );

            this.#resources[resource.id] = resource;

            if ( resource.id.length + 12 > this.#maxLength ) this.#maxLength = resource.id.length + 12;
        }

        if ( !fs.existsSync( this.#location ) ) fs.mkdirSync( this.#location, { "recursive": true } );
    }

    // static
    static get Resource () {
        return Resource;
    }

    // properties
    get location () {
        return this.#location;
    }

    get repository () {
        return this.#repository;
    }

    get tag () {
        return this.#tag;
    }

    get isAvailable () {
        for ( const resource of Object.values( this.#resources ) ) {
            if ( !resource.isAvailable ) return false;
        }

        return true;
    }

    // public
    get ( id ) {
        return this.#resources[id];
    }

    async update ( { build } = {} ) {
        if ( !this.#mutex.tryLock() ) return this.#mutex.wait();

        var res = result( 200 ),
            gitHub,
            uploadIndex,
            remoteIndex = this.#repository ? await this.#getRemoteIndex() : null,
            localIndex = this.#getLocalIndex();

        for ( const resource of Object.values( this.#resources ) ) {
            let updated;

            // update from sources
            if ( !this.#repository ) {
                process.stdout.write( `Updating "${resource.id}" `.padEnd( this.#maxLength, " " ) );

                localIndex[resource.id] ||= {};
                localIndex[resource.id].checked = new Date();

                // get etag
                updated = await resource.getEtag();

                const etag = this.#prepareEtag( updated.data );

                // not modified
                if ( updated.ok && localIndex[resource.id]?.etag === etag && resource.isAvailable ) {
                    updated = result( 304 );
                }

                // modified
                if ( updated.ok ) {
                    const tmp = new TmpDir();

                    updated = await resource.build( tmp.path );

                    // update local index
                    if ( updated.ok ) {

                        // copy files
                        fs.cpSync( tmp.path, this.#location, { "recursive": true, "force": true } );

                        localIndex[resource.id].updated = new Date();
                        localIndex[resource.id].etag = etag;
                    }
                }

                // write local index
                this.#writeLocalIndex( localIndex );
            }

            // build
            else if ( build ) {
                process.stdout.write( `Building "${resource.id}" `.padEnd( this.#maxLength, " " ) );

                remoteIndex ??= {};

                if ( !this.#githubToken ) {
                    res = result( [500, `GitHub token not found`] );
                }
                else {
                    gitHub ??= new GitHub( this.#githubToken );

                    // get etag
                    updated = await resource.getEtag();

                    const etag = this.#prepareEtag( updated.data );

                    // not modified
                    if ( updated.ok && remoteIndex[resource.id]?.etag === etag ) {
                        updated = result( 304 );
                    }

                    // modified
                    if ( updated.ok ) {
                        remoteIndex[resource.id] ||= {};
                        remoteIndex[resource.id].etag = etag;
                        remoteIndex[resource.id].built = new Date();

                        const tmp = new TmpDir();

                        updated = await resource.build( tmp.path );

                        if ( updated.ok ) {
                            const assetPath = tmp.path + "/" + resource.id + ".tar.gz";

                            tar.create( {
                                "cwd": tmp.path,
                                "gzip": true,
                                "portable": true,
                                "sync": true,
                                "file": assetPath,
                            } );

                            // upload tar.gz
                            updated = await this.#uploadAsset( gitHub, new File( { "path": assetPath } ) );

                            if ( !updated.ok ) {
                                uploadIndex = false;
                            }
                            else if ( uploadIndex !== false ) {
                                uploadIndex = true;
                            }
                        }
                    }
                }
            }

            // update from repository
            else {
                process.stdout.write( `Updating "${resource.id}" `.padEnd( this.#maxLength, " " ) );

                localIndex[resource.id] ||= {};
                localIndex[resource.id].checked = new Date();

                // problems download remote index
                if ( !remoteIndex ) {
                    updated = result( [500, `Remote index not found`] );
                }

                // exists and not modified
                else if ( localIndex[resource.id]?.etag === remoteIndex[resource.id]?.etag && resource.isAvailable ) {
                    updated = result( 304 );
                }
                else {
                    updated = await resource.update();

                    // update local index
                    if ( updated.ok ) {
                        localIndex[resource.id].updated = new Date();
                        localIndex[resource.id].built = remoteIndex[resource.id].built;
                        localIndex[resource.id].etag = remoteIndex[resource.id].etag;
                    }
                }

                // write local index
                this.#writeLocalIndex( localIndex );
            }

            // not modified
            if ( updated.status === 304 ) {
                console.log( updated.statusText );
            }

            // source not found
            else if ( updated.status === 404 ) {
                console.log( ansi.warn( " " + updated.statusText + " " ) );
            }
            else {

                // updated
                if ( updated.ok ) {
                    console.log( ansi.ok( " " + updated.statusText + " " ) );

                    this.emit( "update", resource );
                }

                // error
                else {
                    console.log( ansi.error( " " + updated.statusText + " " ) );

                    res = updated;
                }
            }
        }

        // upload index
        if ( uploadIndex ) {
            process.stdout.write( `Uploading "index.json" `.padEnd( this.#maxLength, " " ) );

            res = await this.#uploadAsset( gitHub, new File( { "name": "index.json", "buffer": JSON.stringify( remoteIndex, null, 4 ) } ) );

            console.log( res.statusText );
        }

        this.#mutex.unlock( res );

        return res;
    }

    startUpdate () {
        const timeout = this.#updateInterval;

        if ( this.#updateTimeout ) clearTimeout( this.#updateTimeout );

        this.#updateTimeout = setTimeout( async () => {
            await this.update();

            this.startUpdate();
        }, timeout ).unref();
    }

    // private
    async #getRemoteIndex () {

        // download index
        const res = await fetch( `https://github.com/${this.#repository}/releases/download/${this.#tag}/index.json` );

        if ( res.status === 404 ) return;

        if ( !res.ok ) throw res;

        return res.json();
    }

    #getLocalIndex () {
        const location = this.#location + "/index.json";

        if ( !fs.existsSync( location ) ) return { "updated": null };

        return JSON.parse( fs.readFileSync( location ) );
    }

    #writeLocalIndex ( index ) {
        const location = this.#location + "/index.json";

        index.updated = new Date();

        fs.writeFileSync( location, JSON.stringify( index, null, 4 ) );
    }

    async #uploadAsset ( gitHub, file ) {

        // get release id
        var res = await gitHub.getReleaseByTagName( this.#repository, this.#tag );
        if ( !res.ok ) return res;

        return gitHub.updateReleaseAsset( this.#repository, res.data.id, file );
    }

    #prepareEtag ( etag ) {
        if ( etag instanceof Date ) return etag.toISOString();
        else if ( etag instanceof crypto.Hash ) return etag.digest( "hex" );
        else return etag;
    }
}
