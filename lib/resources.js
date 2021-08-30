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
import tar from "tar";
import url from "url";
import crypto from "crypto";
import glob from "#lib/glob";

const DEFAULT_UPDATE_INTERVAL = 1000 * 60 * 4;

const userConfig = await env.getUserConfig();
const githubToken = process.env.GITHUB_TOKEN || process.env.APP_GITHUB_TOKEN || userConfig.github?.token;

export default class Resources extends Events {
    #location;
    #repo;
    #tag;
    #updateInterval;
    #resources = {};
    #updateTimeout;
    #mutex = new Mutex();
    #maxLength = 22;

    constructor ( options ) {
        super();

        if ( options.location instanceof URL || options.location.startsWith( "file:" ) ) {
            this.#location = url.fileURLToPath( options.location );
        }
        else {
            this.#location = options.location;
        }

        this.#repo = options.repo;
        this.#tag = options.tag;
        this.#updateInterval = options.updateInterval || DEFAULT_UPDATE_INTERVAL;

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

    get repo () {
        return this.#repo;
    }

    get tag () {
        return this.#tag;
    }

    // public
    get ( id ) {
        return this.#resources[id];
    }

    async update ( options = {} ) {
        if ( !this.#mutex.tryDown() ) return this.#mutex.signal.wait();

        var res = result( 200 ),
            gitHub,
            uploadIndex;

        const remoteIndex = this.#repo ? await this.#getRemoteIndex() : null,
            localIndex = this.#getLocalIndex();

        for ( const resource of Object.values( this.#resources ) ) {
            let updated;

            // update from sources
            if ( !this.#repo ) {
                process.stdout.write( `Updating "${resource.id}" `.padEnd( this.#maxLength, " " ) );

                localIndex[resource.id] ||= {};
                localIndex[resource.id].checked = new Date();

                // get etag
                updated = await resource.getETag();

                const etag = this.#prepareETag( updated.data );

                // not modified
                if ( updated.ok && localIndex[resource.id]?.etag === etag && resource.isConsistent() ) {
                    updated = result( 304 );
                }

                // modified
                if ( updated.ok ) {
                    const tmp = new TmpDir();

                    updated = await resource.build( tmp );

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
            else if ( options.build ) {
                process.stdout.write( `Building "${resource.id}" `.padEnd( this.#maxLength, " " ) );

                if ( !githubToken ) {
                    res = result( [500, `GitHub token not found`] );
                }
                else {
                    gitHub ??= new GitHub( githubToken );

                    // get etag
                    updated = await resource.getETag();

                    const etag = this.#prepareETag( updated.data );

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

                        updated = await resource.build( tmp );

                        if ( updated.ok ) {
                            const assetPath = tmp.path + "/" + resource.id + ".tar.gz";

                            tar.create( {
                                "cwd": tmp.path,
                                "gzip": true,
                                "portable": true,
                                "sync": true,
                                "file": assetPath,
                            },
                            glob.sync( "**", { "cwd": tmp.path, "nodir": true } ) );

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

                // exists and not modified
                if ( localIndex[resource.id]?.etag === remoteIndex[resource.id]?.etag && resource.isConsistent() ) {
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

                    this.emit( "update", resource.id );
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

            res = await this.#uploadAsset( gitHub, new File( { "name": "index.json", "content": JSON.stringify( remoteIndex, null, 4 ) } ) );

            console.log( res.statusText );
        }

        this.#mutex.up();
        this.#mutex.signal.broadcast( res );

        return res;
    }

    startUpdate () {
        const timeout = this.#updateInterval;

        if ( this.#updateTimeout ) clearTimeout( this.#updateTimeout );

        this.#updateTimeout = setTimeout( async () => {
            await this.update();

            this.startUpdate();
        }, timeout );
    }

    // private
    async #getRemoteIndex () {

        // download index
        const res = await fetch( `https://github.com/${this.#repo}/releases/download/${this.#tag}/index.json` );

        if ( res.status === 404 ) return {};

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
        var res = await gitHub.getReleaseByTagName( this.#repo, this.#tag );
        if ( !res.ok ) return res;

        return gitHub.updateReleaseAsset( this.#repo, res.data.id, file );
    }

    #prepareETag ( etag ) {
        if ( etag instanceof Date ) return etag.toISOString();
        else if ( etag instanceof crypto.Hash ) return etag.digest( "hex" );
        else return etag;
    }
}
