const allowedTypes = new Set( ["string", "number"] );

export default {
    "keyword": "aclObjectType",
    "metaSchema": {
        "type": "string",
    },
    compile ( schema ) {
        if ( !schema ) return;

        global[Symbol.for( "aclObjectType" )] ??= new Set();
        global[Symbol.for( "aclObjectType" )].add( schema );

        return data => {
            if ( !allowedTypes.has( typeof data ) ) return false;

            global[Symbol.for( "aclObjectType" )] ??= {};
            global[Symbol.for( "aclObjectType" )][data] = schema;

            return true;
        };
    },
};
