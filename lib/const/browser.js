const { constants } = require( "../util/browser/constants" );

const CONST = {
    "OBJECT_ID_COUNTRY": Symbol(),
    "OBJECT_ID_GOOGLE_DOMAIN": Symbol(),
    "OBJECT_ID_MIXIN": Symbol(),
    "OBJECT_ID_RESULT": Symbol(),

    "ROOT_USER_NAME": "root",
    "ROOT_USER_ID": 1,
};

module.exports = constants( CONST );
