import { DbhPool } from "../dbd.js";
import PgsqlDbh from "./pgsql/dbh.js";
import { Where, Query } from "../dbi.js";
import Mutex from "#lib/threads/mutex";
import Signal from "#lib/threads/signal";

import CONST from "#lib/const";
import { DEFAULT_TYPES_PGSQL } from "../types.js";

const DEFAULT_PORT = 5432;
const DEFAULT_MAX_CONNECTIONS = 3;

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

export default class DbhPoolPgsql extends DbhPool {
    #options = {
        "hostname": null,
        "port": DEFAULT_PORT,
        "socket": null,
        "username": null,
        "password": null,
        "database": null,
    };

    #maxConnections;
    #pool = [];
    #slots = 10;
    #signal = new Signal();

    #notificationsHandle;
    #waitConnectSignal = new Signal();
    #notifications = {};
    #notificationsCount = 0;
    #subscribedNotifications = 0;
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

        this.#slots = this.#maxConnections = options.maxConnections || url.searchParams.get( "maxConnections" ) || DEFAULT_MAX_CONNECTIONS;

        this.on( "newListener", this.#subscribe.bind( this ) );
        this.on( "removeListener", this.#unsubscribe.bind( this ) );
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
            if ( param[CONST.SQL_TYPE] ) param = this._encode[param[CONST.SQL_TYPE]]( param );

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

    // pool
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

    // query
    async exec ( query, params ) {
        return ( await this._getDbh() ).exec( query, params );
    }

    async do ( query, params ) {
        return ( await this._getDbh() ).do( query, params );
    }

    async select ( query, params ) {
        return ( await this._getDbh() ).select( query, params );
    }

    async selectRow ( query, params ) {
        return ( await this._getDbh() ).selectRow( query, params );
    }

    // types
    async addType ( type ) {
        return ( await this._getDbh() ).addType( type );
    }

    // notifications
    get isConnected () {
        return this.#notificationsCount === this.#subscribedNotifications;
    }

    async waitConnect () {
        if ( this.isConnected ) return;

        return this.#waitConnectSignal.wait();
    }

    #subscribe ( name ) {
        if ( !name.startsWith( "event/" ) ) return;

        // already subscribed
        if ( this.listenerCount( name ) ) return;

        // remove "event/" prefix
        name = name.substr( 6 );

        this.#notifications[name] = false;
        this.#notificationsCount++;

        this.#checkNotifications();
    }

    #unsubscribe ( name ) {
        if ( !name.startsWith( "event/" ) ) return;

        // not unsubscribed
        if ( this.listenerCount( name ) ) return;

        // remove "event/" prefix
        name = name.substr( 6 );

        delete this.#notifications[name];
        this.#notificationsCount--;

        // unsubscribe
        if ( this.#notificationsHandle ) {
            this.#subscribedNotifications--;

            this.#notificationsHandle.do( `UNLISTEN "${name}"` );
        }
    }

    #onNotificationHandleDestroy ( dbh ) {

        // remove handle
        this.#notificationsHandle = null;
        this.#subscribedNotifications = 0;

        this.emit( "disconnect" );

        this.#checkNotifications();
    }

    async #checkNotifications () {
        if ( !this.#notificationsMutex.tryDown() ) return;

        while ( 1 ) {
            if ( this.isConnected ) break;

            const notificationsCount = this.#notificationsCount;

            const sql = Object.keys( this.#notifications )
                .map( name => `LISTEN "${name}";` )
                .join( " " );

            // create handle if not created
            if ( !this.#notificationsHandle ) {
                this.#notificationsHandle = new PgsqlDbh( this, this.#options );
                this.#notificationsHandle.on( "destroy", this.#onNotificationHandleDestroy.bind( this ) );
            }

            // try to subscribe
            const res = await this.#notificationsHandle.exec( sql );

            if ( res.ok ) this.#subscribedNotifications = notificationsCount;
        }

        this.#notificationsMutex.up();

        if ( this.#notificationsCount ) this.emit( "connect" );
    }
}
