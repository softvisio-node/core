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
        }
        else {
            defaultGravatar = this.config.defaultGravatarImage;
        }

        this.config.defaultGravatarParam = encodeURIComponent( defaultGravatar );

        this.config.defaultGravatarUrl = `https://s.gravatar.com/avatar?d=${this.config.defaultGravatarParam}`;

        return result( 200 );
    }

    async _install () {
        return new Users( this.app, this.config );
    }

    async _init () {
        return this.instance.init();
    }
}
