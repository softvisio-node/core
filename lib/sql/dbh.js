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
    #masterConnections = 0;
    #slaveConnections = 0;

    #masterIdleConnections = new Set();
    #masterBusyConnections = new Set();
    #masterSignal = new Signal();

    #slaveIdleConnections = new Set();
    #slaveBusyConnections = new Set();
    #slaveSignal = new Signal();

    #activeConnections = 0;
    #connections = [];
    #signal = new Signal();

    // protected
    // NOTE to avoid dead locks in the transactions number of the maxConnections must be > 2
    async _getDbh ( lock ) {
        while ( 1 ) {
            let dbh;

            const lastConnection = lock && this.#masterConnections === this.maxConnections;

            // try to get idle connection, do not lock last connection
            if ( this.#masterIdleConnections.size && !lastConnection ) {
                dbh = this.#masterIdleConnections.values().next();

                if ( lock ) this.#masterIdleConnections.delete( dbh );
            }

            // create new connection
            else if ( this.#masterConnections < this.maxConnections ) {
                this.#masterConnections++;

                dbh = this._newDbh( { "master": true } );

                dbh.on( "destroy", this.#onDbhDestroy.bind( this ) );
                dbh.on( "idle", this.#onDbhIdle.bind( this ) );

                if ( !lock ) this.#masterIdleConnections.add( dbh );
            }

            // try to get busy connection, do not lock last connection
            else if ( this.#masterBusyConnections.size && !lastConnection ) {
                dbh = this.#masterBusyConnections.values().next();

                if ( lock ) this.#masterBusyConnections.delete( dbh );
            }

            // wait for connection
            else {
                await this.#masterSignal.wait();

                continue;
            }

            return dbh;
        }
    }

    // private
    #onDbhDestroy ( dbh ) {

        // master
        if ( dbh.isMaster ) {
            this.#masterConnections--;

            this.#masterIdleConnections.delete( dbh );
            this.#masterBusyConnections.delete( dbh );

            this.#masterSignal.try( 1 );
        }

        // slave
        else {
            this.#slaveConnections--;

            this.#slaveIdleConnections.delete( dbh );
            this.#slaveBusyConnections.delete( dbh );

            this.#slaveSignal.try();
        }
    }

    #onDbhIdle ( dbh ) {

        // connetion is in the transaction, destroy
        if ( dbh.inTransaction ) {
            dbh.destroy();

            return;
        }

        // idle
        if ( dbh.isIdle ) {

            // master
            if ( dbh.isMaster ) {
                if ( !dbh.isLocked ) this.#masterIdleConnections.add( dbh );
                this.#masterBusyConnections.delete( dbh );
            }

            // slave
            else {
                if ( !dbh.isLocked ) this.#slaveIdleConnections.add( dbh );
                this.#slaveBusyConnections.delete( dbh );
            }
        }

        // busy
        else {

            // master
            if ( dbh.isMaster ) {
                this.#masterIdleConnections.delete( dbh );
                if ( !dbh.isLocked ) this.#masterBusyConnections.add( dbh );
            }

            // slave
            else {
                this.#slaveIdleConnections.delete( dbh );
                if ( !dbh.isLocked ) this.#slaveBusyConnections.add( dbh );
            }
        }
    }
}
