import Component from "#lib/app/api/component";
import sql from "#lib/sql";
import Token from "#lib/app/token";
import constants from "#lib/app/constants";
import UserAgent from "#lib/user-agent";
import Cache from "./sessions/cache.js";
import Duration from "#lib/duration";

const SQL = {
    "storeHash": sql`INSERT INTO api_session_hash ( api_session_id, fingerprint, hash ) VALUES ( ?, ?, ? )`.prepare(),

    "insertSession": sql`
INSERT INTO api_session (
    user_id,
    expires,
    hostname,
    remote_address,
    user_agent,
    browser_name,
    browser_version,
    browser_major,
    engine_name,
    engine_version,
    os_name,
    os_version,
    device_vendor,
    device_model,
    device_type,
    cpu_architecture
) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? ) RETURNING id
`.prepare(),

    "deleteCurrentSession": sql`DELETE FROM api_session WHERE id = ?`.prepare(),

    "deleteSession": sql`DELETE FROM api_session WHERE id = ? AND user_id = ?`.prepare(),

    "deleteSessions": sql`DELETE FROM api_session WHERE user_id = ? AND id != ?`.prepare(),

    "getSessions": sql`
SELECT
    id,
    created,
    last_activity,
    remote_address,
    user_agent,
    browser_name,
    browser_version,
    browser_major,
    engine_name,
    engine_version,
    os_name,
    os_version,
    device_vendor,
    device_model,
    device_type,
    cpu_architecture,
    CASE
        WHEN id = ? THEN TRUE
        ELSE FALSE
    END AS current_session
FROM
    api_session
WHERE
    user_id = ?
`.prepare(),

    "updateSession": sql`
UPDATE api_session SET
    last_authorized = CURRENT_TIMESTAMP,
    remote_address = ?,
    user_agent = ?,
    browser_name = ?,
    browser_version = ?,
    browser_major = ?,
    engine_name = ?,
    engine_version = ?,
    os_name = ?,
    os_version = ?,
    device_vendor = ?,
    device_model = ?,
    device_type = ?,
    cpu_architecture = ?
WHERE
    id = ?
`.prepare(),
};

export default class extends Component {
    #cache;
    #sessionMxaxAge;

    // properties
    get cache () {
        return this.#cache;
    }

    // public
    async createSession ( userId, { hostname, userAgent, remoteAddress, dbh } = {} ) {
        dbh ||= this.dbh;

        userAgent = new UserAgent( userAgent );

        this.#sessionMxaxAge = new Duration( this.api.config.sessionMaxAge );

        var res = await dbh.begin( async dbh => {
            const expires = this.#sessionMxaxAge.toDate();

            // insert session
            let res = await dbh.selectRow( SQL.insertSession, [

                //
                userId,
                expires,
                hostname,
                remoteAddress,
                userAgent.userAgent,
                userAgent.browserName,
                userAgent.browserVersion,
                userAgent.browserMajorVersion,
                userAgent.engineName,
                userAgent.engineVersion,
                userAgent.osName,
                userAgent.osVersion,
                userAgent.deviceVendor,
                userAgent.deviceModel,
                userAgent.deviceType,
                userAgent.cpuArchitecture,
            ] );

            if ( !res.ok || !res.meta.rows ) throw result( 500 );

            const id = res.data.id;

            // generate token
            const token = Token.generate( this.app, constants.sessionToken.id, id, { "length": constants.sessionToken.length } );

            // insert hash
            res = await dbh.do( SQL.storeHash, [token.id, token.fingerprint, await token.getHash()] );
            if ( !res.ok || !res.meta.rows ) throw result( 500 );

            return result( 200, {
                "token": token.token,
                remoteAddress,
                userAgent,
            } );
        } );

        return res;
    }

    async deleteSession ( sessionId, { userId, dbh } = {} ) {
        dbh ||= this.dbh;

        var res;

        if ( userId ) {
            res = await dbh.do( SQL.deleteSession, [sessionId, userId] );
        }
        else {
            res = await dbh.do( SQL.deleteCurrentSession, [sessionId] );
        }

        if ( !res.ok ) return res;

        if ( !res.meta.rows ) return result( 204 );

        return result( 200 );
    }

    async deleteSessions ( userId, { excludeSessionId, dbh } = {} ) {
        dbh ||= this.dbh;

        var res = await dbh.do( SQL.deleteSessions, [userId, excludeSessionId] );

        return res;
    }

    async getSessions ( userId, { currentSessionId } ) {
        return this.dbh.select( SQL.getSessions, [currentSessionId, userId] );
    }

    async updateSession ( sessionId, remoteAddress, userAgent ) {
        userAgent = new UserAgent( userAgent );

        return this.dbh.do( SQL.updateSession, [

            //
            remoteAddress,
            userAgent.userAgent,
            userAgent.browserName,
            userAgent.browserVersion,
            userAgent.browserMajorVersion,
            userAgent.engineName,
            userAgent.engineVersion,
            userAgent.osName,
            userAgent.osVersion,
            userAgent.deviceVendor,
            userAgent.deviceModel,
            userAgent.deviceType,
            userAgent.cpuArchitecture,
            sessionId,
        ] );
    }

    // protected
    async _init () {
        this.#cache = new Cache( this.api, this.api.config.sessionsCacheMaxSize );

        await this.#cache.init();

        return result( 200 );
    }
}
