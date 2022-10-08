import Component from "#lib/app/component";
import Api from "#lib/app/api";
import crypto from "node:crypto";

export default class extends Component {

    // protected
    async _configure () {
        var defaultGravatar;

        // gravatar email
        if ( this.config.defaultGravatarImage.includes( "@" ) ) {
            defaultGravatar = `https://s.gravatar.com/avatar/${crypto.createHash( "MD5" ).update( this.config.defaultGravatarImage.toLowerCase() ).digest( "hex" )}?d=404`;
        }
        else {
            defaultGravatar = this.config.defaultGravatarImage;
        }

        this.config.defaultGravatarEncoded = encodeURIComponent( defaultGravatar );

        return result( 200 );
    }

    async _install () {
        return new Api( this.app, this.config );
    }

    async _init () {
        return this.value.init();
    }
}
