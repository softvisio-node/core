import mixins from "#lib/mixins";
import Dbh from "#lib/sql/dbh";
import Pool from "./pgsql/pool.js";
import PgsqlConnection from "./pgsql/connection.js";
import { Sql, Where as _Where, Query as _Query } from "#lib/sql/query";
import { getDefaultPort } from "#lib/utils/net";
import Transactions from "./pgsql/transactions.js";
import Main from "./pgsql/main.js";
import Schema from "./pgsql/schema.js";
import { PGSQL_DECODERS } from "#lib/sql/types";
import * as errors from "#lib/sql/dbh/pgsql/errors";

// NOTE unix socket: pgsql://postgres:1@unix/var/run/postgres.sock:database

const DEFAULT_APP_NAME = "core";
const DEFAULT_MAX_CONNECTIONS = 10;
const DEFAULT_MAX_CONNECTIONS_PER_STANDBY = 3;
const DEFAULT_IDLE_TIMEOUT = 60_000; // 1 minute

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

export default class DbhPoolPgsql extends mixins( Transactions, Main, Pool, Dbh ) {
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
    #standbyHostname;
    #standbyPort;
    #idleTimeout;
    #schema = new Schema( this );

    #decode = { ...PGSQL_DECODERS };

    constructor ( url, options = {} ) {
        super();

        url = new URL( url );

        this.#appName = options.appName || url.searchParams.get( "appName" ) || DEFAULT_APP_NAME;

        this.#protocol = url.protocol;
        this.#hostname = url.hostname;

        if ( url.hostname === "unix" ) {
            const idx = url.pathname.indexOf( ":" );

            if ( idx < 0 ) {
                this.#socket = url.pathname;
                this.#database = "";
            }
            else {
                this.#socket = url.pathname.substring( 0, idx );

                this.#database = options.database ?? url.pathname.substring( idx + 1 );
                if ( this.#database.startsWith( "/" ) ) this.#database = this.#database.substring( 1 );
            }
        }
        else {
            this.#port = +url.port || getDefaultPort( "pgsql:" );
            this.#database = options.database ?? url.pathname.substring( 1 );
        }

        this.#username = options.username ?? decodeURIComponent( url.username );
        this.#password = options.password ?? decodeURIComponent( url.password );

        this.#standbyHostname = options.standbyHostname || url.searchParams.get( "standbyHostname" );
        if ( this.#standbyHostname ) {
            if ( this.#standbyHostname.includes( ":" ) ) {
                [this.#standbyHostname, this.#standbyPort] = this.#standbyHostname.split( ":" );

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

    get isPgsql () {
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

    get standbyHostname () {
        return this.#standbyHostname;
    }

    get standbyPort () {
        return this.#standbyPort;
    }

    get idleTimeout () {
        return this.#idleTimeout;
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

            if ( this.#appName !== DEFAULT_APP_NAME ) url.searchParams.set( "appName", this.#appName );

            if ( this.#maxConnections !== DEFAULT_MAX_CONNECTIONS ) url.searchParams.set( "maxConnections", this.#maxConnections );
            if ( this.#idleTimeout !== DEFAULT_IDLE_TIMEOUT ) url.searchParams.set( "idleTimeout", this.#idleTimeout );

            if ( this.#standbyHostname ) {
                if ( this.#standbyPort !== this.#port ) {
                    url.searchParams.set( "standbyHostname", this.#standbyHostname + ":" + this.#standbyPort );
                }
                else {
                    url.searchParams.set( "standbyHostname", this.#standbyHostname );
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

    get errors () {
        return errors;
    }

    // public
    async start () {
        return this.schema.cron.start();
    }

    async stop () {
        return this.schema.cron.stop();
    }

    async shutDown () {
        return this.schema.cron.shutDown();
    }

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

    // query
    async exec ( query, params ) {
        return ( await this._getConnection() ).exec( query, params );
    }

    async do ( query, params ) {
        return ( await this._getConnection() ).do( query, params );
    }

    // XXX
    async select ( query, params ) {
        var connection;

        if ( query instanceof Sql && query.id ) {
            if ( query.isReadOnly == null ) {
                connection = await this._getConnection( false, true );

                if ( connection.isPrimary ) {
                    return connection.select( query, params );
                }
                else {
                    const res = await connection.select( query, params, { "readOnlyTest": true } );

                    if ( !res.ok ) {
                        if ( res.meta?.code === 25006 ) {
                            query.readOnly( false );

                            return this.select( query, params );
                        }
                        else {
                            return res;
                        }
                    }
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

        return connection.select( query, params );
    }

    // XXX
    async selectRow ( query, params ) {
        return ( await this._getConnection() ).selectRow( query, params );
    }

    async read ( query, options ) {
        const connection = await this._getConnection( false, true );

        return connection.read( query, options );
    }

    // protected
    _newConnection ( options ) {
        return new PgsqlConnection( this, options );
    }
}
