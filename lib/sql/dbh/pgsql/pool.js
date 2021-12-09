import Signal from "#lib/threads/signal";

class Stats {
    #pool;

    constructor ( pool ) {
        this.#pool = pool;
    }

    // public
    toString () {
        const connections = this.#pool._connections;

        return `Master maxConnections: ${this.#pool.maxConnections}, total: ${connections.master.total}, idle: ${connections.master.idle.size}, active: ${connections.master.active.size}, locked: ${connections.master.total - connections.master.idle.size - connections.master.active.size}
Slave maxConnectionsPerSlave: ${this.#pool.maxConnectionsPerSlave}, total: ${connections.slave.total}, idle: ${connections.slave.idle.size}, active: ${connections.slave.active.size}, locked: ${connections.slave.total - connections.slave.idle.size - connections.slave.active.size}`;
    }

    toJSON () {
        const connections = this.#pool._connections;

        return {
            "master": {
                "max": this.#pool.maxConnections,
                "total": connections.master.total,
                "idle": connections.master.idle.size,
                "active": connections.master.active.size,
                "locked": connections.master.total - connections.master.idle.size - connections.master.active.size,
            },
            "slave": {
                "max": this.#pool.maxConnectionsPerSlave,
                "total": connections.slave.total,
                "idle": connections.slave.idle.size,
                "active": connections.slave.active.size,
                "locked": connections.slave.total - connections.slave.idle.size - connections.slave.active.size,
            },
        };
    }
}

class Slave {
    #pool;

    constructor ( pool ) {
        this.#pool = pool;
    }

    // public
    async select ( query, params ) {
        return ( await this.#pool._getDbh( false, true ) ).select( query, params );
    }

    async selectRow ( query, params ) {
        return ( await this.#pool._getDbh( false, true ) ).selectRow( query, params );
    }
}

export default Super =>
    class extends ( Super || Object ) {
        #stats = new Stats( this );
        #slave = new Slave( this );
        #idleTimeouts = new Map();

        #masterConnections = {
            "total": 0,
            "idle": new Set(),
            "active": new Set(),
            "signal": new Signal(),
        };

        #slaveConnections = {
            "total": 0,
            "idle": new Set(),
            "active": new Set(),
            "signal": new Signal(),
            "hosts": {},
        };

        // properties
        get stats () {
            return this.#stats;
        }

        get slave () {
            return this.#slave;
        }

        get _connections () {
            return { "master": this.#masterConnections, "slave": this.#slaveConnections };
        }

        // protected
        // NOTE to avoid dead locks in the transactions number of the maxConnections must be > 2
        async _getDbh ( lock, slave ) {
            if ( slave && !this.slaveHostname ) slave = false;

            const connections = slave ? this.#slaveConnections : this.#masterConnections;

            while ( 1 ) {
                let dbh;

                const lastConnection = lock && this.maxConnections - connections.total <= 1;

                // try to get idle connection, do not lock last connection
                if ( connections.idle.size && !lastConnection ) {
                    dbh = connections.idle.values().next().value;

                    this.#deleteIdleTimeout( dbh );
                    connections.idle.delete( dbh );

                    if ( !lock ) connections.active.add( dbh );
                }

                // create new connection
                else if ( connections.total < this.maxConnections && !lastConnection ) {
                    connections.total++;

                    if ( slave ) {

                        // XXX
                    }
                    else {
                        dbh = this._newDbh( { "master": true } );
                    }

                    dbh.on( "destroy", this.#onDbhDestroy.bind( this ) );
                    dbh.on( "idle", this.#onDbhIdle.bind( this ) );

                    if ( !lock ) connections.active.add( dbh );
                }

                // try to get active connection, do not lock last connection
                else if ( !lock && connections.active.size ) {
                    dbh = connections.active.values().next().value;

                    // rotate
                    connections.active.delete( dbh );
                    connections.active.add( dbh );
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
            const connections = dbh.isMaster ? this.#masterConnections : this.#slaveConnections;

            connections.total--;

            this.#deleteIdleTimeout( dbh );
            connections.idle.delete( dbh );
            connections.active.delete( dbh );

            connections.signal.try();
        }

        #onDbhIdle ( dbh ) {

            // connetion is in the transaction, destroy
            if ( dbh.inTransaction ) {
                dbh.destroy();
            }

            // idle
            else {
                const connections = dbh.isMaster ? this.#masterConnections : this.#slaveConnections;

                this.#deleteIdleTimeout( dbh );

                // set idle timeout
                if ( this.idleTimeout ) {
                    this.#idleTimeouts.set( dbh,
                        setTimeout( () => dbh.destroy( result( [500, `Database connection closed on timeout`] ) ), this.idleTimeout ) );
                }

                connections.idle.add( dbh );
                connections.active.delete( dbh );

                connections.signal.try();
            }
        }

        #deleteIdleTimeout ( dbh ) {
            clearTimeout( this.#idleTimeouts.get( dbh ) );

            this.#idleTimeouts.delete( dbh );
        }
    };
