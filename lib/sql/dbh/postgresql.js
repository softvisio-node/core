import mixins from "#lib/mixins";
import Dbh from "#lib/sql/dbh";
import Pool from "./postgresql/pool.js";
import PostgreSqlConnection from "./postgresql/connection.js";
import { Sql } from "#lib/sql/query";
import { getDefaultPort } from "#lib/net";
import Transactions from "./postgresql/transactions.js";
import Main from "./postgresql/main.js";
import Schema from "./postgresql/schema.js";
import { encodeBuffer, encodeDate, postgresqlDecoders } from "#lib/sql/types";
import { READ_ONLY_SQL_TRANSACTION } from "#lib/sql/dbh/postgresql/error-codes";

const DEFAULT_APP_NAME = "core";
const DEFAULT_MAX_CONNECTIONS = 10;
const DEFAULT_MAX_CONNECTIONS_PER_STANDBY = 3;
const DEFAULT_IDLE_TIMEOUT = 60_000; // 1 minute

const SOCKET_HOSTNAME = "local",
    DEFAULT_SOCKET_PATH = "/var/run/postgresql/.s.PGSQL.",
    DEFAULT_USERNAME = "postgres";

export default class DbhPoolPostgreSql extends mixins( Transactions, Main, Pool, Dbh ) {
    #url;

    #appName;
    #socket;
    #protocol;
    #hostname;
    #port;
    #username;
    #password;
    #database;
    #maxConnections;
    #maxConnectionsPerStandby;
    #standbyHost;
    #standbyPort;
    #idleTimeout;
    #schema = new Schema( this );
    #destroyed = false;

    #decode = { ...postgresqlDecoders };

    constructor ( url, options = {} ) {
        super();

        url = new URL( url );

        this.#appName = options.appName || url.searchParams.get( "appName" ) || DEFAULT_APP_NAME;

        this.#protocol = url.protocol;
        this.#username = ( options.username ?? decodeURIComponent( url.username ) ) || DEFAULT_USERNAME;
        this.#password = options.password ?? decodeURIComponent( url.password );
        this.#hostname = url.hostname;
        this.#port = +url.port || getDefaultPort( this.#protocol );
        this.#database = options.database ?? url.pathname.substring( 1 );
        this.#socket = url.searchParams.get( "socket" );

        if ( this.#socket || this.#hostname === SOCKET_HOSTNAME ) this.#hostname = null;

        if ( !this.#hostname && !this.#socket ) {
            this.#socket = DEFAULT_SOCKET_PATH + this.#port;
        }

        this.#standbyHost = options.standbyHost || url.searchParams.get( "standbyHost" );
        if ( this.#standbyHost ) {
            if ( this.#standbyHost.includes( ":" ) ) {
                [ this.#standbyHost, this.#standbyPort ] = this.#standbyHost.split( ":" );

                this.#standbyPort = Number( this.#standbyPort );
            }
            else {
                this.#standbyPort = this.#port;
            }
        }

        // maxConnections
        this.#maxConnections = +( options.maxConnections || url.searchParams.get( "maxConnections" ) || DEFAULT_MAX_CONNECTIONS );
        if ( !Number.isInteger( this.#maxConnections ) || this.#maxConnections < 1 ) {
            throw TypeError( `PostgreSQL maxConnections value is invalid` );
        }

        // maxConnectionsPerStandby
        this.#maxConnectionsPerStandby = +( options.maxConnectionsPerStandby || url.searchParams.get( "maxConnectionsPerStandby" ) || DEFAULT_MAX_CONNECTIONS_PER_STANDBY );
        if ( !Number.isInteger( this.#maxConnectionsPerStandby ) || this.#maxConnectionsPerStandby < 1 ) {
            throw TypeError( `PostgreSQL maxConnectionsPerStandby value is invalid` );
        }

        // idleTimeout
        this.#idleTimeout = +( options.idleTimeout ?? ( url.searchParams.get( "idleTimeout" ) || DEFAULT_IDLE_TIMEOUT ) );
        if ( !Number.isInteger( this.#idleTimeout ) || this.#idleTimeout < 0 ) {
            throw TypeError( `PostgreSQL idleTimeout value is invalid` );
        }

        this._connect();
    }

    // properties
    get isPostgreSql () {
        return true;
    }

    get appName () {
        return this.#appName;
    }

    get socket () {
        return this.#socket;
    }

    get protocol () {
        return this.#protocol;
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

    get maxConnections () {
        return this.#maxConnections;
    }

    get maxConnectionsPerStandby () {
        return this.#maxConnectionsPerStandby;
    }

    get standbyHost () {
        return this.#standbyHost;
    }

    get standbyPort () {
        return this.#standbyPort;
    }

    get idleTimeout () {
        return this.#idleTimeout;
    }

    get url () {
        if ( !this.#url ) {
            const url = new URL( this.protocol + "//" );

            const addUsername = this.#username && this.#username !== DEFAULT_USERNAME,
                addPort = this.#port !== getDefaultPort( url.protocol ),
                addSocket = DEFAULT_SOCKET_PATH + getDefaultPort( url.protocol ) !== this.#socket,
                addDatabase = this.#username === this.#database;

            // hostname
            if ( this.#hostname ) {
                url.hostname = this.#hostname;
                if ( addPort ) url.port = this.#port;
            }

            // socket
            else {
                if ( addUsername || this.#password ) {
                    url.hostname = SOCKET_HOSTNAME;
                }

                if ( addSocket ) {
                    url.searchParams.set( "socket", this.#socket );
                }
            }

            if ( addUsername ) url.username = this.#username;
            url.password = this.#password;
            if ( addDatabase ) url.pathname = this.#database;

            if ( this.#appName !== DEFAULT_APP_NAME ) url.searchParams.set( "appName", this.#appName );

            if ( this.#maxConnections !== DEFAULT_MAX_CONNECTIONS ) url.searchParams.set( "maxConnections", this.#maxConnections );
            if ( this.#idleTimeout !== DEFAULT_IDLE_TIMEOUT ) url.searchParams.set( "idleTimeout", this.#idleTimeout );

            if ( this.#standbyHost ) {
                if ( this.#standbyPort !== this.#port ) {
                    url.searchParams.set( "standbyHost", this.#standbyHost + ":" + this.#standbyPort );
                }
                else {
                    url.searchParams.set( "standbyHost", this.#standbyHost );
                }

                if ( this.#maxConnectionsPerStandby !== DEFAULT_MAX_CONNECTIONS_PER_STANDBY ) {
                    url.searchParams.set( "maxConnectionsPerStandby", this.#maxConnectionsPerStandby );
                }
            }

            url.searchParams.sort();

            this.#url = url.href;
        }

        return this.#url;
    }

    get main () {
        return this;
    }

    get schema () {
        return this.#schema;
    }

    get decode () {
        return this.#decode;
    }

    get inTransaction () {
        return false;
    }

    get isDestroyed () {
        return this.#destroyed;
    }

    // public
    async startCron () {
        return this.schema.cron.start();
    }

    async stopCron () {
        return this.schema.cron.stop();
    }

    async destroy () {
        if ( this.destroyed ) return;

        this.#destroyed = true;

        await this.schema.cron.shutDown();

        await this._destroy();
    }

    toString () {
        return this.url;
    }

    toJSON () {
        return this.url;
    }

    quote ( value ) {

        // null
        if ( value == null ) {
            return "NULL";
        }
        else {

            // string
            if ( typeof value === "string" ) {
                return "'" + value.replaceAll( "'", "''" ) + "'";
            }

            // number
            else if ( typeof value === "number" ) {
                return value;
            }

            // boolean
            else if ( typeof value === "boolean" ) {
                return value === true ? "TRUE" : "FALSE";
            }

            // bigint
            else if ( typeof value === "bigint" ) {
                return value.toString();
            }

            // object
            else if ( typeof value === "object" ) {

                // buffer, https://www.postgresql.org/docs/current/static/datatype-binary.html
                if ( Buffer.isBuffer( value ) ) {
                    return encodeBuffer( value );
                }

                // date
                else if ( value instanceof Date ) {
                    return "'" + encodeDate( value ) + "'";
                }

                // object
                else {
                    return "'" + JSON.stringify( value ).replace( /'/g, "''" ) + "'";
                }
            }

            // invalid type
            else {
                throw Error( `Unsupported SQL parameter type "${ value }"` );
            }
        }
    }

    // query
    async exec ( query, params ) {
        const connection = await this._getConnection();

        return connection.exec( query, params );
    }

    async do ( query, params ) {
        const connection = await this._getConnection();

        return connection.do( query, params );
    }

    async select ( query, params ) {
        return this.#select( "select", query, params );
    }

    async selectRow ( query, params ) {
        return this.#select( "selectRow", query, params );
    }

    async read ( query, options ) {
        const primary = query.isReadOnly === false || options?.summaryQuery?.isReadOnly === false;

        const connection = await this._getConnection( false, !primary );

        return connection.read( query, options );
    }

    // protected
    _newConnection ( options ) {
        return new PostgreSqlConnection( this, options );
    }

    // private
    async #select ( method, query, params ) {
        var connection;

        if ( query instanceof Sql && query.id ) {
            if ( query.isReadOnly == null ) {
                connection = await this._getConnection( false, true );

                if ( connection.isPrimary ) {
                    return connection[ method ]( query, params );
                }
                else {
                    let options;

                    if ( params && !Array.isArray( params ) ) {
                        options = {
                            ...params,
                            "_readOnlyTest": true,
                        };
                    }
                    else {
                        options = {
                            params,
                            "_readOnlyTest": true,
                        };
                    }

                    const res = await connection[ method ]( query, options );

                    if ( !res.ok ) {

                        // query is not read-only, repeat on primary
                        if ( res.meta?.code === READ_ONLY_SQL_TRANSACTION ) {
                            query.readOnly( false );

                            return this[ method ]( query, params );
                        }
                        else {
                            return res;
                        }
                    }

                    // query is read-only
                    else {
                        query.readOnly( true );

                        return res;
                    }
                }
            }
            else if ( query.isReadOnly ) {
                connection = await this._getConnection( false, true );
            }
            else {
                connection = await this._getConnection( false, false );
            }
        }
        else {
            connection = await this._getConnection();
        }

        return connection[ method ]( query, params );
    }
}
