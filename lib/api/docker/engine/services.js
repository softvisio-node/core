export default Super =>
    class extends ( Super || class {} ) {
        async getServices () {
            return this._request( "get", "services" );
        }

        async inspectService ( serviceId ) {
            return this._request( "get", `services/${ serviceId }` );
        }
    };
