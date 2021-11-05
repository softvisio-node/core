export default Super =>
    class extends ( Super || Object ) {
        async monitorContainerStats ( containerId ) {
            const res = await this._stream( `containers/${containerId}/stats` );

            if ( !res.ok ) return res;

            res.body.on( "data", data => this.emit( "event", JSON.parse( data ) ) );
        }
    };
