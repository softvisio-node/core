import Component from "#lib/app/api/component";
import sql from "#lib/sql";
import Token from "#lib/app/api/token";
import constants from "#lib/app/constants";
import UserAgent from "#lib/user-agent";

const QUERIES = {
    "auth": sql`
        SELECT
            "user".id,
            "user".email,
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

    "getSession": sql`SELECT last_authorized, remote_address, user_agent FROM user_session WHERE id = ?`.prepare(),
};

export default class extends Component {

    // public
    async authenticate ( token ) {
        var user = await this.dbh.selectRow( QUERIES.auth, [token.id, token.hash] );

        // user not found or disabled
        if ( !user.data ) return;

        return {
            "id": user.data.id,
            "email": user.data.email,
            "locale": user.data.locale,
            "roles": this.api.userRoles.buildUserRoles( user.data.id, user.data.roles ),
            "gravatar": user.data.gravatar,
        };
    }

    async createUserSession ( userId, { hostname, userAgent, remoteAddress, dbh } = {} ) {
        dbh ||= this.dbh;

        userAgent = new UserAgent( userAgent );

        var res = await dbh.begin( async dbh => {
            const expires = new Date( Date.now() + this.api.config.sessionMaxAge );

            // insert session
            let res = await dbh.selectRow( QUERIES.insertSession, [

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

    async updateSession ( sessionId, remoteAddress, userAgent ) {
        userAgent = new UserAgent( userAgent );

        return this.dbh.do( QUERIES.updateSession, [

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

    async checkSessionAuthorization ( sessionId, remoteAddress, userAgent ) {
        const session = await this.dbh.selectRow( QUERIES.getSession, [sessionId] );

        if ( !session.ok ) return session;

        // session not found
        if ( !session.data ) return result( -32812 );

        // authorization is expired
        if ( Date.parse( session.data.last_authorized ) + this.api.config.authorizedSessionMaxAge < Date.now() ) return result( -32812 );

        // session signature is invalid
        if ( session.data?.remote_address !== remoteAddress + "" || session.data?.user_agent !== userAgent + "" ) return result( -32812 );

        // session is authorized
        return result( 200 );
    }
}
