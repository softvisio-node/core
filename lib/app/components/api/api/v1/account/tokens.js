import mixins from "#lib/mixins";
import Read from "#lib/app/mixins/read";
import sql from "#lib/sql";

export default Super =>
    class extends mixins( Read, Super ) {
        async API_read ( ctx, options = {} ) {
            const where = this.dbh.where( sql`user_token.user_id = "user".id AND "user".id = ${ctx.user.id}` );

            // get by id
            if ( options.id ) {
                where.and( sql`"user_token"."id" = ${options.id}` );
            }

            // get all matched rows
            else {

                // filter search
                if ( options.where && options.where.name ) {
                    where.and( { "user_token.name": options.where.name } );
                }
            }

            const mainQuery = sql`SELECT user_token.* FROM user_token, "user"`.WHERE( where );

            const tokens = await this._read( ctx, mainQuery, { options } );

            return tokens;
        }

        async API_create ( ctx, name ) {
            return await this.api.userTokens.createUserToken( ctx.user.id, name, true, {} );
        }

        async API_delete ( ctx, tokenId ) {
            const token = await this.api.userTokens.getUserToken( tokenId );

            if ( !token ) return token;

            if ( token.data.user_id !== ctx.user.id ) return result( 404 );

            return this.api.userTokens.deleteUserToken( tokenId );
        }

        async API_setEnabled ( ctx, tokenId, enabled ) {
            const token = await this.api.userTokens.getUserToken( tokenId );

            if ( !token ) return token;

            if ( token.data.user_id !== ctx.user.id ) return result( 404 );

            return this.api.userTokens.setUserTokenEnabled( tokenId, enabled );
        }
    };
