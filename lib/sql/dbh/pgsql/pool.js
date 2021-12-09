import Signal from "#lib/threads/signal";

class Stats {
    #pool;

    constructor ( pool ) {
        this.#pool = pool;
    }

    // public
    toString () {
        const connections = this.#pool._connections;

        return `Master maxConnections: ${this.#pool.maxConnections}, total: ${connections.master.total}, idle: ${connections.master.idle.size}, busy: ${connections.master.busy.size}, locked: ${connections.master.total - connections.master.idle.size - connections.master.busy.size}
Slave maxConnectionsPerSlave: ${this.#pool.maxConnectionsPerSlave}, total: ${connections.slave.total}, idle: ${connections.slave.idle.size}, busy: ${connections.slave.busy.size}, locked: ${connections.slave.total - connections.slave.idle.size - connections.slave.busy.size}`;
    }

    toJSON () {
        const connections = this.#pool._connections;

        return {
            "master": {
                "max": this.#pool.maxConnections,
                "total": connections.master.total,
                "idle": connections.master.idle.size,
                "active": connections.master.busy.size,
                "locked": connections.master.total - connections.master.idle.size - connections.master.busy.size,
            },
            "slave": {
                "max": this.#pool.maxConnectionsPerSlave,
                "total": connections.slave.total,
                "idle": connections.slave.idle.size,
                "active": connections.slave.busy.size,
                "locked": connections.slave.total - connections.slave.idle.size - connections.slave.busy.size,
            },
        };
    }
}

export default Super =>
    class extends ( Super || Object ) {
        #stats = new Stats( this );
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

        // properties
        get stats () {
            return this.#stats;
        }

        get _connections () {
            return { "master": this.#master, "slave": this.#slave };
        }

        // protected
        // NOTE to avoid dead locks in the transactions number of the maxConnections must be > 2
        async _getDbh ( lock, slave ) {

            // const connections = slave ? this.#slave : this.#master;
            const connections = this.#master;

            while ( 1 ) {
                let dbh;

                const lastConnection = lock && this.maxConnections - connections.total <= 1;

                // try to get idle connection, do not lock last connection
                if ( connections.idle.size && !lastConnection ) {
                    dbh = connections.idle.values().next().value;

                    this.#deleteIdleTimeout( dbh );
                    connections.idle.delete( dbh );

                    if ( !lock ) connections.busy.add( dbh );
                }

                // create new connection
                else if ( connections.total < this.maxConnections && !lastConnection ) {
                    connections.total++;

                    dbh = this._newDbh( { "master": true } );

                    dbh.on( "destroy", this.#onDbhDestroy.bind( this ) );
                    dbh.on( "idle", this.#onDbhIdle.bind( this ) );

                    if ( !lock ) connections.busy.add( dbh );
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
                if ( this.idleTimeout ) {
                    this.#idleTimeouts.set( dbh,
                        setTimeout( () => dbh.destroy( result( [500, `Database connection closed on timeout`] ) ), this.idleTimeout ) );
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
