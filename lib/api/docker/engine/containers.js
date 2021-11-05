export default Super =>
    class extends ( Super || Object ) {
        async monitorContainerStats ( containerId ) {
            return this._stream( `containers/${containerId}/stats` );
        }
    };
