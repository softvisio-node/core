export default Super =>
    class extends Super {

        // protected
        async _checkEnabled () {
            return !!this.config.locations;
        }

        async _init () {
            for ( const [ location, wwwPath ] of Object.entries( this.config.locations ) ) {
                if ( !wwwPath ) continue;

                this.app.publicHttpServer.webpack( location, new URL( wwwPath, this.app.location ) );
            }

            return result( 200 );
        }
    };
