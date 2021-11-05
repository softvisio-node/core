import DockerEngineStream from "#lib/api/docker/engine/stream";

export default Super =>
    class extends ( Super || Object ) {
        async monitorContainerStats ( containerId ) {
            const res = await this._stream( `containers/${containerId}/stats` );

            if ( !res.ok ) throw res + "";

            const stream = new DockerEngineStream( res.body );

            return stream;
        }
    };
