import Component from "#lib/app/component";
import Users from "./users.js";
import crypto from "node:crypto";

const noGravatarEmail = "no-gravatar@softvisio.net";

export default class extends Component {

    // protected
    async _configure () {
        var defaultGravatar;

        // gravatar email
        if ( this.config.defaultGravatarImage.includes( "@" ) ) {
            const emailHash = crypto.createHash( "MD5" ).update( this.config.defaultGravatarImage.toLowerCase() ).digest( "hex" );

            defaultGravatar = `https://s.gravatar.com/avatar/${emailHash}?d=404`;
        }
        else {
            defaultGravatar = this.config.defaultGravatarImage;
        }

        this.config.defaultGravatarEncoded = encodeURIComponent( defaultGravatar );

        const noGravatarEmailHash = crypto.createHash( "MD5" ).update( noGravatarEmail.toLowerCase() ).digest( "hex" );

        this.config.defaultGravatarUrl = `https://s.gravatar.com/avatar/${noGravatarEmailHash}?d=${this.config.defaultGravatarEncoded}`;

        return result( 200 );
    }

    async _install () {
        return new Users( this.app, this.config );
    }

    async _init () {
        return this.instance.init();
    }
}
