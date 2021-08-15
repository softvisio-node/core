import { DBHPool } from "../dbh.js";
import PgsqlDBH from "./pgsql/dbh.js";
import { Where as _Where, Query as _Query } from "../query.js";
import Mutex from "#lib/threads/mutex";
import Signal from "#lib/threads/signal";
import { getDefaultPort } from "#lib/utils/net";

import CONST from "#lib/const";
import { DEFAULT_TYPES_PGSQL } from "../types.js";

// NOTE unix socket: pgsql://postgres:1@unix/var/run/postgres.sock:database

const DEFAULT_MAX_CONNECTIONS = 3;

class Where extends _Where {
    get _likeOperator () {
        return "ILIKE";
    }
}

class Query extends _Query {
    get _likeOperator () {
        return "ILIKE";
    }
}

export default class DBHPoolPgsql extends DBHPool {
    #url;

    #socket;
    #hostname;
    #port;
    #username;
    #password;
    #database;
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

    #types = { ...DEFAULT_TYPES_PGSQL.types };
    #encode = { ...DEFAULT_TYPES_PGSQL.encode };
    #decode = { ...DEFAULT_TYPES_PGSQL.decode };

    constructor ( url, options = {} ) {
        super();

        this.#hostname = url.hostname;

        if ( url.hostname === "unix" ) {
            const idx = url.pathname.indexOf( ":" );

            if ( idx < 0 ) {
                this.#socket = url.pathname;
            }
            else {
                this.#socket = url.pathname.substring( 0, idx );

                this.#database = options.database ?? url.pathname.substr( idx + 1 );
                if ( this.#database.startsWith( "/" ) ) this.#database = this.#database.substr( 1 );
            }
        }
        else {
            this.#port = url.port || getDefaultPort( "pgsql:" );
            this.#database = options.database ?? url.pathname.substr( 1 );
        }

        this.#username = options.username ?? url.username;
        this.#password = options.password ?? url.password;

        // maxConnections
        this.#maxConnections = options.maxConnections || url.searchParams.get( "maxConnections" ) || DEFAULT_MAX_CONNECTIONS;
        this.#maxConnections = +this.#maxConnections;
        if ( isNaN( this.#maxConnections ) || this.#maxConnections < 1 ) this.#maxConnections = DEFAULT_MAX_CONNECTIONS;

        this.#slots = this.#maxConnections;

        // watch for notifications subscribe
        this.on( "newListener", this.#subscribe.bind( this ) );
        this.on( "removeListener", this.#unsubscribe.bind( this ) );
    }

    get isPgsql () {
        return true;
    }

    get socket () {
        return this.#socket;
    }

    get hostname () {
        return this.#hostname;
    }

    get port () {
        return this.#port;
    }

    get username () {
        return this.#username;
    }

    get password () {
        return this.#password;
    }

    get database () {
        return this.#database;
    }

    get url () {
        if ( !this.#url ) {
            const url = new URL( "pgsql://" );

            url.hostname = this.#hostname;
            url.username = this.#username;
            url.password = this.#password;

            if ( this.#hostname === "unix" ) {
                url.pathname = this.#socket + ( this.#database ? ":" + this.#database : "" );
            }
            else {
                if ( this.#port !== getDefaultPort( url.protocol ) ) url.port = this.#port;
                url.pathname = this.#database;
            }

            if ( this.#maxConnections !== DEFAULT_MAX_CONNECTIONS ) url.searchParams.set( "maxConnections", this.#maxConnections );

            url.searchParams.sort();

            this.#url = url.href;
        }

        return this.#url;
    }

    get types () {
        return this.#types;
    }

    get encode () {
        return this.#encode;
    }

    get decode () {
        return this.#decode;
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

    where ( ...args ) {
        return new Where( args );
    }

    sql () {
        return new Query().sql( ...arguments );
    }

    quote ( param ) {

        // param is tagged with the type
        if ( param != null && typeof param === "object" && param[CONST.SQL_TYPE] ) param = this.#encode[param[CONST.SQL_TYPE]]( param );

        // null
        if ( param == null ) {
            return "NULL";
        }
        else {

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
    async _getDBH ( forTransaction ) {
        while ( 1 ) {
            let dbh;

            if ( this.#slots ) {
                this.#slots--;

                dbh = new PgsqlDBH( this );

                dbh.on( "destroy", this.#onDBHDestroy.bind( this ) );

                dbh.on( "release", this.#onDBHRelease.bind( this ) );
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

    #onDBHRelease ( dbh ) {
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

    #onDBHDestroy ( dbh ) {
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
        return ( await this._getDBH() ).exec( query, params );
    }

    async do ( query, params ) {
        return ( await this._getDBH() ).do( query, params );
    }

    async select ( query, params ) {
        return ( await this._getDBH() ).select( query, params );
    }

    async selectRow ( query, params ) {
        return ( await this._getDBH() ).selectRow( query, params );
    }

    // types
    async addType ( name, options ) {
        return ( await this._getDBH() ).addType( name, options );
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
                this.#notificationsHandle = new PgsqlDBH( this );
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
