import Signal from "#lib/threads/signal";
import dns from "dns";
import Mutex from "#lib/threads/mutex";

class Stats {
    #pool;

    constructor ( pool ) {
        this.#pool = pool;
    }

    // public
    toString () {
        return this.toJSON();
    }

    toJSON () {
        const connections = this.#pool._connections;

        return {
            "master": {
                "maxConnections": this.#pool.maxConnections,
                "totalConnections": connections.master.total,
                "idleConnections": connections.master.idle.size,
                "activeConnections": connections.master.active.size,
                "lockedConnections": connections.master.total - connections.master.idle.size - connections.master.active.size,
            },
            "slave": {
                "maxConnectionsPerSlave": this.#pool.maxConnectionsPerSlave,
                "totalConnections": connections.slave.idle.size + connections.slave.active.size,
                "idleConnections": connections.slave.idle.size,
                "activeConnections": connections.slave.active.size,
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
        #slaveResolveMutex = new Mutex();

        #masterConnections = {
            "total": 0,
            "idle": new Set(),
            "active": new Set(),
            "signal": new Signal(),
        };

        #slaveConnections = {
            "hosts": {},
            "idle": new Set(),
            "active": new Set(),
            "signal": new Signal(),
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

                const lastConnection = !slave && lock && this.maxConnections - connections.total <= 1;

                // try to get idle master / slave connection, do not lock last connection
                if ( connections.idle.size && !lastConnection ) {
                    dbh = connections.idle.values().next().value;

                    this.#deleteIdleTimeout( dbh );
                    connections.idle.delete( dbh );

                    if ( !lock ) connections.active.add( dbh );
                }

                // slave
                else if ( slave ) {
                    const slaveAddr = await this.#getSlaveAddr();

                    if ( slaveAddr || !connections.active.size ) {

                        // if can't create new conn and no busy connections - create fake connection to "0.0.0.0"
                        slave ||= "0.0.0.0";

                        dbh = this._newDbh( { "master": false, slaveAddr } );

                        dbh.on( "destroy", this.#onDbhDestroy.bind( this ) );
                        dbh.on( "idle", this.#onDbhIdle.bind( this ) );

                        connections.active.add( dbh );
                    }

                    // get active slave connection
                    else {
                        dbh = connections.active.values().next().value;

                        // rotate
                        connections.active.delete( dbh );
                        connections.active.add( dbh );
                    }
                }

                // create new master connection
                else if ( connections.total < this.maxConnections && !lastConnection ) {
                    connections.total++;

                    dbh = this._newDbh( { "master": true } );

                    dbh.on( "destroy", this.#onDbhDestroy.bind( this ) );
                    dbh.on( "idle", this.#onDbhIdle.bind( this ) );

                    if ( !lock ) connections.active.add( dbh );
                }

                // try to get active master connection
                else if ( !lock && connections.active.size ) {
                    dbh = connections.active.values().next().value;

                    // rotate
                    connections.active.delete( dbh );
                    connections.active.add( dbh );
                }

                // wait for master connection unlock
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

            this.#deleteIdleTimeout( dbh );
            connections.idle.delete( dbh );
            connections.active.delete( dbh );

            // master
            if ( dbh.isMaster ) {
                connections.total--;
            }

            // slave
            else {

                // decrease slave addr connections
                connections.hosts[dbh.slaveAddr]--;
                if ( !connections.hosts[dbh.slaveAddr] ) delete connections.hosts[dbh.slaveAddr];
            }

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

        async #getSlaveAddr () {
            const records = await this.#resolveSlave(),
                hosts = this.#slaveConnections.hosts;

            var addr,
                addrConnections = Infinity;

            if ( records ) {
                for ( const record of records ) {

                    // new addr
                    if ( !hosts[record.address] ) {
                        addr = record.address;
                        hosts[addr] = 0;

                        break;
                    }

                    // find addr with minimal number of connections
                    else if ( hosts[record.address] < this.maxConnectionsPerSlave && hosts[record.address] < addrConnections ) {
                        addr = record.address;
                        addrConnections = hosts[addr];
                    }
                }
            }

            // addr found
            if ( addr ) hosts[addr]++;

            return addr;
        }

        async #resolveSlave () {
            if ( !this.#slaveResolveMutex.tryDown() ) return this.#slaveResolveMutex.signal.wait();

            try {
                var records = await dns.promises.lookup( this.slaveHostname, { "all": true, "family": 0 } );
            }
            catch ( e ) {}

            this.#slaveResolveMutex.signal.broadcast( records );
            this.#slaveResolveMutex.up();

            return records;
        }
    };
