import Component from "#lib/app/component";

export default class extends Component {

    // protected
    async _init () {
        if ( this.config.locations ) {
            for ( const [location, wwwPath] of Object.entries( this.config.locations ) ) {
                this.app.publicHttpServer.webpack( location, new URL( wwwPath, this.app.location ) );
            }
        }

        return result( 200 );
    }
}
