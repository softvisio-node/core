export default Super =>
    class extends ( Super || class {} ) {
        async getServices () {
            return this._doRequest( "get", "services" );
        }

        async inspectService ( serviceId ) {
            return this._doRequest( "get", `services/${ serviceId }` );
        }
    };
