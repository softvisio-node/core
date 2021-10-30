import sql from "#lib/sql";

export default sql`

DO $$ BEGIN
    IF to_regtype( 'int53' ) IS NULL THEN
        CREATE DOMAIN int53 AS int8 CHECK ( VALUE >= -9007199254740991 AND VALUE <= 9007199254740991 );
    END IF;
END $$;

`;
