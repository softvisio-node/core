import Component from "#lib/app/api/component";

const LOAD_QUERY = `INSERT INTO api_call_load ( method_id, user_id, started, is_declined ) VALUES `;
const LOAD_ROW_TEMPLATE = `( ?, ?, ?, ? )`;

const FINISHED_QUERY = `INSERT INTO api_call_log ( method_id, user_id, started, finished, runtime, is_error, is_exception, status, status_text ) VALUES `;
const FINISHED_ROW_TEMPLATE = `( ?, ?, ?, ?, ?, ?, ?, ?, ? )`;

export default class extends Component {
    #loadCache = [];
    #requestsCache = [];
    #stat = {};

    #userTokenLastActivity = new Map();
    #userSessionLastActivity = new Map();

    // properties
    get stat () {
        return this.#stat;
    }

    // public
    logApiCallLoad ( data ) {
        const row = [

            //
            data.methodId,
            data.userId,
            data.started.toISOString(),
            data.isDeclined,
        ];

        this.#loadCache.push( row );
    }

    logApiCall ( data ) {
        const row = [

            //
            data.methodId,
            data.userId,
            data.started.toISOString(),
            data.finished.toISOString(),
            data.runtime,
            data.isError,
            data.isException,
            data.status,
            data.statusText,
        ];

        this.#requestsCache.push( row );
    }

    updateTokenLastActivity ( token ) {
        if ( !token.id ) return;

        const lastActivity = new Date();

        if ( token.isUserToken ) {
            this.#userTokenLastActivity.set( token.id, `UPDATE user_token SET last_activity = '${lastActivity.toISOString()}' WHERE id = ${token.id};` );
        }
        else if ( token.isUserSessionToken ) {
            const expires = new Date( Date.now() + this.api.config.sessionMaxAge );

            this.#userSessionLastActivity.set( token.id, `UPDATE user_session SET last_activity = '${lastActivity.toISOString()}', expires = '${expires.toISOString()}' WHERE id = ${token.id};` );
        }
    }

    // protected
    async _init () {
        setInterval( () => this.#dropApiCallLogCache(), this.api.config.apiCallLogCacheDropInterval );

        setInterval( this.#dropLastUsedStats.bind( this ), this.api.config.lastActivityCacheDropInterval );

        return result( 200 );
    }

    // private
    async #dropApiCallLogCache () {

        // log accepted requests
        if ( this.#loadCache.length ) {
            let query = LOAD_QUERY,
                separator = "";

            const params = [];

            for ( const row of this.#loadCache ) {
                params.push( ...row );

                query += separator + LOAD_ROW_TEMPLATE;

                separator = ", ";
            }

            this.#loadCache = [];

            await this.dbh.do( query, params );
        }

        // log finished requests
        if ( this.#requestsCache.length ) {
            let query = FINISHED_QUERY,
                separator = "";

            const params = [];

            for ( const row of this.#requestsCache ) {
                params.push( ...row );

                query += separator + FINISHED_ROW_TEMPLATE;

                separator = ", ";
            }

            this.#requestsCache = [];

            await this.dbh.do( query, params );
        }
    }

    async #dropLastUsedStats () {
        const sql = [];

        if ( this.#userTokenLastActivity.size ) {
            sql.push( ...this.#userTokenLastActivity.values() );
            this.#userTokenLastActivity.clear();
        }

        if ( this.#userSessionLastActivity.size ) {
            sql.push( ...this.#userSessionLastActivity.values() );
            this.#userSessionLastActivity.clear();
        }

        if ( !sql.length ) return;

        this.dbh.exec( sql.join( " " ) );
    }
}
