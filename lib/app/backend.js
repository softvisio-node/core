const { Auth } = require( "./auth" );
const crypto = require( "crypto" );
const { AUTH_HASH, TOKEN_TYPE_PASSWORD } = require( "../const" );
const { isPlainObject, bytesToUuid, fromBase64u } = require( "../util" );

module.exports = class {
    app;

    constructor ( app ) {
        this.app = app;
    }

    async authenticate ( token ) {
        // no token provided
        if ( token == null ) return new Auth( this.app );

        var privateToken;

        // already private token
        if ( isPlainObject( token ) ) {
            privateToken = token;
        }

        // authenticate user / password
        else if ( Array.isArray( token ) ) {
            // token is user / password
            // lowercase user name
            token[0] = token[0].toLowerCase();

            // generate private token hash
            privateToken = {
                "type": TOKEN_TYPE_PASSWORD,
                "id": token[0],
                "hash": this._getHash( token[1] + token[0] ),
            };
        }

        // authenticate token
        else {
            privateToken = this._unpackToken( token );
        }

        return this.authenticatePrivate( privateToken );
    }

    // TODO
    async authenticatePrivate ( privateToken ) {
        // console.log( await this.app.threads.call( "argon2", "hash", "test" ) );

        var auth = await this.doAuthenticatePrivate( privateToken );

        return auth;
    }

    _unpackToken ( token ) {
        var buf = fromBase64u( token );

        return {
            "type": buf[16],
            "id": bytesToUuid( buf ),
            "hash": this._getHash( buf ),
        };
    }

    _getHash ( buffer ) {
        return crypto.createHash( AUTH_HASH ).update( buffer ).digest( "base64" );
    }
};
