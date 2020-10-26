const { constants } = require( "./util/browser/constants" );

const CONST = {
    ...require( "./const/browser" ),

    "OBJECT_IS_APP": Symbol(),
    "OBJECT_IS_SQL_QUERY": Symbol(),

    "SQL_MIGRATION_TABLE_NAME": "__migration",
    "SQL_MIGRATION_DEFAULT_MODULE": "main",
    "SQL_TYPE": Symbol(),

    "TOKEN_TYPE_PASSWORD": "1",
    "TOKEN_TYPE_TOKEN": "2",
    "TOKEN_TYPE_SESSION": "3",
    "TOKEN_TYPE_EMAIL_CONFIRM": "4",
    "TOKEN_TYPE_PASSWORD_RESET": "5",
};

module.exports = constants( CONST );
