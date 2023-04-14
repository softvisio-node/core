import _Events from "node:events";
import EventsListenersGroup from "#lib/events/group";

export default class Events extends _Events {
    constructor ( options = {} ) {
        super( options );

        if ( options.maxListeners ) this.setMaxListeners( options.maxListeners );
    }

    // public
    createListenersGroup () {
        return new EventsListenersGroup( this );
    }
}
