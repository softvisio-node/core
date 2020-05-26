const { IS_SQL } = require( "../const" );
const { "v1": uuidv1 } = require( "uuid" );

class Query {
    static [IS_SQL] = true;

    #id;
    #query = {
        "$": null,
        "?": null,
    };
    #params;

    

    

    
}

module.exports.Query = Query;
