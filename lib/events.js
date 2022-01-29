import _Events from "events";

export default class Events extends _Events {
    constructor ( options = {} ) {
        super( options );

        if ( options.maxListeners ) this.setMaxListeners( options.maxListeners );
    }
}
