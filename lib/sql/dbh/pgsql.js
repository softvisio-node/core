import mixins from "#lib/mixins";
import Dbh from "#lib/sql/dbh";
import Pool from "./pgsql/pool.js";
import PgsqlDbh from "./pgsql/dbh.js";
import { Where as _Where, Query as _Query } from "../query.js";
import { getDefaultPort } from "#lib/utils/net";
import Transactions from "./pgsql/transactions.js";
import Events from "./pgsql/events.js";
import Schema from "./pgsql/schema.js";
import { DEFAULT_TYPES_PGSQL } from "#lib/sql/types";

// NOTE unix socket: pgsql://postgres:1@unix/var/run/postgres.sock:database

const DEFAULT_MAX_CONNECTIONS = 3;
const DEFAULT_MAX_CONNECTIONS_PER_SLAVE = 3;
const DEFAULT_IDLE_TIMEOUT = 60000;

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

export default class DbhPoolPgsql extends mixins( Transactions, Events, Pool, Dbh ) {
    #url;

    #socket;
    #hostname;
    #port;
    #username;
    #password;
    #database;
    #maxConnections;
    #maxConnectionsPerSlave;
    #slaveHostname;
    #idleTimeout;
    #schema = new Schema( this );

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

        this.#slaveHostname = options.slaveHostname || url.searchParams.get( "slaveHostname" );

        // maxConnections
        this.#maxConnections = Number( options.maxConnections || url.searchParams.get( "maxConnections" ) || DEFAULT_MAX_CONNECTIONS );
        if ( isNaN( this.#maxConnections ) || this.#maxConnections < 1 ) this.#maxConnections = DEFAULT_MAX_CONNECTIONS;

        // maxConnectionsPerSlave
        this.#maxConnectionsPerSlave = Number( options.maxConnectionsPerSlave || url.searchParams.get( "maxConnectionsPerSlave" ) || DEFAULT_MAX_CONNECTIONS_PER_SLAVE );
        if ( isNaN( this.#maxConnectionsPerSlave ) ) this.#maxConnections = DEFAULT_MAX_CONNECTIONS_PER_SLAVE;

        // idleTimeout
        this.#idleTimeout = Number( options.idleTimeout || url.searchParams.get( "idleTimeout" ) || DEFAULT_IDLE_TIMEOUT );
        if ( isNaN( this.#idleTimeout ) ) this.#idleTimeout = DEFAULT_IDLE_TIMEOUT;
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

    get maxConnections () {
        return this.#maxConnections;
    }

    get maxConnectionsPerSlave () {
        return this.#maxConnectionsPerSlave;
    }

    get slaveHostname () {
        return this.#slaveHostname;
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

            if ( this.#maxConnections !== DEFAULT_MAX_CONNECTIONS ) url.searchParams.set( "maxConnections", this.#maxConnections );
            if ( this.#idleTimeout !== DEFAULT_IDLE_TIMEOUT ) url.searchParams.set( "idleTimeout", this.#idleTimeout );

            if ( this.#slaveHostname ) {
                url.searchParams.set( "slaveHostname", this.#slaveHostname );

                if ( this.#maxConnectionsPerSlave !== DEFAULT_MAX_CONNECTIONS_PER_SLAVE ) url.searchParams.set( "maxConnectionsPerSlave", this.#maxConnectionsPerSlave );
            }

            url.searchParams.sort();

            this.#url = url.href;
        }

        return this.#url;
    }

    get types () {
        return this.#types;
    }

    get schema () {
        return this.#schema;
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
        if ( param != null && typeof param === "object" && param[Symbol.for( "SQLType" )] ) param = this.#encode[param[Symbol.for( "SQLType" )]]( param );

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
    async addType ( name, options ) {
        return ( await this._getDbh() ).addType( name, options );
    }

    // protected
    _newDbh ( options ) {
        return new PgsqlDbh( this, options );
    }
}
