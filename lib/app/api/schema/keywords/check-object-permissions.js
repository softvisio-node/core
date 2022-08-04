export default {
    "keyword": "check-object-permissions",
    "metaSchema": {
        "type": "string",
    },
    compile ( schema ) {
        return data => {
            if ( typeof data !== "string" ) return false;

            global._checkObjectPermisisonsIds ??= {};
            global._checkObjectPermisisonsIds[data] = schema;

            return true;
        };
    },
};
