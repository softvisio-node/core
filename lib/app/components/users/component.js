import Component from "#lib/app/component";
import Users from "./users.js";
import crypto from "node:crypto";
import File from "#lib/file";

const defaultAvatarFile = new File( new URL( "resources/default-avatar.png", import.meta.url ) );

export default class extends Component {
    #defaultAvatarUrl;
    #defaultGravatarParam;

    // properties
    get defaultAvatarUrl () {
        return this.#defaultAvatarUrl;
    }

    get defaultGravatarParam () {
        return this.#defaultGravatarParam;
    }

    // protected
    // XXX
    async _configure () {
        var defaultGravatar;

        this.config.defaultGravatarImage ||= "/storage/default-avatar";

        // gravatar email
        if ( this.config.defaultGravatarImage.includes( "@" ) ) {
            const emailHash = crypto.createHash( "MD5" ).update( this.config.defaultGravatarImage.toLowerCase() ).digest( "hex" );

            defaultGravatar = `https://s.gravatar.com/avatar/${emailHash}?d=404`;

            this.#defaultAvatarUrl = defaultGravatar;
        }

        // url
        else if ( this.config.defaultGravatarImage.startsWith( "http" ) ) {
            defaultGravatar = this.config.defaultGravatarImage;

            this.#defaultAvatarUrl = defaultGravatar;
        }

        // pre-defined param
        else {
            defaultGravatar = this.config.defaultGravatarImage;

            this.#defaultAvatarUrl = `https://s.gravatar.com/avatar?d=${defaultGravatar}`;
        }

        this.#defaultGravatarParam = encodeURIComponent( defaultGravatar );

        return result( 200 );
    }

    async _install () {
        return new Users( this.app, this.config );
    }

    async _init () {

        // default avatar http handler
        this.app.publicHttpServer?.get( "/storage/default-avatar", async req =>
            req.end( {
                "status": 200,
                "headers": {
                    "cache-control": this.config.avatarCacheControl,
                },
                "body": defaultAvatarFile,
            } ) );

        return this.instance.init();
    }
}
