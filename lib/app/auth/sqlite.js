const { mix } = require( "../../mixins" );
const sql = require( "../../sql" );
const result = require( "../../result" );
const Auth = require( "../auth" );
const Local = require( "./local" );
const { "v4": uuidv4 } = require( "uuid" );
const { ROOT_USER_ID } = require( "../../const" );

module.exports = class extends mix( Local, Auth ) {
    constructor ( app, dbh ) {
        super( app, dbh );
    }

    async _createUser ( dbh, fields ) {
        const guid = uuidv4();

        if ( this.app.userIsRoot( fields.name ) ) fields.id = ROOT_USER_ID;

        fields.guid = guid;

        const res = await dbh.do( sql`INSERT INTO "user"`.VALUES( [fields] ) );

        if ( !res.isOk() ) {
            return res;
        }
        else {
            return result( 200, {
                "id": dbh.lastInsertRowId,
                "guid": guid,
                "name": fields.name,
            } );
        }
    }
};
