export default Super =>
    class extends Super {
        async API_addUpstream ( ctx, options ) {
            const res = await this.app.nginx.addUpstream( ctx.remoteAddress, options );

            if ( !res.ok ) return res;

            return new Promise( resolve => {
                ctx.connection.once( "disconnect", () => {
                    this.app.nginx.deleteUpstream( ctx.remoteAddress );

                    resolve( result( 200 ) );
                } );
            } );
        }
    };
