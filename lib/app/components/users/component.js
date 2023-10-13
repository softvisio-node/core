import Component from "#lib/app/component";
import Users from "./users.js";
import crypto from "node:crypto";

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
    async _configure () {
        var defaultGravatar;

        if ( !this.config.defaultGravatarImage ) {
            defaultGravatar = this.config.defaultGravatarImage = "/storage/gefault-avatar";

            this.#defaultAvatarUrl = defaultGravatar;
        }

        // gravatar email
        else if ( this.config.defaultGravatarImage.includes( "@" ) ) {
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
        return this.instance.init();
    }
}
