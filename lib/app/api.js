import mixins from "#lib/mixins";
import Doc from "#lib/doc";
import CONST from "#lib/const";
import Auth from "./auth.js";
import Token from "./token.js";
import crypto from "crypto";
import AuthCache from "./api/auth-cache.js";
import _url from "url";

import LocalMixin from "./api/local.js";
import HealthCheckMixin from "./api/mixins/health-check.js";
import ConnectionMixin from "./api/mixins/connection.js";

export default class API extends mixins( LocalMixin, HealthCheckMixin, ConnectionMixin ) {
    usernameIsEmail = true;
    newUserEnabled = true;
    defaultGravatarEmail = "noname@softvisio.net"; // used, if user email is not set
    defaultGravatarImage = "identicon"; // url encoded url, 404, mp, identicon, monsterid, wavatar, retro, robohash, blank

    defaultGravatarUrl;

    #app;
    #methods = {};
    #logMethods;
    #stat = {};

    #authCache;

    static async new ( app, backend, options = {} ) {
        const api = new this( app, backend, options );

        // init api
        const res = await api._init( options );

        if ( !res.ok ) {
            console.log( "TERMINATED" );

            return;
        }

        return api;
    }

    constructor ( app, backend, options = {} ) {
        super( backend );

        if ( typeof options.usernameIsEmail === "boolean" ) this.usernameIsEmail = options.usernameIsEmail;
        if ( typeof options.newUserEnabled === "boolean" ) this.newUserEnabled = options.newUserEnabled;
        if ( options.defaultGravatarEmail ) this.defaultGravatarEmail = options.defaultGravatarEmail;
        if ( options.defaultGravatarImage ) this.defaultGravatarImage = options.defaultGravatarImage;

        this.defaultGravatarUrl = `https://s.gravatar.com/avatar/${crypto.createHash( "MD5" ).update( this.defaultGravatarEmail.toLowerCase() ).digest( "hex" )}?d=${this.defaultGravatarImage}`;

        this.#app = app;
    }

    // INIT
    async _init ( options = {} ) {
        var res;

        if ( super._init ) {
            res = await super._init( options );
            if ( !res.ok ) return res;
        }

        // init methods
        process.stdout.write( "Loading methods ... " );
        if ( options.methods ) res = await this.#loadMethods( options.methods );
        console.log( res + "" );
        if ( !res.ok ) return res;

        // init auth cache
        this.#authCache = new AuthCache( this, 10000 );
        await this.dbh.on( "event/api/auth-cache/invalidate/user", userId => this.#authCache.invalidateUser( userId ) );
        await this.dbh.on( "event/api/auth-cache/invalidate/user-token", tokenId => this.#authCache.invalidateUserToken( tokenId ) );
        this.dbh.on( "disconnect", () => this.#authCache.invalidateAll() );

        return result( 200 );
    }

    // PRORS
    get app () {
        return this.#app;
    }

    get stat () {
        return this.#stat;
    }

    // METHODS
    // XXX pat url to doc
    async #loadMethods ( url ) {
        const path = _url.fileURLToPath( url ),
            doc = new Doc( path ),
            schema = await doc.getApiSchema( "" ),
            objects = {};

        for ( const methodId in schema ) {

            // validate permissions
            const res = this.validateApiPermissions( schema[methodId].permissions );

            // permissions are invalid
            if ( !res.ok ) return res;

            const objectId = _url.pathToFileURL( path + "/" + schema[methodId].apiClass + ".js" ).href;

            if ( !objects[objectId] ) {
                const Class = ( await import( objectId ) ).default;

                objects[objectId] = new Class( this );
            }

            schema[methodId].object = objects[objectId];
        }

        this.#methods = schema;

        return result( 200 );
    }

    getMethod ( id ) {
        return this.#methods[id];
    }

    findMethod ( id ) {
        const params = [];

        if ( this.#methods[id] ) return [id, params];

        while ( 1 ) {
            const id1 = id.replace( /_/g, "-" );

            if ( this.#methods[id1] ) return [id1, params];

            const idx = id.lastIndexOf( "/" );

            if ( idx === -1 ) return [null, params];

            params.unshift( id.substr( idx + 1 ) );

            id = id.substr( 0, idx );
        }
    }

    getLogMethods () {
        if ( !this.#logMethods ) {
            this.#logMethods = {};

            for ( const methodId of Object.keys( this.#methods ).sort() ) {
                if ( this.#methods[methodId].logApiCalls ) this.#logMethods[methodId] = this.#methods[methodId];
            }
        }

        return this.#logMethods;
    }

    // AUTHENTICATION
    async authenticate ( token ) {

        // no token provided
        if ( !token ) return new Auth( this );

        // parse token
        token = Token.new( token );

        // token parsing error
        if ( !token ) return new Auth( this );

        // get auth from cache by token id or user name
        // do not use cache if cluster is initialized but no connected
        const auth = this.#authCache.get( token );

        if ( auth ) {
            if ( auth.compareToken( token ) ) {
                return auth;
            }

            // token is exists in cache, but don't match private token
            else {
                return new Auth( this, token );
            }
        }

        var data = await super.authenticate( token );

        // authenticated
        if ( data ) {
            const auth = new Auth( this, token, data );

            // put to cache, if cluster is ready to use
            this.#authCache.set( token, auth );

            return auth;
        }

        // not authenticated
        else {
            return new Auth( this, token );
        }
    }

    // VALIDATORS
    userIsRoot ( userId ) {
        return userId + "" === CONST.ROOT_USER_ID || userId === CONST.ROOT_USER_NAME;
    }

    validatePassword ( password ) {
        if ( password.length < 1 ) return result( [400, "Password must contain at least 1 character"] );

        return result( 200 );
    }

    // accepted characters: A-z (case-insensitive), 0-9, "_", "-", "@", ".", length: 3-32 characters, not number, not UUID
    validateUsername ( username ) {

        // check length
        if ( username.length < 3 || username.length > 32 ) return result( [400, "User name length must be between 3 and 32 characters"] );

        // contains forbidden chars
        if ( /[^a-z\d_@.-]/i.test( username ) ) return result( [400, `User name must contain letters, digits, "_", "@", ".", "-" characters only`] );

        // number
        if ( !isNaN( username ) ) return result( [400, "User name should not be a number"] );

        // looks like uuid
        if ( /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test( username ) ) return result( [400, "User name should not look like UUID"] );

        return result( 200 );
    }

    // accepted characters: A-z (case-insensitive), 0-9 and underscores, length: 5-255 characters
    validateTelegramUsername ( username ) {

        // check length
        if ( username.length < 5 || username.length > 255 ) return result( [400, "Telegram user name length must be between 5 and 32 characters"] );

        // contains forbidden chars
        if ( /[^a-z\d_]/i.test( username ) ) return result( [400, `Telegram user name must contain letters, digits and "_" only`] );

        return result( 200 );
    }

    validateEmail ( email ) {
        if ( !/^[a-z\d][a-z\d._-]*[a-z\d]@(?:[a-z\d][a-z\d-]*.)+[a-z\d][a-z\d-]*[a-z\d]$/i.test( email ) ) return result( [400, "Email is invalid"] );

        return result( 200 );
    }
}
