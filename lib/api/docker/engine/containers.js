export default Super =>
    class extends ( Super || Object ) {
        async monitorContainerStats ( containerId, { signal } = {} ) {
            return this._request( "get", `containers/${ containerId }/stats`, {
                "stream": true,
                signal,
            } );
        }

        async pruneContainers ( options ) {
            return this._request( "post", "containers/prune", {
                "params": {
                    "filters": options,
                },
            } );
        }
    };
