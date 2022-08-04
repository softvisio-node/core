export default {
    "keyword": "check-object-permissions",
    "metaSchema": {
        "type": ["boolean", "string"],
    },
    compile ( schema ) {
        if ( !schema ) return;

        return data => {
            if ( typeof data !== "string" ) return false;

            global[Symbol.for( "checkObjectPermisisonsIds" )] ??= {};

            global[Symbol.for( "checkObjectPermisisonsIds" )][data] = schema;

            return true;
        };
    },
};
