export default Super =>
    class extends ( Super || Object ) {
        async monitorEvents () {
            const res = await this._stream( "events" );

            if ( !res.ok ) return res;

            res.body.on( "data", data => this.emit( "event", JSON.parse( data ) ) );
        }
    };
