export default Super =>
    class extends ( Super || Object ) {
        async monitorContainerStats ( containerId ) {
            return this._request( "get", `containers/${containerId}/stats` );
        }

        async pruneContainers ( filters ) {
            return this._request( "post", "containers/prune", {
                "params": {
                    filters,
                },
                "jsonParams": true,
            } );
        }
    };
