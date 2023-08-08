import Hostname from "#lib/hostname";

export default {
    "nginx-server-name": {
        "type": "string",
        validate ( value ) {
            if ( value === "*" ) return true;

            value = value.replaceAll( "*", "test" );

            const hostname = new Hostname( value );

            return hostname.isDomain && hostname.isValid;
        },
    },
};
