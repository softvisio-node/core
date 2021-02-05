const Events = require( "events" );

module.exports = class extends Events {
    constructor ( backend ) {
        super();
    }

    async authenticate ( token ) {
        return;
    }
};
