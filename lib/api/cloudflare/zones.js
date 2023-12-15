export default Super =>
    class extends ( Super || Object ) {

        // https://developers.cloudflare.com/api/operations/zones-get
        async getZones ( zoneIdentifier ) {
            return this._request( "get", "zones" );
        }
    };
