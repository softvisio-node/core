export default {
    "keyword": "check-object-permissions",
    "metaSchema": {
        "type": ["boolean", "string"],
    },
    compile ( schema ) {
        if ( !schema ) return;

        return data => {
            if ( typeof data !== "string" ) return false;

            global._checkObjectPermisisonsIds ??= {};
            global._checkObjectPermisisonsIds[data] = schema;

            return true;
        };
    },
};
