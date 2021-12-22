import Signal from "#lib/threads/signal";
import DnsWatcher from "#lib/dns/watcher";

class Stats {
    #pool;

    constructor ( pool ) {
        this.#pool = pool;
    }

    // public
    toString () {
        return JSON.stringify( this.toJSON(), null, 4 );
    }

    toJSON () {
        const connections = this.#pool._connections;

        return {
            "master": {
                "maxConnections": this.#pool.maxConnections,
                "totalConnections": connections.master.total,
                "idleConnections": connections.master.idle.size,
                "activeConnections": connections.master.active.size,
                "lockedConnections": connections.master.locked.size,
            },
            "slave": {
                "maxConnectionsPerSlave": this.#pool.maxConnectionsPerSlave,
                "totalConnections": connections.slave.total,
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
        return ( await this.#pool._getConnection( false, true ) ).select( query, params );
    }

    async selectRow ( query, params ) {
        return ( await this.#pool._getConnection( false, true ) ).selectRow( query, params );
    }
}

export default Super =>
    class extends ( Super || Object ) {
        #stats = new Stats( this );
        #slave = new Slave( this );
        #idleTimeouts = new Map();
        #dnsWatcher;

        #masterConnections = {
            "total": 0,
            "idle": new Set(),
            "active": new Set(),
            "locked": new Set(),
            "signal": new Signal(),
        };

        #slaveConnections = {
            "total": 0,
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
        async _getConnection ( lock, slave ) {
            if ( slave ) {
                if ( !this.slaveHostname ) slave = false;
                else if ( !this.#dnsWatcher ) this.#dnsWatcher = new DnsWatcher( this.slaveHostname ).start();
            }

            const connections = slave ? this.#slaveConnections : this.#masterConnections;

            while ( 1 ) {
                let dbh;

                const lastConnection = !slave && lock && this.maxConnections - connections.locked.size <= 1;

                // try to get idle master / slave connection, do not lock last connection
                if ( connections.idle.size && !lastConnection ) {
                    dbh = connections.idle.values().next().value;

                    this.#deleteIdleTimeout( dbh );
                    connections.idle.delete( dbh );

                    if ( lock ) connections.locked.add( dbh );
                    else connections.active.add( dbh );
                }

                // slave
                else if ( slave ) {
                    const addresses = await this.#dnsWatcher.resolve(),
                        hosts = connections.hosts;

                    let slaveAddr;

                    // slave is not available, create fake slave connection
                    if ( !addresses.size && !connections.active.size ) {
                        slaveAddr = "0.0.0.0";
                    }

                    // can create new slave connection
                    else if ( connections.total < addresses.size * this.maxConnectionsPerSlave ) {
                        let addrConnections = Infinity;

                        // find slave host with the minimal number of connections
                        for ( const address of addresses ) {

                            // new slave host
                            if ( !hosts[address] ) {
                                slaveAddr = address;

                                break;
                            }

                            // host max connections reached
                            else if ( hosts[address] >= this.maxConnectionsPerSlave ) {
                                continue;
                            }

                            // find host with the minimal number of connections
                            else if ( hosts[address] < addrConnections ) {
                                slaveAddr = address;

                                addrConnections = hosts[slaveAddr];
                            }
                        }
                    }

                    // create slave connection
                    if ( slaveAddr ) {
                        connections.total++;

                        hosts[slaveAddr] ||= 0;
                        hosts[slaveAddr]++;

                        // create fake slave connection
                        dbh = this._newConnection( { slaveAddr } );

                        dbh.on( "destroy", this.#onDbhDestroy.bind( this ) );
                        dbh.on( "idle", this.#onDbhIdle.bind( this ) );

                        connections.active.add( dbh );
                    }

                    // reuse active slave connection
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

                    dbh = this._newConnection();

                    dbh.on( "destroy", this.#onDbhDestroy.bind( this ) );
                    dbh.on( "idle", this.#onDbhIdle.bind( this ) );

                    if ( lock ) connections.locked.add( dbh );
                    else connections.active.add( dbh );
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
            connections.total--;
            connections.idle.delete( dbh );
            connections.active.delete( dbh );

            // master
            if ( dbh.isMaster ) {
                connections.locked.delete( dbh );
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
                connections.locked.delete( dbh );

                connections.signal.try();
            }
        }

        #deleteIdleTimeout ( dbh ) {
            clearTimeout( this.#idleTimeouts.get( dbh ) );

            this.#idleTimeouts.delete( dbh );
        }
    };
