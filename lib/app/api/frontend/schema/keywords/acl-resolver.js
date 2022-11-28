export default {
    "keyword": "aclResolver",
    "type": ["string", "number"],
    "metaSchema": {
        "type": "string",
    },
    compile ( schema ) {
        if ( !schema ) return;

        global[Symbol.for( "aclResolver" )] ??= new Set();
        global[Symbol.for( "aclResolver" )].add( schema );

        return data => {
            global[Symbol.for( "aclResolver" )] ??= {};
            global[Symbol.for( "aclResolver" )][data] = schema;

            return true;
        };
    },
};
