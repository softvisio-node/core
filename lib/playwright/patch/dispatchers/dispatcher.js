var dispatcher;

try {
    dispatcher = require( "playwright/lib/dispatchers/dispatcher" );
}
catch ( e ) {
    dispatcher = require( "playwright-chromium/lib/dispatchers/dispatcher" );
}

dispatcher.Dispatcher = class extends dispatcher.Dispatcher {
    constructor ( parent, object, type, initializer ) {
        if ( type === "Browser" ) initializer.userAgent = object.__userAgent;

        super( ...arguments );
    }
};
