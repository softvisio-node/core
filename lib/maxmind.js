import "#index";

import MMDB from "mmdb-lib";
import fs from "fs";
import os from "os";
import fetch from "#lib/http/fetch";
import tar from "tar";
import LruCache from "lru-cache";
import Bitbucket from "#lib/api/bitbucket";
import env from "#lib/env";

const CACHE_SIZE = 10000;

const READERS = {};
const WATCHERS = {};

const CONST = {
    "repo": "softvisio/databases",
    "path": os.platform() === "win32" ? process.env.LOCALAPPDATA + "/databases/maxmind" : "/var/lib/databases/maxmind",
    "updateInterval": 1000 * 60 * 60 * 24,
    "index": {
        "asn": { "name": "GeoLite2-ASN" },
        "city": { "name": "GeoLite2-City" },
        "country": { "name": "GeoLite2-Country" },
    },
};

CONST.indexPath = CONST.path + "/index.json";
CONST.lastUpdatedPath = CONST.path + "/last-updated";

if ( !fs.existsSync( CONST.path ) ) fs.mkdirSync( CONST.path, { "recursive": true } );

class Maxmind {
    destroy () {
        for ( const id in WATCHERS ) {
            WATCHERS[id].close();

            delete WATCHERS[id];
        }

        for ( const id in READERS ) {
            delete READERS[id];
        }
    }

    get asn () {
        if ( !READERS.asn ) this.#initReader( "asn", `${CONST.path}/${CONST.index.asn.name}.mmdb` );

        return READERS.asn;
    }

    get city () {
        if ( !READERS.city ) this.#initReader( "city", `${CONST.path}/${CONST.index.city.name}.mmdb` );

        return READERS.city;
    }

    get country () {
        if ( !READERS.country ) this.#initReader( "country", `${CONST.path}/${CONST.index.country.name}.mmdb` );

        return READERS.country;
    }

    async update ( { force } = {} ) {
        if ( !force ) {
            const lastUpdated = this.#readLastUpdated();

            if ( lastUpdated && new Date() - lastUpdated < CONST.updateInterval ) return;
        }

        this.#writeLastUpdated();

        // read config
        const cfg = await env.getUserConfig();

        const MAXMIND_LICENSE_KEY = process.env.MAXMIND_LICENSE_KEY || cfg.MAXMIND_LICENSE_KEY;

        // update from maxmind
        if ( MAXMIND_LICENSE_KEY ) {
            let res = await this.#updateFromMaxmind( MAXMIND_LICENSE_KEY );

            if ( !res.ok ) return false;

            // sync local index with repository
            if ( cfg.BITBUCKET.username && cfg.BITBUCKET.password ) {
                res = await this.#syncRepository( cfg.BITBUCKET.username, cfg.BITBUCKET.password );

                if ( !res.ok ) return false;
            }

            return true;
        }

        // update from repository
        else {
            return await this.#updateFromRepository();
        }
    }

    #initReader ( id, path ) {

        // init watcher
        WATCHERS[id] = fs.watch( path, { "persistent": false } );

        let change;

        WATCHERS[id].on( "change", () => {
            if ( !fs.existsSync( path ) ) return;

            if ( change ) return;

            change = true;

            setTimeout( () => {
                READERS[id] = this.#getReader( path );

                change = false;
            }, 1000 );
        } );

        READERS[id] = this.#getReader( path );
    }

    #getReader ( path ) {
        const cache = new LruCache( {
            "max": CACHE_SIZE,
        } );

        const reader = new MMDB.default( fs.readFileSync( path ), { cache } );

        return reader;
    }

    async #updateFromMaxmind ( MAXMIND_LICENSE_KEY ) {
        const idx = this.#readIndex();

        for ( const id in idx ) {
            const name = idx[id].name;
            const file = name + ".mmdb";
            const path = `${CONST.path}/${file}`;
            const tmp = path + ".tar.gz";
            let lastModified;

            // download file
            try {
                process.stdout.write( `Checking: ${name} ... ` );

                let res = await fetch( `https://download.maxmind.com/app/geoip_download?edition_id=${name}&license_key=${MAXMIND_LICENSE_KEY}&suffix=tar.gz`, { "method": "head" } );

                if ( !res.ok ) throw res + "";

                lastModified = res.headers.get( "last-modified" );

                // content not modified
                if ( fs.existsSync( path ) && lastModified === idx[id].lastModified ) {
                    console.log( "Not Modified" );

                    continue;
                }

                process.stdout.write( `downloading ... ` );

                res = await fetch( `https://download.maxmind.com/app/geoip_download?edition_id=${name}&license_key=${MAXMIND_LICENSE_KEY}&suffix=tar.gz`, { "timeout": 30000 } );

                if ( !res.ok ) throw res + "";

                const dest = fs.createWriteStream( tmp );

                res.body.pipe( dest );

                const done = await new Promise( resolve => {
                    res.body.on( "error", () => {
                        res.body.destroy();

                        fs.rmSync( tmp, { "force": true } );

                        resolve( result( 500 ) );
                    } );

                    res.body.on( "end", () => {
                        if ( fs.existsSync( tmp ) ) {
                            process.stdout.write( `extracting ... ` );

                            if ( !this.#unpack( tmp, file, 1 ) ) resolve( result( 500 ) );

                            resolve( result( 200 ) );
                        }
                    } );
                } );

                if ( done.ok ) {
                    idx[id].lastModified = lastModified;

                    this.#writeIndex( idx );
                }

                console.log( done + "" );
            }
            catch ( e ) {
                return result( [500, e.message] );
            }
        }

        return result( 200 );
    }

    async #syncRepository ( username, password ) {
        const bitbucket = new Bitbucket( { username, password } );

        var updated;

        const remoteIndex = ( await this.#downloadIndex() ) || {},
            localIndex = this.#readIndex();

        for ( const id in localIndex ) {
            const name = localIndex[id].name;
            const file = name + ".mmdb";
            const path = `${CONST.path}/${file}`;
            const tmp = path + ".tar.gz";

            process.stdout.write( `Uploading: ${file} ... ` );

            if ( !remoteIndex[id] ) {
                remoteIndex[id] = {
                    "name": localIndex[id].name,
                };
            }

            if ( localIndex[id].lastModified !== remoteIndex[id].lastModified ) {
                tar.c( {
                    "cwd": CONST.path,
                    "gzip": true,
                    "sync": true,
                    "portable": true,
                    "file": tmp,
                },
                [file] );

                const res = await bitbucket.upload( CONST.repo, file + ".tar.gz", tmp );

                console.log( res + "" );

                fs.rmSync( tmp, { "force": true } );

                if ( !res.ok ) throw res;

                updated = true;
            }
            else {
                console.log( "Not Modified" );
            }
        }

        // upload index
        if ( updated ) {
            process.stdout.write( `Uploading: index.json ... ` );

            const res = await bitbucket.upload( CONST.repo, "index.json", CONST.indexPath );

            console.log( res + "" );

            // upload error
            if ( !res.ok ) throw res;
        }

        return result( 200 );
    }

    async #updateFromRepository () {
        const remoteIndex = await this.#downloadIndex(),
            localIndex = this.#readIndex();

        // unable to download remote index
        if ( !remoteIndex ) return false;

        for ( const id in remoteIndex ) {
            const name = remoteIndex[id].name;
            const file = name + ".mmdb";
            const path = `${CONST.path}/${file}`;
            const tmp = path + ".tar.gz";

            if ( !fs.existsSync( path ) || !localIndex[id] || localIndex[id].lastModified !== remoteIndex[id].lastModified ) {
                while ( 1 ) {
                    console.log( `Downloading: ${file}` );

                    try {
                        const res = await fetch( `https://bitbucket.org/${CONST.repo}/downloads/${file}.tar.gz`, { "timeout": 30000 } );

                        // download error, redo
                        if ( !res.ok ) continue;

                        const dest = fs.createWriteStream( tmp );

                        res.body.pipe( dest );

                        await new Promise( resolve => {
                            res.body.on( "error", () => {
                                res.body.destroy();

                                fs.rmSync( tmp, { "force": true } );

                                resolve();
                            } );

                            res.body.on( "end", () => resolve() );
                        } );

                        // download error, redo
                        if ( !fs.existsSync( tmp ) ) continue;

                        if ( !this.#unpack( tmp, file ) ) continue;

                        localIndex[id] = remoteIndex[id];

                        this.#writeIndex( localIndex );

                        break;
                    }
                    catch ( e ) {

                        // download error, redo
                        continue;
                    }
                }
            }
        }

        console.log( `Maxmind update finished` );

        return true;
    }

    #unpack ( tmp, file, strip ) {
        fs.mkdirSync( CONST.path + "/tmp", { "recursive": true } );

        try {
            tar.extract( {
                "cwd": CONST.path + "/tmp",
                "file": tmp,
                "sync": true,
                strip,
                "filter": ( path, entry ) => path.includes( ".mmdb" ),
            } );

            fs.rmSync( tmp, { "force": true } );
            fs.renameSync( CONST.path + "/tmp/" + file, CONST.path + "/" + file );
            fs.rmSync( CONST.path + "/tmp", { "recursive": true, "force": true } );

            return true;
        }
        catch ( e ) {
            return false;
        }
    }

    #readLastUpdated () {
        if ( fs.existsSync( CONST.lastUpdatedPath ) ) {
            try {
                return new Date( fs.readFileSync( CONST.lastUpdatedPath ) );
            }
            catch ( e ) {}
        }
    }

    #writeLastUpdated () {
        fs.writeFileSync( CONST.lastUpdatedPath, new Date().toISOString() );
    }

    #readIndex () {
        if ( fs.existsSync( CONST.indexPath ) ) return JSON.parse( fs.readFileSync( CONST.indexPath ) );
        else return JSON.parse( JSON.stringify( CONST.index ) );
    }

    #writeIndex ( index ) {
        fs.writeFileSync( CONST.indexPath, JSON.stringify( index, null, 4 ) );
    }

    async #downloadIndex () {

        // download index
        try {
            const res = await fetch( `https://bitbucket.org/${CONST.repo}/downloads/index.json` );

            if ( !res.ok ) throw res + "";

            return await res.json();
        }
        catch ( e ) {}
    }
}

export default new Maxmind();
