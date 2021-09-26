import "#lib/result";
import { SQL } from "./query.js";
import Events from "events";
import Signal from "#lib/threads/signal";

export class DBH extends Events {

    // public
    queryToString ( query, params ) {

        // query object
        if ( query instanceof SQL ) {

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
            msg += query.substring( 0, position ) + " HERE ---> " + query.substring( position );
        }
        else {
            msg += query;
        }

        if ( e.stack ) msg += "\n" + e.stack;

        console.error( msg );

        return result.exception( [500, e.message] );
    }
}

export class DBHPool extends DBH {
    #activeConnections = 0;
    #connections = [];
    #signal = new Signal();

    // protected
    // NOTE to avoid dead locks in the transactions number of maxConnections must be > 2
    async _getDBH ( lock ) {
        while ( 1 ) {
            let dbh;

            // create new connection
            if ( this.#activeConnections < this.maxConnections ) {
                this.#activeConnections++;

                dbh = this._newDBH();

                dbh.on( "destroy", this.#onDBHDestroy.bind( this ) );

                dbh.on( "release", this.#onDBHRelease.bind( this ) );
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
    #onDBHRelease ( dbh ) {
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

    #onDBHDestroy ( dbh ) {
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
