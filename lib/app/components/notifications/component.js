import Component from "#lib/app/component";
import Notifications from "./notifications.js";

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

    // protected
    async _install () {
        return new Notifications( this.app, this.config );
    }

    async _configureInstance () {
        return this.instance.configure();
    }

    async _init () {
        return this.instance.init();
    }

    async _start () {
        return this.instance.start();
    }

    async _shutDown () {
        return this.instance.shutDown();
    }
}
