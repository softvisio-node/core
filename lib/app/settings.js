import crypto from "crypto";

const DEFAULT_SETTINGS = {
    "usernameIsEmail": true,
    "newUserEnabled": true,
    "defaultGravatarEmail": "noname@softvisio.net", // used, if user email is not set
    "defaultGravatarImage": "identicon", // url encoded url, 404, mp, identicon, monsterid, wavatar, retro, robohash, blank
};

export default function mergeSettings ( settings ) {
    settings.usernameIsEmail ??= DEFAULT_SETTINGS.usernameIsEmail;
    settings.newUserEnabled ??= DEFAULT_SETTINGS.newUserEnabled;
    settings.defaultGravatarEmail ??= DEFAULT_SETTINGS.defaultGravatarEmail;
    settings.defaultGravatarImage ??= DEFAULT_SETTINGS.defaultGravatarImage;

    settings.defaultGravatarUrl ??= `https://s.gravatar.com/avatar/${crypto.createHash( "MD5" ).update( settings.defaultGravatarEmail.toLowerCase() ).digest( "hex" )}?d=${settings.defaultGravatarImage}`;

    return settings;
}
