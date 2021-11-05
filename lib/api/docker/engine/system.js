export default Super =>
    class extends ( Super || Object ) {
        async monitorSystemEvents () {
            const res = await this._stream( "events" );

            if ( !res.ok ) return res;

            res.body.on( "data", data => this.emit( "event", JSON.parse( data ) ) );
        }

        async getDataUsage () {
            return this._request( "system/df" );
        }

        async getSystemInfo () {
            return this._request( "info" );
        }

        async getVersion () {
            return this._request( "veersion" );
        }
    };
