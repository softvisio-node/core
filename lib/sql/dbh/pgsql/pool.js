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

export default Super =>
    class extends ( Super || Object ) {
        #stats = new Stats( this );
        #idleTimeouts = new Map();
        #dnsWatcher;
        #fakeConnection;

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

        get _connections () {
            return { "master": this.#masterConnections, "slave": this.#slaveConnections };
        }

        // protected
        async _getConnection ( lock, slave ) {
            if ( slave ) {
                if ( !this.slaveHostname ) slave = false;
                else if ( !this.#dnsWatcher ) this.#dnsWatcher = new DnsWatcher( this.slaveHostname ).unref().start();
            }

            const connections = slave ? this.#slaveConnections : this.#masterConnections;

            while ( 1 ) {
                let dbh;

                // do not lock last connection to avoid deadlocks
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
                    const addresses = await this.#dnsWatcher.lookup(),
                        hosts = connections.hosts;

                    let slaveAddress;

                    // slave is not available, create destroyed slave connection
                    if ( !addresses.size && !connections.active.size ) {
                        return ( this.#fakeConnection ??= this._newConnection( { "destroyed": true, "slaveAddress": "0.0.0.0" } ) );
                    }

                    // can create new slave connection
                    else if ( connections.total < addresses.size * this.maxConnectionsPerSlave ) {
                        let addrConnections = Infinity;

                        // find slave host with the minimal number of connections
                        for ( const address of addresses ) {

                            // new slave host
                            if ( !hosts[address] ) {
                                slaveAddress = address;

                                break;
                            }

                            // host max connections reached
                            else if ( hosts[address] >= this.maxConnectionsPerSlave ) {
                                continue;
                            }

                            // find host with the minimal number of connections
                            else if ( hosts[address] < addrConnections ) {
                                slaveAddress = address;

                                addrConnections = hosts[slaveAddress];
                            }
                        }
                    }

                    // create slave connection
                    if ( slaveAddress ) {
                        connections.total++;

                        hosts[slaveAddress] ||= 0;
                        hosts[slaveAddress]++;

                        dbh = this._newConnection( { slaveAddress } );

                        dbh.on( "destroy", this.#onConnectionDestroy.bind( this ) );
                        dbh.on( "idle", this.#onConnectionIdle.bind( this ) );

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

                    dbh.on( "destroy", this.#onConnectionDestroy.bind( this ) );
                    dbh.on( "idle", this.#onConnectionIdle.bind( this ) );

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
        #onConnectionDestroy ( dbh, res ) {
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
                connections.hosts[dbh.slaveAddress]--;
                if ( !connections.hosts[dbh.slaveAddress] ) delete connections.hosts[dbh.slaveAddress];

                if ( !res.ok ) this.#dnsWatcher.reset();
            }

            connections.signal.trySend();
        }

        #onConnectionIdle ( dbh ) {

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
                    this.#idleTimeouts.set(
                        dbh,
                        setTimeout( () => dbh.destroy( result( [200, `Database connection closed on timeout`] ) ), this.idleTimeout )
                    );
                }

                connections.idle.add( dbh );
                connections.active.delete( dbh );

                // master
                if ( dbh.isMaster ) {
                    connections.locked.delete( dbh );
                }

                connections.signal.trySend();
            }
        }

        #deleteIdleTimeout ( dbh ) {
            clearTimeout( this.#idleTimeouts.get( dbh ) );

            this.#idleTimeouts.delete( dbh );
        }
    };
