const path = require( "path" );
const db = require( "mime-db" );
const ext = {};

for ( const type in db ) {
    const mimeClass = type.substr( 0, type.indexOf( "/" ) );

    db[type].class = mimeClass;

    for ( const extname of db[type].extensions || [] ) {
        ext["." + extname] = {
            extname,
            type,
            "class": mimeClass,
            "charset": db[type].charset,
            "compressible": db[type].compressible,
        };
    }
}

module.exports = function getMime ( file ) {
    return ext[path.extname( file )];
};
