export default {
    "keyword": "check-object-permissions",
    compile ( schema ) {
        if ( !schema ) return;

        return data => {
            if ( typeof data !== "string" ) return false;

            global._checkObjectPermisisonsIds ??= [];
            global._checkObjectPermisisonsIds.push( data );

            return true;
        };
    },
    "metaSchema": {
        "type": "boolean",
    },
};
