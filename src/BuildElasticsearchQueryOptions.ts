export interface BuildElasticsearchQueryOptions {

    /**
     * Wildcard search settings.
     */
    wildcard?: {
        enabled?: boolean;

        /**
         * The minimum number of concrete characters we'll require in a
         * wildcard search before performing it.
         */
        minCharacters?: number;
    };

    /**
     * Fuzzy search settings.
     */
    fuzzy?: {
        enabled?: boolean;

        /**
         * The minimum number of characters we'll require in a fuzzy
         * search before performing it.
         */
        minCharacters?: number;
    };

    /**
     * A function that validates a field name.
     * @param field the name of a field
     * @returns true if valid, false otherwise
     */
    fieldVerifier?: (field: string) => boolean;
}
