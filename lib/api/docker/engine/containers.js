export default Super =>
    class extends ( Super || class {} ) {
        async monitorContainerStats ( containerId, { signal } = {} ) {
            return this._doRequest( "get", `containers/${ containerId }/stats`, {
                "stream": true,
                signal,
            } );
        }

        async pruneContainers ( options ) {
            return this._doRequest( "post", "containers/prune", {
                "params": {
                    "filters": options,
                },
            } );
        }
    };
