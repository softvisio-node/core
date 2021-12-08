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
    #idleTimeouts = new Map();

    #master = {
        "total": 0,
        "idle": new Set(),
        "busy": new Set(),
        "signal": new Signal(),
    };

    #slave = {
        "total": 0,
        "idle": new Set(),
        "busy": new Set(),
        "signal": new Signal(),
    };

    // protected
    // NOTE to avoid dead locks in the transactions number of the maxConnections must be > 2
    async _getDbh ( lock, slave ) {

        // const connections = slave ? this.#slave : this.#master;
        const connections = this.#master;

        while ( 1 ) {
            let dbh;

            const lastConnection = lock && connections.total === this.maxConnections;

            // try to get idle connection, do not lock last connection
            if ( connections.idle.size && !lastConnection ) {
                dbh = connections.idle.values().next().value;

                this.#deleteIdleTimeout( dbh );
                connections.idle.delete( dbh );

                if ( !lock ) connections.busy.add( dbh );
            }

            // create new connection
            else if ( connections.total < this.maxConnections ) {
                connections.total++;

                dbh = this._newDbh( { "master": true } );

                dbh.on( "destroy", this.#onDbhDestroy.bind( this ) );
                dbh.on( "idle", this.#onDbhIdle.bind( this ) );

                connections.busy.add( dbh );
            }

            // try to get busy connection, do not lock last connection
            else if ( !lock && connections.busy.size ) {
                dbh = connections.busy.values().next().value;

                // rotate
                connections.busy.delete( dbh );
                connections.busy.add( dbh );
            }

            // wait for connection
            else {
                await connections.signal.wait();

                continue;
            }

            return dbh;
        }
    }

    // private
    #onDbhDestroy ( dbh ) {
        const connections = dbh.isMaster ? this.#master : this.#slave;

        connections.total--;

        this.#deleteIdleTimeout( dbh );
        connections.idle.delete( dbh );
        connections.busy.delete( dbh );

        connections.signal.try();
    }

    #onDbhIdle ( dbh ) {

        // connetion is in the transaction, destroy
        if ( dbh.inTransaction ) {
            dbh.destroy();
        }

        // idle
        else {
            const connections = dbh.isMaster ? this.#master : this.#slave;

            this.#deleteIdleTimeout( dbh );

            // set idle timeout
            if ( !dbh.isPersistent && this.idleTimeout ) {
                this.#idleTimeouts.set( dbh,
                    setTimeout( () => dbh.disconnect( result( [500, `Database connection closed on timeout`] ) ) ),
                    this.idleTimeout );
            }

            connections.idle.add( dbh );
            connections.busy.delete( dbh );

            connections.signal.try();
        }
    }

    #deleteIdleTimeout ( dbh ) {
        clearTimeout( this.#idleTimeouts.get( dbh ) );

        this.#idleTimeouts.delete( dbh );
    }
}
