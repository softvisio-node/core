import constants from "#lib/_browser/app/constants";
import Interval from "#lib/interval";

export default {
    ...constants,

    "apiToken": {
        "id": -1,
        "length": 8,
        "maxAge": null,
    },

    "sessionToken": {
        "id": -2,
        "length": 16,
        "maxAge": null,
    },

    "emailConfirmationToken": {
        "id": -3,
        "length": 8,
        "maxAge": new Interval( "10 minutes" ),
    },

    "passwordResetToken": {
        "id": -4,
        "length": 8,
        "maxAge": new Interval( "10 minutes" ),
    },

    "emailChangeToken": {
        "id": -5,
        "length": 8,
        "maxAge": new Interval( "10 minutes" ),
    },
};
