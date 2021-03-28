const { DbhPool } = require( "../dbd" );
const PgsqlDbh = require( "./pgsql/dbh" );
const { SQL_TYPE } = require( "../../const" );
const { Where, Query } = require( "../dbi" );
const Mutex = require( "../../threads/mutex" );

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
        "host": "",
        "port": 5432,
        "path": "",
        "username": "",
        "password": "",
        "database": "",
    };

    #pool = [];
    #slots = 10;

    #isConnected = true;
    #notifications = {};
    #notificationsHandle;
    #notificationsMutex = new Mutex();

    types = { ...DEFAULT_TYPES_PGSQL.types };
    _encode = { ...DEFAULT_TYPES_PGSQL.encode };
    _decode = { ...DEFAULT_TYPES_PGSQL.decode };

    constructor ( url, options = {} ) {
        super( url, options );

        if ( options.host || url.hostname ) {
            this.#options.host = options.host || url.hostname;

            this.#options.port = options.port || url.port || this.#options.port;

            this.#options.username = options.username ?? url.username;
            this.#options.password = options.password ?? url.password;

            this.#options.database = options.database ?? url.pathname.substr( 1 );
        }
        else {

            // XXX authorization is not possible
            // XXX how to split socket path to path and database in case if database is not provided???
            throw `Postgres connect using unix socket is not supported`;
        }

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
    _getDbh ( forTransaction ) {
        let dbh;

        if ( this.#slots ) {
            this.#slots--;

            dbh = new PgsqlDbh( this, this.#options );
        }
        else {
            dbh = this.#pool.shift();
        }

        if ( !forTransaction ) this.#pool.push( dbh );

        return dbh;
    }

    _onDbhError () {
        this.#checkNotificationsHandle();

        this.#pool = this.#pool.filter( dbh => {
            if ( dbh.isDestroyed ) {
                this.#slots++;

                return false;
            }
            else {
                return true;
            }
        } );
    }

    _pushDbh ( dbh ) {
        if ( dbh.isNotificationHandle ) return this.#checkNotificationsHandle();

        if ( dbh.isDestroyed ) {
            this.#slots++;
        }
        else if ( dbh.inTransaction ) {
            this.#slots++;

            dbh._destroy();
        }
        else {
            this.#pool.push( dbh );
        }
    }

    // QUERY
    async exec ( query, params ) {
        return this._getDbh().exec( query, params );
    }

    async do ( query, params ) {
        return this._getDbh().do( query, params );
    }

    async selectAll ( query, params ) {
        return this._getDbh().selectAll( query, params );
    }

    async selectRow ( query, params ) {
        return this._getDbh().selectRow( query, params );
    }

    // TYPES
    async addType ( type ) {
        return this._getDbh().addType( type );
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

                return this.#checkNotifications( true );
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

    #checkNotificationsHandle () {

        // handle was destroyed
        if ( this.#notificationsHandle && this.#notificationsHandle.isDestroyed ) {

            // remove handle
            this.#notificationsHandle = null;

            // mark all notifications as unsubscribed
            for ( const name in this.#notifications ) this.#notifications[name] = false;

            this.#setIsConnected( false );

            this.#checkNotifications();
        }
    }

    // called when:
    // handle destroyed
    // notification added
    async #checkNotifications ( wait ) {
        if ( !this.#notificationsMutex.tryDown() ) {
            if ( wait ) return this.#notificationsMutex.signal.wait();

            return;
        }

        while ( 1 ) {
            let sql = "";

            // check for unsubscribed notifications
            for ( const name in this.#notifications ) {

                // already subscribed
                if ( this.#notifications[name] ) continue;

                this.#notifications[name] = true;

                sql += `LISTEN "${name}";`;
            }

            // all unsubscribed
            if ( !sql ) break;

            // create handle if not created
            if ( !this.#notificationsHandle ) {
                this.#notificationsHandle = new PgsqlDbh( this, this.#options );
                this.#notificationsHandle.isNotificationHandle = true;
            }

            // try to subscribe
            const res = await this.#notificationsHandle.do( sql );

            // unable to subscribe
            if ( !res.ok ) {

                // mark all notifications as unsubscribed
                for ( const name in this.#notifications ) this.#notifications[name] = false;
            }
        }

        this.#setIsConnected( true );

        this.#notificationsMutex.up();

        this.#notificationsMutex.signal.broadcast();
    }

    // XXX
    #setIsConnected ( value ) {
        if ( this.#isConnected === value ) return;

        this.#isConnected = value;

        // do not fire events if has no active notifications listeners
        // if ( !this.#notifications.size ) return;

        // connected
        if ( value ) {
            this.emit( "reconnect" );
        }

        // disconnected
        else {
            this.emit( "disconnect" );
        }
    }
};
