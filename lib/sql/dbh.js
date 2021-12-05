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
        let msg = `SQL erorr: "${e.message}" in `;

        if ( position ) {
            msg += query.substring( 0, position ) + ansi.bold.white.onRed( "<-- ERROR IS HERE ->" ) + query.substring( position );
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

            // create new connection
            if ( this.#activeConnections < this.maxConnections ) {
                this.#activeConnections++;

                dbh = this._newDbh();

                dbh.on( "destroy", this.#onDbhDestroy.bind( this ) );

                dbh.on( "release", this.#onDbhRelease.bind( this ) );
            }

            // has free connections in the pool
            else if ( this.#connections.length && ( !lock || this.#connections.length > 1 ) ) {
                dbh = this.#connections.shift();
            }

            // wait for connection
            else {
                await this.#signal.wait();

                continue;
            }

            if ( !lock ) this.#connections.push( dbh );

            return dbh;
        }
    }

    // private
    #onDbhRelease ( dbh ) {
        if ( dbh.isDestroyed ) {
            this.#activeConnections--;

            this.#signal.try();
        }
        else if ( dbh.inTransaction ) {
            dbh.destroy();
        }
        else {
            this.#connections.push( dbh );

            this.#signal.try();
        }
    }

    #onDbhDestroy ( dbh ) {
        this.#activeConnections--;

        // try to remove from pool
        for ( let n = 0; n < this.#connections.length; n++ ) {
            if ( this.#connections[n] === dbh ) {
                this.#connections.splice( n, 1 );

                break;
            }
        }

        this.#signal.try();
    }
}
