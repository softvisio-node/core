import _Events from "events";

export default class Events extends _Events {
    constructor ( { captureRejections, maxListeners } = {} ) {
        super( { captureRejections } );

        if ( maxListeners ) this.setMaxListeners( maxListeners );
    }
}
