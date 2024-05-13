import Api from "#lib/app/api";
import crypto from "node:crypto";
import fetch from "#lib/fetch";
import File from "#lib/file";
import Interval from "#lib/interval";
import sql from "#lib/sql";
import Mutex from "#lib/threads/mutex";

import Acl from "#lib/app/api/components/acl";
import Users from "#lib/app/api/components/users";
import Sessions from "#lib/app/api/components/sessions";
import Tokens from "#lib/app/api/components/tokens";
import Frontend from "#lib/app/api/frontend";

const defaultAvatarFile = new File( new URL( "resources/default-avatar.png", import.meta.url ) );

const COMPONENTS = {
    "acl": Acl,
    "users": Users,
    "sessions": Sessions,
    "tokens": Tokens,
    "frontend": Frontend,
};

const SQL = {
    "getUserEmail": sql`SELECT email FROM "user" wHERE id = ?`.prepare(),
};

export default class AppApi extends Api {
    #dbh;
    #avatarMaxAgeInterval;
    #avatarCacheControl;
    #mutexSet = new Mutex.Set();

    constructor ( app, config ) {
        super( app, config, COMPONENTS );

        this.#dbh = app.dbh;
    }

    // properties
    get isApi () {
        return true;
    }

    get dbh () {
        return this.#dbh;
    }

    get isConnected () {
        return this.dbh.isConnected;
    }

    get httpServer () {
        return this.app.publicHttpServer;
    }

    get avatarMaxAgeInterval () {
        this.#avatarMaxAgeInterval ??= Interval.new( this.config.avatarMaxAge );

        return this.#avatarMaxAgeInterval;
    }

    get avatarCacheControl () {
        this.#avatarCacheControl ??= "public, max-age=" + this.avatarMaxAgeInterval.toSeconds();

        return this.#avatarCacheControl;
    }

    // public
    async waitConnect ( signal ) {
        return this.dbh.waitConnect( signal );
    }

    async downloadDefaultAvatar ( req ) {
        return req.end( {
            "status": 200,
            "headers": {
                "cache-control": this.avatarCacheControl,
            },
            "body": defaultAvatarFile,
        } );
    }

    // protected
    async _init () {
        var res;

        // migrate database
        res = await this.dbh.schema.migrate( new URL( "db", import.meta.url ) );
        if ( !res.ok ) return res;

        this.httpServer.get( this.config.avatarUrl + "*", this.#downloadAvatar.bind( this ) );

        return result( 200 );
    }

    // private
    async #downloadAvatar ( req ) {
        const userId = req.path.substring( this.config.avatarUrl.length );

        // default avatar
        if ( !userId ) return this.downloadDefaultAvatar( req );

        try {
            BigInt( userId );
        }
        catch ( e ) {
            return req.end( 404 );
        }

        var res, email;

        const user = await this.app.users.getCachedUserById( userId );

        if ( user ) {
            email = user.email;
        }
        else {
            const mutex = this.#mutexSet.get( "avatar/" + userId );

            if ( mutex.tryLock() ) {
                res = await this.dbh.selectRow( SQL.getUserEmail, [ userId ] );

                mutex.unlock( res );
            }
            else {
                res = await mutex.wait();
            }

            if ( !res.ok ) return req.end( res );

            email = res.data.email;
        }

        if ( !email ) return req.end( 404 );

        if ( this.app.emailIsLocal( email ) ) return this.downloadDefaultAvatar( req );

        // force return default avataer
        if ( this.config.forceDefaultAvatar && !this.config.defaultGravatar ) {
            return this.downloadDefaultAvatar( req );
        }

        const emailHash = crypto.createHash( "MD5" ).update( email.toLowerCase() ).digest( "hex" );

        var gravatarUrl = `https://www.gravatar.com/avatar/${ emailHash }`;

        // default gravatar
        if ( this.config.defaultGravatar ) {
            gravatarUrl += "?d=" + this.config.defaultGravatar;

            // force default gravatar
            if ( this.config.forceDefaultAvatar ) {
                gravatarUrl += "&f=y";
            }
        }
        else {
            gravatarUrl += "?d=404";
        }

        res = await fetch( gravatarUrl, {
            "headers": {
                "if-modified-since": req.headers.get( "if-modified-since" ) ?? "",
            },
        } );

        // not modified
        if ( res.status === 304 ) {
            return req.end( {
                "status": 304,
                "headers": {
                    "cache-control": this.avatarCacheControl,
                    "last-modified": res.headers.get( "last-modified" ),
                },
                "body": res.body,
            } );
        }

        // return default avatar
        else if ( !res.ok ) {
            return this.downloadDefaultAvatar( req );
        }

        // return user avatar
        else {
            return req.end( {
                "status": 200,
                "headers": {
                    "cache-control": this.avatarCacheControl,
                    "last-modified": res.headers.get( "last-modified" ),
                    "content-length": res.headers.get( "content-length" ),
                    "content-type": res.headers.get( "content-type" ),
                },
                "body": res.body,
            } );
        }
    }
}
