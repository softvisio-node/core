import "#lib/result";
import Events from "#lib/events";
import Resource from "./resources/resource.js";
import fs from "fs";
import Mutex from "#lib/threads/mutex";
import ansi from "#lib/text/ansi";

export default class Resources extends Events {
    #repo;
    #tag;
    #updateInterval;
    #resources = new Set();
    #updateStarted;
    #mutex = new Mutex();

    constructor ( options ) {
        super();

        this.#repo = options.repo;
        this.#tag = options.tag;
        this.#updateInterval = options.updateInterval || 1000 * 60 * 4;

        options.resources.forEach( resource => this.#resources.add( resource ) );
    }

    // static
    static get Resource () {
        return Resource;
    }

    // public
    async update () {
        if ( !this.#mutex.tryDown() ) return this.#mutex.signal.wait();

        var res = result( 200 );

        const remoteIndex = await this.#getRemoteIndex(),
            localIndex = this.#getLocalIndex();

        for ( const resource of this.#resources ) {
            process.stdout.write( `Updating "${resource.id}" ` );

            let updated;

            if ( resource.isExists( this.location ) && remoteIndex[resource.id]?.updated === localIndex[resource.id]?.updated ) updated = result( 304 );
            else updated = await resource.update();

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

        this.#mutex.up();
        this.#mutex.signal.broadcast( res );

        return res;
    }

    async build () {}

    startUpdate () {
        if ( this.#updateStarted ) return;

        this.#updateStarted = true;

        setTimeout( async () => {
            await this.update();

            this.#updateStarted = false;

            this.startUpdate();
        }, this.#updateInterval );
    }

    // private
    // XXX
    async #getRemoteIndex () {
        return {};
    }

    // XXX
    #getLocalIndex () {
        return {};
    }

    // XXX
    #writeLocalIndex ( index ) {
        index.lastUpdated = new Date();

        fs.writeFileSync( "index.json", JSON.stringify( index, null, 4 ) );
    }
}
