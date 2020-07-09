const path = require( "path" );

const db = require( "mime-db" );
const extdb = {};

for ( const contentType in db ) {
    const type = contentType.split( "/" );

    db[contentType]["content-type"] = contentType;

    db[contentType].type = type[0];

    db[contentType].subtype = type[1];

    db[contentType].extnames = ( db[contentType].extensions || [] ).map( extname => {
        extdb["." + extname] = contentType;

        return "." + extname;
    } );

    delete db[contentType].extensions;
}

module.exports.getByExtname = function ( file ) {
    return db[extdb[path.extname( file )]];
};

module.exports.getByContentType = function ( contentType ) {
    return db[contentType];
};
