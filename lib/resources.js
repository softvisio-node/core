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

const DEFAULT_UPDATE_INTERVAL = 1000 * 60 * 4;

const userConfig = await env.getUserConfig();
const githubToken = process.env.GITHUB_TOKEN || process.env.APP_GITHUB_TOKEN || userConfig.github?.token;

// const maxmindLicenseKey = process.env.MAXMIND_LICENSE_KEY || process.env.APP_MAXMIND_LICENSE_KEY || userConfig.maxmind?.licenseKey;

export default class Resources extends Events {
    #location;
    #repo;
    #tag;
    #updateInterval;
    #resources = {};
    #updateTimeout;
    #mutex = new Mutex();

    // XXX location parser
    constructor ( options ) {
        super();

        this.#location = options.location;
        this.#repo = options.repo;
        this.#tag = options.tag;
        this.#updateInterval = options.updateInterval || DEFAULT_UPDATE_INTERVAL;

        // add resources
        for ( const resource of options.resources ) this.#resources[resource.id] = resource;
    }

    // static
    static get Resource () {
        return Resource;
    }

    // public
    async update ( options = {} ) {
        if ( !this.#mutex.tryDown() ) return this.#mutex.signal.wait();

        var res = result( 200 ),
            gitHub,
            uploadIndex;

        const remoteIndex = await this.#getRemoteIndex(),
            localIndex = this.#getLocalIndex();

        for ( const resource of Object.values( this.#resources ) ) {
            let updated;

            // build
            if ( options.build ) {
                process.stdout.write( `Building "${resource.id}" ` );

                if ( !githubToken ) {
                    res = result( [500, `GitHub token not found`] );
                }
                else {
                    gitHub ??= new GitHub( githubToken );

                    updated = await resource.getUpdated();

                    if ( updated.data instanceof Date ) updated.data = updated.data.toISOString();

                    // not modified
                    if ( updated.ok && remoteIndex[resource.id]?.updated === updated.data ) {
                        updated = result( 304 );
                    }

                    // modified
                    if ( updated.ok ) {
                        remoteIndex[resource.id] ||= {};
                        remoteIndex[resource.id].updated === updated.data;

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
                            ["."] );

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

            // update
            else {
                process.stdout.write( `Updating "${resource.id}" ` );

                // exists and not modified
                if ( resource.isExists( this.#location ) && localIndex[resource.id]?.updated === remoteIndex[resource.id]?.updated ) {
                    updated = result( 304 );
                }
                else {
                    updated = await resource.update( this.#location );

                    // update local index
                    if ( updated.ok ) {
                        localIndex[resource.id] ||= {};
                        localIndex[resource.id].updated = remoteIndex[resource.id]?.updated;

                        this.#writeLocalIndex( localIndex );
                    }
                }
            }

            // not modified
            if ( updated.status === 304 ) {
                console.log( " " + updated.statusText + " " );
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
            res = await this.#uploadAsset( gitHub, new File( { "name": "index.json", "content": JSON.stringify( remoteIndex, null, 4 ) } ) );
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
        const location = this.#location + "/index.josn";

        if ( !fs.existsSync( location ) ) return {};

        return JSON.parse( fs.readFileSync( location ) );
    }

    #writeLocalIndex ( index ) {
        const location = this.#location + "/index.josn";

        index.lastUpdated = new Date();

        fs.writeFileSync( location, JSON.stringify( index, null, 4 ) );
    }

    async #uploadAsset ( gitHub, file ) {

        // get release id
        var res = await gitHub.getReleaseByTagName( this.#repo, this.#tag );
        if ( !res.ok ) return res;

        return gitHub.updateReleaseAsset( this.#repo, res.data.id, file );
    }
}
