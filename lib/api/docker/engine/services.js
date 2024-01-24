export default Super =>
    class extends ( Super || Object ) {
        async getServices () {
            return this._request( "get", "services" );
        }

        async inspectService ( serviceId ) {
            return this._request( "get", `services/${ serviceId }` );
        }
    };
