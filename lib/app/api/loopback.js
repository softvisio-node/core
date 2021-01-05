const EventEmitter = require( "events" );

module.exports = class extends EventEmitter {
    constructor ( backend ) {
        super();
    }

    async authenticate ( token ) {
        return;
    }
};
