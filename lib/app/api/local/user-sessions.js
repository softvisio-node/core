import sql from "#lib/sql";
import Token from "../auth/token.js";
import constants from "#lib/app/constants";
import UserAgent from "#lib/user-agent";

const QUERIES = {
    "auth": sql`
        SELECT
            "user".id,
            "user".name,
            "user".locale,
            "user".roles,
            "user".gravatar
        FROM
            "user",
            user_session,
            user_session_hash
        WHERE
            "user".id = user_session.user_id
            AND user_session.id = user_session_hash.user_session_id
            AND "user".enabled = TRUE
            AND user_session.expires > CURRENT_TIMESTAMP
            AND user_session.id = ?
            AND user_session_hash.hash = ?
    `.prepare(),

    "storeHash": sql`INSERT INTO user_session_hash ( user_session_id, hash ) VALUES ( ?, ? )`.prepare(),

    "insertSession": sql`
INSERT INTO user_session (
    user_id,
    expires,
    remote_address,
    user_device_id
) VALUES ( ?, ?, ?, ? ) RETURNING id
`.prepare(),

    "deleteDeviceSessions": sql`DELETE FROM user_session USING user_device WHERE user_session.user_device_id = user_device.id AND user_device.guid = ?`.prepare(),
    "deleteCurrentSession": sql`DELETE FROM user_session WHERE id = ?`.prepare(),
    "deleteUserSession": sql`DELETE FROM user_session WHERE id = ? AND user_id = ?`.prepare(),
    "deleteSessions": sql`DELETE FROM user_session WHERE user_id = ? AND id != ?`.prepare(),

    "getUserSessions": sql`
SELECT
    user_session.id,
    user_session.created,
    user_session.last_activity,
    user_session.remote_address,
    user_device.user_agent,
    user_device.browser_name,
    user_device.browser_version,
    user_device.browser_major,
    user_device.engine_name,
    user_device.engine_version,
    user_device.os_name,
    user_device.os_version,
    user_device.device_vendor,
    user_device.device_model,
    user_device.device_type,
    user_device.cpu_architecture,
    CASE
        WHEN id = ? THEN TRUE
        ELSE FALSE
    END AS current_session
FROM
    user_session
    LEFT JOIN user_device ON ( user_session.user_device_id = user_device.id )
WHERE
    user_session.user_id = ?
`.prepare(),

    "upsertDevice": sql`
INSERT INTO user_device SET (
    device_guid,
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
) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? ) ON CONFLICT ( device_guid ) DO UPDATE SET
    remote_address = EXCLUDED.remote_address,
    user_agent = EXCLUDED.user_agent,
    browser_name = EXCLUDED.browser_name,
    browser_version = EXCLUDED.browser_version,
    browser_major = EXCLUDED.browser_major,
    engine_name = EXCLUDED.engine_name,
    engine_version = EXCLUDED.engine_version,
    os_name = EXCLUDED.os_name,
    os_version = EXCLUDED.os_version,
    device_vendor = EXCLUDED.device_vendor,
    device_model = EXCLUDED.device_model,
    device_type = EXCLUDED.device_type,
    cpu_architecture = EXCLUDED.cpu_architecture
RETURNING id
`.prepare(),
};

export default Super =>
    class extends ( Super || Object ) {

        // public
        async createUserSession ( userId, { deviceGuid, userAgent, remoteAddress, dbh } = {} ) {
            dbh ||= this.dbh;

            var res = await dbh.begin( async dbh => {
                let res, deviceId;

                if ( deviceGuid ) {

                    // delete device session
                    res = await dbh.do( QUERIES.deleteDeviceSessions, [deviceGuid] );
                    if ( !res.ok ) throw res;

                    userAgent = new UserAgent( userAgent );

                    // upsert device
                    res = await dbh.selectRow( QUERIES.upsertDevice, [

                        //
                        deviceGuid,
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
                    if ( !res.ok ) throw res;

                    deviceId = res.data.id;
                }

                const expires = new Date( Date.now() + this.app.config.sessionMaxAge );

                // insert session
                res = await dbh.selectRow( QUERIES.insertSession, [

                    //
                    userId,
                    expires,
                    remoteAddress,
                    deviceId,
                ] );

                if ( !res.ok || !res.meta.rows ) throw result( 500 );

                const id = res.data.id;

                // generate token
                const token = Token.generate( constants.tokenTypeUserSession, id );

                // insert hash
                res = await dbh.do( QUERIES.storeHash, [token.id, token.hash] );
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
                res = await dbh.do( QUERIES.deleteUserSession, [sessionId, userId] );
            }
            else {
                res = await dbh.do( QUERIES.deleteCurrentSession, [sessionId] );
            }

            if ( !res.ok ) return res;

            if ( !res.meta.rows ) return result( 204 );

            return result( 200 );
        }

        async deleteUserSessions ( userId, { excludeSessionId, dbh } = {} ) {
            dbh ||= this.dbh;

            var res = await dbh.do( QUERIES.deleteSessions, [userId, excludeSessionId] );

            return res;
        }

        async getUserSessions ( userId, { currentSessionId } ) {
            return this.dbh.select( QUERIES.getUserSessions, [currentSessionId, userId] );
        }

        // protected
        async _authenticateUserSession ( token ) {
            var user = await this.dbh.selectRow( QUERIES.auth, [token.id, token.hash] );

            // user not found or disabled
            if ( !user.data ) return;

            return {
                "userId": user.data.id,
                "username": user.data.name,
                "locale": user.data.locale,
                "roles": this._buildUserRoles( user.data.id, user.data.roles ),
                "gravatar": user.data.gravatar,
            };
        }
    };
