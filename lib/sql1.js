const sql = require( "./sql/dbi/sql" );

module.exports = sql;

sql.connect = require( "./sql/dbh" );

sql.sql = sql;

sql.WHERE = require( "./sql/dbi/where" );
sql.ON = require( "./sql/dbi/on" );
sql.HAVING = require( "./sql/dbi/having" );

sql.IN = require( "./sql/dbi/in" );

sql.SET = require( "./sql/dbi/set" );
sql.VALUES = require( "./sql/dbi/values" );

sql.GROUP_BY = require( "./sql/dbi/group-by" );
sql.ORDER_BY = require( "./sql/dbi/order-by" );
sql.LIMIT = require( "./sql/dbi/limit" );
sql.OFFSET = require( "./sql/dbi/offset" );
