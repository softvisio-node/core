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
    #url;
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

    #notifications = new Set();
    #pendingSubscribe = new Set();
    #pendingUnsubscribe = new Set();
    #notificationsHandle;
    #waitReadySignal = new Signal();
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

        // watch for notifications subscribe
        this.on( "newListener", this.#subscribe.bind( this ) );
        this.on( "removeListener", this.#unsubscribe.bind( this ) );
    }

    get isPgsql () {
        return true;
    }

    get type () {
        return "pgsql";
    }

    // XXX
    get url () {
        if ( !this.#url ) {
            const url = new URL( "pgsql://" );

            url.searchParams.sort();

            this.#url = url.href;
        }

        return this.#url;
    }

    get inTransaction () {
        return false;
    }

    // public
    toString () {
        return this.url;
    }

    toJSON () {
        return this.url;
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
    get isReady () {
        return !this.#pendingSubscribe.size;
    }

    async waitReady () {
        if ( this.isReady ) return;

        return this.#waitReadySignal.wait();
    }

    #subscribe ( name ) {
        if ( !name.startsWith( "event/" ) ) return;

        // already subscribed
        if ( this.listenerCount( name ) ) return;

        // remove "event/" prefix
        name = name.substr( 6 );

        this.#notifications.add( name );
        this.#pendingSubscribe.add( name );
        this.#pendingUnsubscribe.delete( name );

        this.#syncNotifications();
    }

    #unsubscribe ( name ) {
        if ( !name.startsWith( "event/" ) ) return;

        // not unsubscribed
        if ( this.listenerCount( name ) ) return;

        // remove "event/" prefix
        name = name.substr( 6 );

        this.#notifications.delete( name );
        if ( this.#pendingSubscribe.has( name ) ) {
            this.#pendingSubscribe.delete( name );
        }
        else {
            this.#pendingUnsubscribe.add( name );
        }

        this.#syncNotifications();
    }

    #onNotificationHandleDestroy ( dbh ) {

        // remove handle
        this.#notificationsHandle = null;

        this.#pendingSubscribe = new Set( [...this.#notifications] );
        this.#pendingUnsubscribe.clear();

        this.emit( "disconnect" );

        this.#syncNotifications();
    }

    async #syncNotifications () {
        if ( !this.#notificationsMutex.tryDown() ) return;

        var wasSynched;

        while ( 1 ) {

            // synched
            if ( !this.#pendingSubscribe.size && !this.#pendingUnsubscribe.size ) break;

            wasSynched = true;

            const pendingSubscribe = [...this.#pendingSubscribe],
                pendingUnsubscribe = [...this.#pendingUnsubscribe];

            const sql = [

                //
                ...pendingSubscribe.map( name => `LISTEN "${name}";` ),
                ...pendingUnsubscribe.map( name => `UNLISTEN "${name}";` ),
            ].join( " " );

            // create handle if not created
            if ( !this.#notificationsHandle ) {
                this.#notificationsHandle = new PgsqlDbh( this, this.#options );
                this.#notificationsHandle.on( "destroy", this.#onNotificationHandleDestroy.bind( this ) );
            }

            // try to sync
            const res = await this.#notificationsHandle.exec( sql );

            if ( res.ok ) {
                for ( const name of pendingSubscribe ) this.#pendingSubscribe.delete( name );

                for ( const name of pendingUnsubscribe ) this.#pendingUnsubscribe.delete( name );
            }
        }

        this.#notificationsMutex.up();
        this.#waitReadySignal.broadcast();

        if ( wasSynched ) this.emit( "ready" );
    }
}
