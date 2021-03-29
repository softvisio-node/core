const { DbhPool } = require( "../dbd" );
const PgsqlDbh = require( "./pgsql/dbh" );
const { SQL_TYPE } = require( "../../const" );
const { Where, Query } = require( "../dbi" );
const Mutex = require( "../../threads/mutex" );
const Signal = require( "../../threads/signal" );

const DEFAULT_PORT = 5432;
const DEFAULT_SLOTS = 3;
const { DEFAULT_TYPES_PGSQL } = require( "../types" );

class DbdWhere extends Where {
    get _likeOperator () {
        return "ILIKE";
    }
}

class DbdQuery extends Query {
    get _likeOperator () {
        return "ILIKE";
    }
}

module.exports = class DbhPoolPgsql extends DbhPool {
    #options = {
        "hostname": null,
        "port": DEFAULT_PORT,
        "socket": null,
        "username": null,
        "password": null,
        "database": null,
    };

    #pool = [];
    #slots = 10;
    #signal = new Signal();

    #isConnected = true;
    #notifications = {};
    #notificationsHandle;
    #notificationsHandleConnected;
    #notificationsReconnected;
    #notificationsMutex = new Mutex();

    types = { ...DEFAULT_TYPES_PGSQL.types };
    _encode = { ...DEFAULT_TYPES_PGSQL.encode };
    _decode = { ...DEFAULT_TYPES_PGSQL.decode };

    constructor ( url, options = {} ) {
        super( url, options );

        if ( options.hostname || url.hostname ) {
            this.#options.hostname = options.hostname || url.hostname;
            this.#options.port = options.port || url.port || DEFAULT_PORT;
        }
        else {
            this.#options.socket = options.socket;
        }

        this.#options.username = options.username ?? url.username;
        this.#options.password = options.password ?? url.password;
        this.#options.database = options.database ?? url.pathname.substr( 1 );

        this.#slots = options.max || url.searchParams.get( "max" ) || DEFAULT_SLOTS;

        this.on( "removeListener", this.#removeNotificationListener.bind( this ) );
    }

    get isPgsql () {
        return true;
    }

    get type () {
        return "pgsql";
    }

    get inTransaction () {
        return false;
    }

    WHERE ( ...args ) {
        return new DbdWhere( args );
    }

    sql () {
        return new DbdQuery().sql( ...arguments );
    }

    quote ( param ) {

        // null
        if ( param == null ) {
            return "NULL";
        }
        else {

            // param is tagged with the type
            if ( param[SQL_TYPE] ) param = this._encode[param[SQL_TYPE]]( param );

            // string
            if ( typeof param === "string" ) {
                return "'" + param.replace( /'/g, "''" ) + "'";
            }

            // number
            else if ( typeof param === "number" ) {
                return param;
            }

            // boolean
            else if ( typeof param === "boolean" ) {
                return param === true ? "TRUE" : "FALSE";
            }

            // bigint
            else if ( typeof param === "bigint" ) {
                return param.toString();
            }

            // object
            else if ( typeof param === "object" ) {

                // buffer, https://www.postgresql.org/docs/current/static/datatype-binary.html
                if ( Buffer.isBuffer( param ) ) {
                    return "'\\x" + param.toString( "hex" ) + "'";
                }

                // date
                else if ( param instanceof Date ) {
                    return "'" + param.toISOString() + "'";
                }

                // object
                else {
                    return "'" + JSON.stringify( param ).replace( /'/g, "''" ) + "'";
                }
            }

            // invalid type
            else {
                throw Error( `Unsupported SQL parameter type "${param}"` );
            }
        }
    }

    // POOL
    async _getDbh ( forTransaction ) {
        while ( 1 ) {
            let dbh;

            if ( this.#slots ) {
                this.#slots--;

                dbh = new PgsqlDbh( this, this.#options );

                dbh.on( "destroy", this.#onDbhDestroy.bind( this ) );

                dbh.on( "release", this.#onDbhRelease.bind( this ) );
            }
            else if ( this.#pool.length ) {
                dbh = this.#pool.shift();
            }
            else {
                await this.#signal.wait();

                continue;
            }

            if ( !forTransaction ) this.#pool.push( dbh );

            return dbh;
        }
    }

    #onDbhRelease ( dbh ) {
        if ( dbh.isDestroyed ) {
            this.#slots++;

            this.#signal.try();
        }
        else if ( dbh.inTransaction ) {
            dbh.destroy();
        }
        else {
            this.#pool.unshift( dbh );

            this.#signal.try();
        }
    }

    #onDbhDestroy ( dbh ) {
        this.#slots++;

        // try to remove from pool
        for ( let n = 0; n < this.#pool.length; n++ ) {
            if ( this.#pool[n] === dbh ) {
                this.#pool.splice( n, 1 );

                break;
            }
        }

        this.#signal.try();
    }

    // QUERY
    async exec ( query, params ) {
        return ( await this._getDbh() ).exec( query, params );
    }

    async do ( query, params ) {
        return ( await this._getDbh() ).do( query, params );
    }

    async selectAll ( query, params ) {
        return ( await this._getDbh() ).selectAll( query, params );
    }

    async selectRow ( query, params ) {
        return ( await this._getDbh() ).selectRow( query, params );
    }

    // TYPES
    async addType ( type ) {
        return ( await this._getDbh() ).addType( type );
    }

    // NOTIFICATIONS
    get isConnected () {
        return this.#isConnected;
    }

    async on ( name, callback ) {
        super.on( name, callback );

        return this.#addNotification( name );
    }

    async once ( name, callback ) {
        super.once( name, callback );

        return this.#addNotification( name );
    }

    async #addNotification ( name ) {
        if ( name.startsWith( "event/" ) ) {
            const event = name.substr( 6 );

            if ( !( event in this.#notifications ) ) {
                this.#notifications[event] = false;

                this.#isConnected = false;

                const promise = this.#notificationsMutex.signal.wait();

                this.#checkNotifications();

                return promise;
            }
        }
    }

    #removeNotificationListener ( name ) {
        if ( !name.startsWith( "event/" ) ) return;

        name = name.substr( 6 );

        if ( !this.listenerCount( name ) ) {
            delete this.#notifications[name];

            if ( this.#notificationsHandle ) this.#notificationsHandle.do( `UNLISTEN "${name}"` );
        }
    }

    #onNotificationHandleDestroy ( dbh ) {

        // remove handle
        this.#notificationsHandle = null;

        // mark all notifications as unsubscribed
        for ( const name in this.#notifications ) this.#notifications[name] = false;

        this.#isConnected = false;

        // handle was connected, status changed
        if ( this.#notificationsHandleConnected ) {
            this.#notificationsHandleConnected = false;

            if ( !Object.isEmpty( this.#notifications ) ) this.emit( "disconnect" );
        }

        this.#checkNotifications();
    }

    async #checkNotifications () {
        if ( !this.#notificationsMutex.tryDown() ) return;

        while ( 1 ) {
            let sql = "";

            // check for unsubscribed notifications
            for ( const name in this.#notifications ) {

                // already subscribed
                if ( this.#notifications[name] ) continue;

                this.#notifications[name] = true;

                sql += `LISTEN "${name}";`;
            }

            // all subscribed
            if ( !sql ) break;

            // create handle if not created
            if ( !this.#notificationsHandle ) {
                this.#notificationsHandle = new PgsqlDbh( this, this.#options );
                this.#notificationsHandle.on( "destroy", this.#onNotificationHandleDestroy.bind( this ) );
            }

            // try to subscribe
            await this.#notificationsHandle.do( sql );
        }

        // connected
        this.#isConnected = true;

        this.#notificationsMutex.up();

        this.#notificationsMutex.signal.broadcast();

        if ( this.#notificationsReconnected ) {

            // handle was not connected, status changed
            if ( !this.#notificationsHandleConnected && !Object.isEmpty( this.#notifications ) ) this.emit( "reconnect" );
        }
        else {
            this.#notificationsReconnected = true;
        }

        this.#notificationsHandleConnected = true;
    }
};
