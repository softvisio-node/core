import Component from "#lib/app/component";

export default class extends Component {

    // protected
    async _configure () {
        if ( this.config.locations ) {
            return result( 200 );
        }
        else {
            return result( 200, { "enabled": false } );
        }
    }

    async _init () {
        for ( const [location, wwwPath] of Object.entries( this.config.locations ) ) {
            if ( !wwwPath ) continue;

            this.app.publicHttpServer.webpack( location, new URL( wwwPath, this.app.location ) );
        }

        return result( 200 );
    }
}
