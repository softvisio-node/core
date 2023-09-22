import Component from "#lib/app/component";
import Users from "./users.js";
import crypto from "node:crypto";

export default class extends Component {

    // protected
    async _configure () {
        var defaultGravatar;

        // gravatar email
        if ( this.config.defaultGravatarImage.includes( "@" ) ) {
            const emailHash = crypto.createHash( "MD5" ).update( this.config.defaultGravatarImage.toLowerCase() ).digest( "hex" );

            defaultGravatar = `https://s.gravatar.com/avatar/${emailHash}?d=404`;

            this.config.defaultGravatarUrl = defaultGravatar;
        }

        // url
        else if ( this.config.defaultGravatarImage.startsWith( "http" ) ) {
            defaultGravatar = this.config.defaultGravatarImage;

            this.config.defaultGravatarUrl = defaultGravatar;
        }

        // pre-defined param
        else {
            defaultGravatar = this.config.defaultGravatarImage;

            this.config.defaultGravatarUrl = `https://s.gravatar.com/avatar?d=${defaultGravatar}`;
        }

        this.config.defaultGravatarParam = encodeURIComponent( defaultGravatar );

        return result( 200 );
    }

    async _install () {
        return new Users( this.app, this.config );
    }

    async _init () {
        return this.instance.init();
    }
}
