const { sql } = require( "./sql/dbi" );
sql.sql = sql;
sql.connect = require( "./sql/dbh" ).connect;
sql.WHERE = require( "./sql/dbi/where" );

module.exports = sql;
