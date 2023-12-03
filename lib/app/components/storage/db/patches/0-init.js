import sql from "#lib/sql";

export default sql`

DROP FUNCTION storage_create_file;
DROP FUNCTION storage_create_image;
DROP TABLE storage_file;
DROP TABLE storage_image;
DROP FUNCTION storage_file_after_update_trigger;
DROP FUNCTION storage_file_after_delete_trigger;



`;
