import sql from "#lib/sql";

export default sql`

DROP TABLE object_permissions;
DROP SEQUENCE object_id_seq;
DROP FUNCTION gen_object_id;
DROP FUNCTION object_permissions_invalidate_trigger;

`;
