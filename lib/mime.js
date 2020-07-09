const path = require( "path" );

const db = require( "mime-db" );
const extdb = {};
const shebangdb = {
    "bash": "application/x-sh",
    "sh": "application/x-sh",
    "node": "application/node",
};

for ( const id in db ) {
    const type = id.split( "/" );

    db[id].id = id;
    db[id]["content-type"] = id;

    db[id].type = type[0];

    db[id].subtype = type[1];

    db[id].extnames = ( db[id].extensions || [] ).map( extname => {
        extdb["." + extname] = id;

        return "." + extname;
    } );

    delete db[id].extensions;
}

function registerContentType ( id, extnames, compressible ) {
    if ( db[id] ) throw `MIME content type "${id}" is already registered.`;

    if ( !Array.isArray( extnames ) ) extnames = [extnames];

    extnames = extnames
        .filter( extname => typeof extname === "string" && extname !== "" )
        .map( extname => {
            if ( extname.charAt( 0 ) !== "." ) extname = "." + extname;

            if ( extdb[extname] ) throw `Extension "${extname}" is already registered.`;

            extdb[extname] = id;
        } );

    const type = id.split( "/" );

    db[id] = {
        "source": "custom",
        id,
        "content-type": id,
        extnames,
        compressible,
        "type": type[0],
        "subtype": type[1],
    };
}

module.exports.registerContentType = registerContentType;

function registerExtname ( extname, id ) {
    if ( extname.charAt( 0 ) !== "." ) extname = "." + extname;

    if ( extdb[extname] ) throw `Extension "${extname}" is already registered.`;

    if ( !db[id] ) throw `MIME type "${id}" for extname "${extname}" is not registered.`;

    extdb[extname] = id;

    db[id].extnames.push( extname );
}

module.exports.registerExtname = registerExtname;

function registerShebang ( shebang, id ) {
    if ( shebangdb[shebang] ) throw `Shebang "${shebang}" is already registered.`;

    if ( !db[id] ) throw `MIME type "${id}" for shebang "${shebang}" is not registered.`;

    shebangdb[shebang] = id;
}

module.exports.registerShebang = registerShebang;

module.exports.getByFilename = function ( filename ) {
    return db[extdb[path.extname( filename ).toLowerCase()]];
};

module.exports.getByContentType = function ( contentType ) {
    return db[contentType];
};

module.exports.getByShebang = function ( content ) {

    // find shebang
    const match = content.match( /^#!(.+)$/m );

    if ( !match ) return;

    const shebang = match[0].toLowerCase();

    for ( const name in shebangdb ) {
        if ( shebang.indexOf( name ) > -1 ) return shebangdb[name];
    }
};

// CUSTOM TYPES
registerContentType( "application/vue", [".vue"], true );
