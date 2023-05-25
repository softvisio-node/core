import Component from "#lib/app/component";
import Api from "#lib/app/components/api/api";
import crypto from "node:crypto";

export default class extends Component {

    // public
    addNotificationTypes ( types = {} ) {
        if ( this.isConfigured ) return result( [400, `API component is already configured`] );

        for ( const [name, value] of Object.entries( types ) ) {
            if ( this.config.notifications.types[name] ) {
                return result( [400, `API notification type "${name}" is already exists`] );
            }

            this.config.notifications.types[name] = value;
        }

        return result( 200 );
    }

    addAcl ( acl ) {
        if ( this.isConfigured ) return result( [400, `API component is already configured`] );

        for ( const [name, value] of Object.entries( acl ) ) {
            if ( this.config.acl[name] ) {
                return result( [400, `API acl "${name}" is already exists`] );
            }

            this.config.acl[name] = value;
        }

        return result( 200 );
    }

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

    async _run () {
        return this.value.run();
    }

    async _shutDown () {
        await this.value.shutDown();
    }
}
