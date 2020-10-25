const { constants } = require( "./util" );
const BROWSER_CONST = require( "./const/browser" );

const CONST = {
    ...BROWSER_CONST,

    "SQL_MIGRATION_TABLE_NAME": "__migration",
    "SQL_MIGRATION_DEFAULT_MODULE": "main",

    "TOKEN_TYPE_PASSWORD": "1",
    "TOKEN_TYPE_TOKEN": "2",
    "TOKEN_TYPE_SESSION": "3",
    "TOKEN_TYPE_EMAIL_CONFIRM": "4",
    "TOKEN_TYPE_PASSWORD_RESET": "5",
};

module.exports = constants( CONST );
