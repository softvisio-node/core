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
    logDeclinedApiCall ( user, method ) {
        const row = [

            //
            method.id,
            user.id,
            new Date().toISOString(),
            true,
        ];

        this.#loadCache.push( row );
    }

    logApiCallStart ( user, method ) {
        const row = [

            //
            method.id,
            user.id,
            new Date(),
            false,
        ];

        this.#loadCache.push( row );

        return row;
    }

    logApiCallFinish ( logDescriptor, res ) {
        const finished = new Date();

        const row = [

            //
            logDescriptor[0], // method id
            logDescriptor[1], // user id
            logDescriptor[2], // started
            finished, // finished
            finished - logDescriptor[2], // duration
            !res.ok, // is error
            res.exception, // is exception
            res.status, // status
            res.statusText, // status text
        ];

        this.#requestsCache.push( row );
    }

    logTokenLastActivity ( token ) {
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
