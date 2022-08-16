export default {
    "keyword": "aclObjectType",
    "type": ["string", "number"],
    "metaSchema": {
        "type": "string",
    },
    compile ( schema ) {
        if ( !schema ) return;

        global[Symbol.for( "aclObjectType" )] ??= new Set();
        global[Symbol.for( "aclObjectType" )].add( schema );

        return data => {
            global[Symbol.for( "aclObjectType" )] ??= {};
            global[Symbol.for( "aclObjectType" )][data] = schema;

            return true;
        };
    },
};
