import Signal from "#lib/threads/signal";

export default Super =>
    class extends ( Super || Object ) {
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
                        setTimeout( () => dbh.destroy( result( [500, `Database connection closed on timeout`] ) ) ),
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
    };
