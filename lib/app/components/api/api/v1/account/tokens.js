import sql from "#lib/sql";

export default Super =>
    class extends Super {
        async API_getTokensList ( ctx, options = {} ) {
            const where = sql.where( sql`api_token.user_id = "user".id AND "user".id = ${ ctx.user.id }` );

            // get by id
            if ( options.id ) {
                where.and( sql`"api_token"."id" = ${ options.id }` );
            }

            // get all matched rows
            else {

                // filter search
                if ( options.where && options.where.name ) {
                    where.and( { "api_token.name": options.where.name } );
                }
            }

            const mainQuery = sql`SELECT api_token.* FROM api_token, "user"`.WHERE( where );

            return this._read( ctx, mainQuery, { options } );
        }

        async API_create ( ctx, name ) {
            return await this.api.tokens.createToken( ctx.user.id, name, true, {} );
        }

        async API_delete ( ctx, tokenId ) {
            const token = await this.api.tokens.getToken( tokenId );

            if ( !token ) return token;

            if ( token.data.user_id !== ctx.user.id ) return result( 404 );

            return this.api.tokens.deleteToken( tokenId );
        }

        async API_setEnabled ( ctx, tokenId, enabled ) {
            const token = await this.api.tokens.getToken( tokenId );

            if ( !token ) return token;

            if ( token.data.user_id !== ctx.user.id ) return result( 404 );

            return this.api.tokens.setTokenEnabled( tokenId, enabled );
        }
    };
