export default {
    "keyword": "check-acl",
    "metaSchema": {
        "type": ["boolean", "string"],
    },
    compile ( schema ) {
        if ( !schema ) return;

        if ( typeof schema === "string" ) {
            global[Symbol.for( "checkAcl" )] ??= {};
            global[Symbol.for( "checkAcl" )][schema] = true;
        }

        return data => {
            if ( typeof data !== "string" ) return false;

            global[Symbol.for( "checkAcl" )] ??= {};
            global[Symbol.for( "checkAcl" )][data] = schema;

            return true;
        };
    },
};
