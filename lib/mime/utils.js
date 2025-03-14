export function normalizeName ( name ) {
    return name.toLowerCase();
}

export function normalizeExtname ( name ) {
    name = name.toLowerCase();

    if ( !name.startsWith( "." ) ) {
        name = "." + name;
    }

    return name;
}
