import Events from "#lib/events";

export default class DockerEngineStream extends Events {
    #stream;

    constructor ( stream ) {
        super();

        this.#stream = stream;

        stream.on( "close", () => this.emit( "close" ) );

        stream.on( "data", data => this.emit( "event", JSON.parse( data ) ) );
    }

    // properties
    isDestroyed () {
        return this.#stream.destroyed;
    }

    // public
    destroy () {
        this.#stream.destroy();
    }
}
