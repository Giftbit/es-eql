export class QueryBuilderError extends Error {

    readonly isQueryBuilderError = true;

    constructor(message: string, public exp?: string) {
        super(message + (exp ? " " + exp : ""));
    }
}
