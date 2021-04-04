var page;

try {
    page = require( "playwright/lib/client/page" );
}
catch ( e ) {
    page = require( "playwright-chromium/lib/client/page" );
}

page.Page = class extends page.Page {
    #imagesIsDisabled = false;

    get imagesIsDisabled () {
        return this.#imagesIsDisabled;
    }

    async disableImages () {
        if ( this.#imagesIsDisabled ) return;

        this.#imagesIsDisabled = true;

        return this.route( "**", ( route, request ) => {
            if ( request.resourceType() === "image" ) route.abort();
            else route.continue();
        } );
    }
};
