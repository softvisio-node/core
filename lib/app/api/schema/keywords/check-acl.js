export default {
    "keyword": "check-acl",
    "metaSchema": {
        "type": ["boolean", "string"],
    },
    compile ( schema ) {
        if ( !schema ) return;

        global[Symbol.for( "checkAcl" )] ??= new Set();
        global[Symbol.for( "checkAcl" )].add( schema );

        return data => {
            if ( typeof data !== "string" ) return false;

            global[Symbol.for( "checkAcl" )] ??= {};
            global[Symbol.for( "checkAcl" )][data] = schema;

            return true;
        };
    },
};
