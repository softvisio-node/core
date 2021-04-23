const constants = require( "./constants" );

const CONST = {
    ...require( "./const/common" ),

    "SQL_MIGRATION_TABLE_NAME": "__migration",
    "SQL_MIGRATION_DEFAULT_MODULE": "main",
    "SQL_TYPE": Symbol(),
    "SQL_LOCKS": {
        "MIGRATION": -1,
    },

    "AUTH_USER": 1,
    "AUTH_TOKEN": 2,
    "AUTH_SESSION": 3,
    "AUTH_EMAIL_CONFIRM": 4,
    "AUTH_PASSWORD_RESET": 5,
};

module.exports = constants( CONST );
