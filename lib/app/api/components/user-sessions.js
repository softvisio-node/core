import Component from "#lib/app/api/component";
import sql from "#lib/sql";
import Token from "#lib/app/api/token";
import constants from "#lib/app/constants";
import UserAgent from "#lib/user-agent";

const SQL = {
    "storeHash": sql`INSERT INTO user_session_hash ( user_session_id, fingerprint, hash ) VALUES ( ?, ?, ? )`.prepare(),

    "insertSession": sql`
INSERT INTO user_session (
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

    "deleteCurrentSession": sql`DELETE FROM user_session WHERE id = ?`.prepare(),
    "deleteUserSession": sql`DELETE FROM user_session WHERE id = ? AND user_id = ?`.prepare(),
    "deleteSessions": sql`DELETE FROM user_session WHERE user_id = ? AND id != ?`.prepare(),

    "getUserSessions": sql`
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
    user_session
WHERE
    user_id = ?
`.prepare(),

    "updateSession": sql`
UPDATE user_session SET
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

    // public
    async createUserSession ( userId, { hostname, userAgent, remoteAddress, dbh } = {} ) {
        dbh ||= this.dbh;

        userAgent = new UserAgent( userAgent );

        var res = await dbh.begin( async dbh => {
            const expires = new Date( Date.now() + this.api.config.sessionMaxAge );

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
                userAgent.browserMajor,
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
            const token = Token.generate( this.api, constants.tokenTypeUserSession, id, { "length": this.api.config.userSessionTokenLength } );

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

    async deleteUserSession ( sessionId, { userId, dbh } = {} ) {
        dbh ||= this.dbh;

        var res;

        if ( userId ) {
            res = await dbh.do( SQL.deleteUserSession, [sessionId, userId] );
        }
        else {
            res = await dbh.do( SQL.deleteCurrentSession, [sessionId] );
        }

        if ( !res.ok ) return res;

        if ( !res.meta.rows ) return result( 204 );

        return result( 200 );
    }

    async deleteUserSessions ( userId, { excludeSessionId, dbh } = {} ) {
        dbh ||= this.dbh;

        var res = await dbh.do( SQL.deleteSessions, [userId, excludeSessionId] );

        return res;
    }

    async getUserSessions ( userId, { currentSessionId } ) {
        return this.dbh.select( SQL.getUserSessions, [currentSessionId, userId] );
    }

    async updateSession ( sessionId, remoteAddress, userAgent ) {
        userAgent = new UserAgent( userAgent );

        return this.dbh.do( SQL.updateSession, [

            //
            remoteAddress,
            userAgent.userAgent,
            userAgent.browserName,
            userAgent.browserVersion,
            userAgent.browserMajor,
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
}
