export default Super =>
    class extends ( Super || Object ) {
        async monitorContainerStats ( containerId ) {
            const res = await this._stream( `containers/${containerId}/stats` );

            if ( !res.ok ) return res;

            return new Promise( resolve => {
                res.body.on( "data", data => this.emit( "event", JSON.parse( data ) ) );

                res.body.on( "end", () => resolve( result( 200 ) ) );
            } );
        }
    };
