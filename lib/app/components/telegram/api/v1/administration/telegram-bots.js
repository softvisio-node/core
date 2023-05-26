import sql from "#lib/sql";

export default Super =>
    class extends Super {
        async API_read ( ctx, options = {} ) {
            const query = sql`
SELECT
    *
FROM
    telegram_bot                    *
`;

            return this._read( ctx, query, { options } );
        }
    };
