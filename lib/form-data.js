import FormData from "form-data";
import Busboy from "busboy";

export default FormData;

FormData.decode = function decode ( stream, options = {} ) {
    const busboy = new Busboy( { "headers": options.headers } );

    stream.pipe( busboy );

    return busboy;
};
