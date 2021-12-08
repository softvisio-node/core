import "#lib/result";
import { Sql } from "./query.js";
import Events from "events";
import Signal from "#lib/threads/signal";
import ansi from "#lib/text/ansi";

export class Dbh extends Events {

    // public
    queryToString ( query, params ) {

        // query object
        if ( query instanceof Sql ) {

            // override params
            params ||= query.params;

            query = query.query;
        }

        if ( !params ) params = [];

        var length = params.length,
            idx = 0;

        // substitute params
        query = query.replace( /(?:\?|\$\d+)/g, () => {
            if ( idx >= length ) throw Error( `SQL number of passed params is less, than number of placeholders in the query` );

            return this.quote( params[idx++] );
        } );

        if ( idx < length ) throw Error( `SQL number of passed params is greater, than number of placeholders in the query` );

        return query;
    }

    // protected
    _onQueryError ( e, query, position ) {
        let msg = `SQL erorr: "${e.message}" in:\n`;

        if ( position ) {
            msg += query.substring( 0, position - 1 ) + ansi.bold.white.onRed( " ERROR IS HERE -> " ) + query.substring( position - 1 );
        }
        else {
            msg += query;
        }

        if ( e.stack ) msg += "\n" + e.stack;

        console.error( msg );

        return result.exception( [500, e.message] );
    }
}

export class DbhPool extends Dbh {
    #activeConnections = 0;
    #connections = [];
    #signal = new Signal();

    // protected
    // NOTE to avoid dead locks in the transactions number of maxConnections must be > 2
    async _getDbh ( lock ) {
        while ( 1 ) {
            let dbh;

            // has free connection in the pool
            if ( this.#connections.length && ( !lock || this.#connections.length > 1 ) ) {
                dbh = this.#connections.shift();
            }

            // create new connection
            else if ( this.#activeConnections < this.maxConnections ) {
                this.#activeConnections++;

                dbh = this._newDbh( { "master": true } );

                dbh.on( "destroy", this.#onDbhDestroy.bind( this ) );
                dbh.on( "release", this.#onDbhRelease.bind( this ) );
                dbh.on( "idle", this.#onDbhIdle.bind( this ) );
            }

            // wait for connection
            else {
                await this.#signal.wait();

                continue;
            }

            if ( !lock ) this.#connections.unshift( dbh );

            return dbh;
        }
    }

    // private
    #onDbhRelease ( dbh ) {

        // connection is destroyed
        if ( dbh.isDestroyed ) {
            this.#activeConnections--;

            this.#signal.try();
        }

        // connetion is in the transaction, destroy
        else if ( dbh.inTransaction ) {
            dbh.destroy();
        }

        // put connection to the pool
        else {
            this.#connections.unshift( dbh );

            this.#signal.try();
        }
    }

    #onDbhDestroy ( dbh ) {
        this.#activeConnections--;

        // remove connection from pool
        for ( let n = 0; n < this.#connections.length; n++ ) {
            if ( this.#connections[n] === dbh ) {
                this.#connections.splice( n, 1 );

                break;
            }
        }

        this.#signal.try();
    }

    #onDbhIdle ( dbh ) {}
}
