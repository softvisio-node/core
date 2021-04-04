// XXX
/*
Page.prototype.disableImages = async function () {
    return this.route( "**", ( route, request ) => {
        if ( request.resourceType() === "image" ) route.abort();
        else route.continue();
    } );
};
*/

// XXX platform override
module.exports = async function ( browserOptions, contextOptions ) {
    if ( contextOptions.userAgent ) return;

    if ( !browserOptions.userAgent ) return;

    contextOptions.userAgent = browserOptions.userAgent.replace( "HeadlessChrome/", "Chrome/" );

    // patch userAgent platform
    if ( contextOptions.userAgentPlatform ) {
        contextOptions.userAgent = contextOptions.userAgent.replace( /\(.+?\)/, `(${contextOptions.userAgentPlatform})` );
    }

    // XXX
    // if ( contextOptions.platform ) {
    //     override.platform = contextOptions.platform;
    // }
};
