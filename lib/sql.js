const { sql } = require( "./sql/dbi" );
sql.sql = sql;
sql.connect = require( "./sql/dbd" ).connect;

module.exports = sql;
