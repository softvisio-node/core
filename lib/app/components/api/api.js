import Api from "#lib/app/api";
import constants from "#lib/app/constants";
import crypto from "node:crypto";
import fetch from "#lib/fetch";
import File from "#lib/file";
import Duration from "#lib/duration";

import Acl from "#lib/app/api/components/acl";
import Users from "#lib/app/api/components/users";
import Sessions from "#lib/app/api/components/sessions";
import Tokens from "#lib/app/api/components/tokens";
import Frontend from "#lib/app/api/frontend";

const avatarLocation = "/api/avatar",
    defaultAvatarFile = new File( new URL( "resources/default-avatar.png", import.meta.url ) );

const COMPONENTS = {
    "acl": Acl,
    "users": Users,
    "sessions": Sessions,
    "tokens": Tokens,
    "frontend": Frontend,
};

export default class AppApi extends Api {
    #dbh;
    #avatarCacheControl;

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

    get avatarUrl () {
        return avatarLocation;
    }

    get avatarCacheControl () {
        this.#avatarCacheControl ??= "public, max-age=" + new Duration( this.config.avatarMaxAge ).toSeconds();

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

        this.httpServer.get( avatarLocation, this.#downloadAvatar.bind( this ) );

        return result( 200 );
    }

    async _afterInit () {
        var res;

        // init root user
        res = await this.#initRootUser();
        if ( !res.ok ) return res;

        return result( 200 );
    }

    // private
    async #initRootUser () {
        var res;

        const rootPassword = this.config.root.password;

        res = await this.users.createUser(
            this.config.root.email,
            {
                "password": rootPassword,
            },
            { "root": true }
        );

        // root user created
        if ( res.ok ) {
            if ( rootPassword ) {
                console.log( `Root user password was setted from the configuration` );
            }
            else {
                console.log( `Root user password was setted to: ${res.data.password}` );
            }
        }

        // reset root user
        if ( process.cli?.command === "/reset-root-password" ) {
            let exitCode;

            if ( res.ok ) {
                exitCode = 0;
            }

            // error
            else if ( res.status !== 409 ) {
                console.log( `Error creating root user:`, res + "" );

                exitCode = 1;
            }

            // root user already exists
            else {

                // set root user password
                res = await this.users.setUserPassword( constants.rootUserId, rootPassword );

                if ( res.ok ) {
                    if ( rootPassword ) {
                        console.log( `Root user password was setted from the configuration` );
                    }
                    else {
                        console.log( `Root user password was setted to: ${res.data.password}` );
                    }

                    exitCode = 0;
                }
                else {
                    console.log( `Error set root user passworrd: ` + res );

                    exitCode = 1;
                }
            }

            process.shutDown( { "code": exitCode } );
        }

        if ( res.ok || res.status === 409 ) {
            return result( 200 );
        }
        else {
            return res;
        }
    }

    async #downloadAvatar ( req ) {
        const userId = req.url.searchParams.get( "id" );

        // default avatar
        if ( !userId ) return this.downloadDefaultAvatar( req );

        try {
            BigInt( userId );
        }
        catch ( e ) {
            return req.end( 404 );
        }

        const user = await this.app.users.getUserById( userId );

        if ( !user ) return req.end( 404 );

        // force return default avataer
        if ( this.config.forceDefaultAvatar && !this.config.defaultGravatar ) {
            return this.downloadDefaultAvatar( req );
        }

        const emailHash = crypto.createHash( "MD5" ).update( user.email.toLowerCase() ).digest( "hex" );

        var gravatarUrl = `https://www.gravatar.com/avatar/${emailHash}`;

        // default gravatar
        if ( this.config.defaultGravatar ) {
            gravatarUrl += "?d=" + this.config.defaultGravatar;
        }
        else {
            gravatarUrl += "?d=404";
        }

        // force default gravatar
        if ( this.config.forceDefaultAvatar ) {
            gravatarUrl += "&f=y";
        }

        const res = await fetch( gravatarUrl );

        // return default avatar
        if ( !res.ok ) {
            return this.downloadDefaultAvatar( req );
        }

        // return user avatar
        else {
            return req.end( {
                "status": 200,
                "headers": {
                    "cache-control": this.avatarCacheControl,
                    "last-modified": res.headers.get( "last-modified" ),
                },
                "body": res.body,
            } );
        }
    }
}
