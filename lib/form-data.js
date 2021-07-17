import _FormData from "form-data";
import File from "#lib/file";

export default class FormData extends _FormData {
    append ( name, value, options ) {
        if ( value instanceof File ) {
            return super.append( name, value.stream(), {
                "filename": value.name,
                "contentType": value.type,
                "knownLength": value.size,
            } );
        }
        else {
            return super.append( name, value, options );
        }
    }
}
